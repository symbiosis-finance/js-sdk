import { EventFilter } from '@ethersproject/contracts'
import { Log, TransactionReceipt } from '@ethersproject/providers'
import { ChainId } from '../constants'
import { TokenAmount } from '../entities'
import { Portal, Synthesis } from './contracts'
import { SynthesizeRequestEvent } from './contracts/Portal'
import { BurnRequestEvent } from './contracts/Synthesis'
import { TypedEvent } from './contracts/common'
import type { Symbiosis } from './symbiosis'
import { BridgeDirection } from './types'
import { GetLogTimeoutExceededError, getExternalId, getLogWithTimeout } from './utils'
import { PendingRequest, PendingRequestState, PendingRequestType } from './revertRequest'

type EventArgs<Event> = Event extends TypedEvent<any, infer TArgsObject> ? TArgsObject : never

interface WaitForCompleteParams {
    symbiosis: Symbiosis
    chainIdOut: ChainId
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
    private readonly chainIdOut: ChainId
    private readonly revertableAddress: string
    private readonly chainIdIn: ChainId

    public constructor({ direction, symbiosis, chainIdOut, revertableAddress, chainIdIn }: WaitForCompleteParams) {
        this.direction = direction
        this.symbiosis = symbiosis
        this.chainIdOut = chainIdOut
        this.revertableAddress = revertableAddress
        this.chainIdIn = chainIdIn
    }

    public async waitForComplete(receipt: TransactionReceipt): Promise<Log> {
        const filter = this.buildOtherSideFilter(receipt)

        return getLogWithTimeout({
            symbiosis: this.symbiosis,
            chainId: this.chainIdOut,
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
        let contract: Synthesis | Portal
        let eventName: string
        if (this.direction === 'burn') {
            contract = this.symbiosis.synthesis(this.chainIdIn)
            eventName = 'BurnRequest'
        } else {
            contract = this.symbiosis.portal(this.chainIdIn)
            eventName = 'SynthesizeRequest'
        }

        let args: EventArgs<SynthesizeRequestEvent | BurnRequestEvent> | undefined
        receipt.logs.forEach((log) => {
            let event
            try {
                event = contract.interface.parseLog(log)
            } catch {
                return
            }

            if (event.name === eventName) {
                args = event.args as unknown as EventArgs<SynthesizeRequestEvent | BurnRequestEvent>
            }
        })

        return args
    }

    private buildOtherSideFilter(receipt: TransactionReceipt): EventFilter {
        if (!this.chainIdOut) {
            throw new Error('Tokens are not set')
        }

        const args = this.getRequestArgs(receipt)
        if (!args) {
            throw new Error('Log not found')
        }

        const requestId = args.id

        const receiveSide =
            this.direction === 'burn'
                ? this.symbiosis.portal(this.chainIdOut).address
                : this.symbiosis.synthesis(this.chainIdOut).address

        const externalId = getExternalId({
            internalId: requestId,
            contractAddress: receiveSide,
            revertableAddress: this.revertableAddress,
            chainId: this.chainIdOut,
        })

        const event =
            this.direction === 'burn'
                ? this.symbiosis.portal(this.chainIdOut).filters.BurnCompleted()
                : this.symbiosis.synthesis(this.chainIdOut).filters.SynthesizeCompleted()

        if (!event || !event.topics || event.topics.length === 0) {
            throw new Error('Event not found')
        }
        const topic0 = event.topics[0]

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

        const fromToken = this.symbiosis.findToken(tokenIdFrom, this.chainIdIn)
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
            revertChainId: chainId, // FIXME depends of type
            originalFromTokenAmount: fromTokenAmount, // FIXME depends of type
        }
    }
}
