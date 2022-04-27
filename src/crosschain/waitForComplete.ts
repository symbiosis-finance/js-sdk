import { EventFilter } from '@ethersproject/contracts'
import { TransactionReceipt } from '@ethersproject/providers'
import { hexlify } from '@ethersproject/bytes'
import { TxInfo } from '@terra-money/terra.js'
import { isTerraChainId } from '../utils'
import { ChainId } from '../constants'
import { Token, TokenAmount } from '../entities'
import { Portal, Synthesis } from './contracts'
import { TypedEvent } from './contracts/common'
import { BurnCompletedEventFilter, SynthesizeRequestEvent } from './contracts/Portal'
import { BurnRequestEvent, SynthesizeCompletedEventFilter } from './contracts/Synthesis'
import { PendingRequest, PendingRequestState, PendingRequestType } from './pending'
import type { Symbiosis } from './symbiosis'
import { BridgeDirection } from './types'
import { getExternalId, GetLogTimeoutExceededError, getLogWithTimeout } from './utils'
import { base64 } from 'ethers/lib/utils'

type EventArgs<Event> = Event extends TypedEvent<any, infer TArgsObject> ? TArgsObject : never

interface WaitForCompleteParams {
    symbiosis: Symbiosis
    tokenOut: Token
    direction: BridgeDirection
    revertableAddress: string
    chainIdIn: ChainId
}

export class TransactionStuckError extends Error {
    constructor(public readonly pendingRequest: PendingRequest) {
        super(`Transaction stuck: ${JSON.stringify(pendingRequest)}`)
    }
}

export class LogNotFoundError extends Error {
    constructor() {
        super('Log not found')
    }
}

export class WaitForComplete {
    private readonly direction: BridgeDirection
    private readonly symbiosis: Symbiosis
    private readonly tokenOut: Token
    private readonly revertableAddress: string
    private readonly chainIdIn: ChainId

    public constructor({ direction, symbiosis, tokenOut, revertableAddress, chainIdIn }: WaitForCompleteParams) {
        this.direction = direction
        this.symbiosis = symbiosis
        this.tokenOut = tokenOut
        this.revertableAddress = revertableAddress
        this.chainIdIn = chainIdIn
    }

    public async transactionFromTerra(txInfo: TxInfo): Promise<string> {
        if (!isTerraChainId(this.chainIdIn)) {
            throw new Error('Wrong out chain id')
        }

        if (this.tokenOut.isFromTerra()) {
            throw new Error('Terra is not supported')
        }

        const filter = this.getFilterFromTxInfo(txInfo)

        // TODO: Check pending requests on terra
        const log = await getLogWithTimeout({
            symbiosis: this.symbiosis,
            chainId: this.tokenOut.chainId,
            filter,
        })

        return log.transactionHash
    }

    public async transactionFromEvm(receipt: TransactionReceipt): Promise<string> {
        if (this.tokenOut.isFromTerra()) {
            throw new Error('Not implemented')
        }

        const filter = this.buildOtherSideFilter(receipt)

        try {
            const log = await getLogWithTimeout({
                symbiosis: this.symbiosis,
                chainId: this.tokenOut.chainId,
                filter,
            })

            return log.transactionHash
        } catch (error) {
            if (!(error instanceof GetLogTimeoutExceededError)) {
                throw error
            }

            const pendingRequest = this.getPendingRequest(receipt)
            if (!pendingRequest) {
                throw error
            }

            throw new TransactionStuckError(pendingRequest)
        }
    }

    private getFilterFromTxInfo(txInfo: TxInfo): EventFilter {
        if (!txInfo.logs || !txInfo.logs.length) {
            throw new LogNotFoundError()
        }

        const [{ eventsByType }] = txInfo.logs

        const wasmEvent = eventsByType['wasm']

        if (!wasmEvent) {
            throw new LogNotFoundError()
        }

        const [externalId] = wasmEvent.external_id

        const hexExternalId = hexlify(base64.decode(externalId))

        return this.getFilterFromExternalId(hexExternalId)
    }

    private getRequestArgs(
        receipt: TransactionReceipt
    ): EventArgs<SynthesizeRequestEvent | BurnRequestEvent> | undefined {
        let contract: Synthesis | Portal
        let eventName: string
        if (this.direction === 'burn') {
            contract = this.symbiosis.synthesis(this.chainIdIn)
            eventName = 'BurnRequest'
        } else {
            contract = this.symbiosis.portal(this.chainIdIn)
            eventName = 'SynthesizeRequest'
        }

        for (const log of receipt.logs) {
            let event
            try {
                event = contract.interface.parseLog(log)
            } catch {
                continue
            }

            if (event.name === eventName) {
                return event.args as unknown as EventArgs<SynthesizeRequestEvent | BurnRequestEvent>
            }
        }

        return undefined
    }

    private buildOtherSideFilter(receipt: TransactionReceipt): EventFilter {
        const args = this.getRequestArgs(receipt)
        if (!args) {
            throw new LogNotFoundError()
        }

        const requestId = args.id

        const receiveSide =
            this.direction === 'burn'
                ? this.symbiosis.portal(this.tokenOut.chainId).address
                : this.symbiosis.synthesis(this.tokenOut.chainId).address

        const externalId = getExternalId({
            internalId: requestId,
            contractAddress: receiveSide,
            revertableAddress: this.revertableAddress,
            chainId: this.tokenOut.chainId,
        })

        return this.getFilterFromExternalId(externalId)
    }

    private getFilterFromExternalId(externalId: string): EventFilter {
        let receiveSide: string
        let eventFilter: BurnCompletedEventFilter | SynthesizeCompletedEventFilter
        if (this.direction === 'burn') {
            const portal = this.symbiosis.portal(this.tokenOut.chainId)
            receiveSide = portal.address
            eventFilter = portal.filters.BurnCompleted()
        } else {
            const synthesis = this.symbiosis.synthesis(this.tokenOut.chainId)
            receiveSide = synthesis.address
            eventFilter = synthesis.filters.SynthesizeCompleted()
        }

        if (!eventFilter || !eventFilter.topics || eventFilter.topics.length === 0) {
            throw new Error('Event not found')
        }
        const topic0 = eventFilter.topics[0]

        return {
            address: receiveSide,
            topics: [topic0, externalId],
        }
    }

    private getPendingRequest(receipt: TransactionReceipt): PendingRequest | undefined {
        const args = this.getRequestArgs(receipt)
        if (!args) {
            return
        }

        const { id, amount: amountFrom, token: tokenIdFrom, from, to, chainID, revertableAddress } = args

        const chainId = chainID.toNumber() as ChainId

        const fromToken = this.symbiosis.findStable(tokenIdFrom, this.chainIdIn)
        if (!fromToken) {
            return
        }

        const fromTokenAmount = new TokenAmount(fromToken, amountFrom.toHexString())

        let contractAddress: string
        let type: PendingRequestType
        if (this.direction === 'burn') {
            contractAddress = this.symbiosis.synthesis(this.chainIdIn).address
            type = 'burn'
        } else {
            contractAddress = this.symbiosis.portal(this.chainIdIn).address
            type = 'synthesize'
        }

        const externalId = getExternalId({
            internalId: id,
            contractAddress,
            revertableAddress,
            chainId,
        })

        return {
            chainIdFrom: this.chainIdIn,
            chainIdTo: chainId,
            externalId,
            from,
            fromTokenAmount,
            internalId: id,
            revertableAddress,
            state: PendingRequestState.Default,
            to,
            transactionHash: receipt.transactionHash,
            type,
        }
    }
}
