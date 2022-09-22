import { LogDescription } from '@ethersproject/abi'
import { EventFilter } from '@ethersproject/contracts'
import { Filter, Log, TransactionReceipt } from '@ethersproject/providers'
import fetch from 'isomorphic-unfetch'
import { ChainId } from '../constants'
import { Token, TokenAmount } from '../entities'
import { isNearChainId } from '../utils'
import { Portal, SynthesisNonEvm } from './contracts'
import { TypedEvent } from './contracts/common'
import { BurnCompletedEventFilter, SynthesizeRequestEvent } from './contracts/Portal'
import { BurnRequestEvent, SynthesizeCompletedEventFilter } from './contracts/Synthesis'
import { PendingRequest, PendingRequestState, PendingRequestType } from './pending'
import type { Symbiosis } from './symbiosis'
import { BridgeDirection } from './types'
import { GetLogTimeoutExceededError, getLogWithTimeout, getNoNEvmExternalId } from './utils'

type EventArgs<Event> = Event extends TypedEvent<any, infer TArgsObject> ? TArgsObject : never

export interface WaitForCompleteParams {
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

// TODO: Rework to pure functions and move to utils
export class WaitForComplete {
    private readonly direction: BridgeDirection
    private readonly symbiosis: Symbiosis
    private readonly tokenOut: Token
    private readonly revertableAddress: string
    private readonly chainIdIn: ChainId

    public constructor({ chainIdIn, direction, revertableAddress, symbiosis, tokenOut }: WaitForCompleteParams) {
        this.chainIdIn = chainIdIn
        this.direction = direction
        this.revertableAddress = revertableAddress
        this.symbiosis = symbiosis
        this.tokenOut = tokenOut
    }

    public async waitForCompleteFromParams(externalId: string, receiveSide: string): Promise<Log> {
        const filter = this.buildOwnSideFilter(externalId, receiveSide)

        return getLogWithTimeout({
            symbiosis: this.symbiosis,
            chainId: this.tokenOut.chainId,
            filter,
        }).catch((e) => {
            // TODO: Get pending request
            throw e
        })
    }

    public async waitForComplete(receipt: TransactionReceipt): Promise<Log> {
        const { externalId, receiveSide } = this.getTransactionParams(receipt)

        // @@
        if (this.tokenOut.isFromNear()) {
            let tries = 0
            while (tries < 10) {
                tries++

                const result = await fetch(
                    `https://api-near.dev.symbiosis.finance/crosschain/v1/near-bridge-tx/${externalId}`,
                    { headers: { 'Content-Type': 'application/json' } }
                )

                if (!result.ok) {
                    await new Promise((resolve) => setTimeout(resolve, 1000 * 20)) // 20 sec
                    continue
                }

                const json = await result.json()
                const { transactionHash } = json

                return { transactionHash } as Log
            }

            throw new GetLogTimeoutExceededError({ externalId } as Filter) // @@
        }

        const filter = this.buildOwnSideFilter(externalId, receiveSide)

        return getLogWithTimeout({
            symbiosis: this.symbiosis,
            chainId: this.tokenOut.chainId,
            filter,
        }).catch((e) => {
            if (!(e instanceof GetLogTimeoutExceededError)) {
                throw e
            }

            const pendingRequest = this.getPendingRequest(receipt)
            if (!pendingRequest) {
                throw e
            }

            throw new TransactionStuckError(pendingRequest)
        })
    }

    private getRequestArgs(
        receipt: TransactionReceipt
    ): EventArgs<SynthesizeRequestEvent | BurnRequestEvent> | undefined {
        let contract: SynthesisNonEvm | Portal
        let eventName: string
        if (this.direction === 'burn') {
            contract = this.symbiosis.synthesisNonEvm(this.chainIdIn)
            eventName = 'BurnRequest'
        } else {
            contract = this.symbiosis.portal(this.chainIdIn)
            eventName = 'SynthesizeRequest'
        }

        let args: EventArgs<SynthesizeRequestEvent | BurnRequestEvent> | undefined

        receipt.logs.forEach((log) => {
            let event: LogDescription
            try {
                event = contract.interface.parseLog(log)
            } catch {
                return
            }

            if (event.name === eventName) {
                // @@
                const argsCopy: any[] & Record<string, any> = Array.from(event.args)
                event.eventFragment.inputs.forEach((fragment, index) => {
                    argsCopy[fragment.name] = event.args[index]
                })

                // @@
                args = argsCopy as unknown as EventArgs<SynthesizeRequestEvent | BurnRequestEvent>
            }
        })

        return args
    }

    private buildOwnSideFilter(externalId: string, receiveSide: string): EventFilter {
        let event: SynthesizeCompletedEventFilter | BurnCompletedEventFilter
        if (this.direction === 'burn') {
            event = this.symbiosis.portal(this.tokenOut.chainId).filters.BurnCompleted()
        } else {
            event = this.symbiosis.synthesisNonEvm(this.tokenOut.chainId).filters.SynthesizeCompleted()
        }

        if (!event || !event.topics || event.topics.length === 0) {
            throw new Error('Event not found')
        }
        const topic0 = event.topics[0]

        return {
            address: receiveSide,
            topics: [topic0, externalId],
        }
    }

    private getTransactionParams(receipt: TransactionReceipt): { externalId: string; receiveSide: string } {
        if (!this.tokenOut) {
            throw new Error('Tokens are not set')
        }

        const args = this.getRequestArgs(receipt)
        if (!args) {
            throw new Error('Log not found')
        }

        const requestId = args.id

        const chainIdOut = this.tokenOut.chainId

        let receiveSide: string
        if (isNearChainId(chainIdOut)) {
            receiveSide = 'portal.symbiosis-finance.testnet' // @@
        } else {
            receiveSide =
                this.direction === 'burn'
                    ? this.symbiosis.portal(this.tokenOut.chainId).address
                    : this.symbiosis.synthesisNonEvm(this.tokenOut.chainId).address
        }

        const externalId = getNoNEvmExternalId({
            internalId: requestId,
            contractAddress: receiveSide,
            revertableAddress: this.revertableAddress,
            chainId: this.tokenOut.chainId,
        })

        return { externalId, receiveSide }
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
            contractAddress = this.symbiosis.synthesisNonEvm(this.chainIdIn).address
            type = 'burn'
        } else {
            contractAddress = this.symbiosis.portal(this.chainIdIn).address
            type = 'synthesize'
        }

        const externalId = getNoNEvmExternalId({
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
