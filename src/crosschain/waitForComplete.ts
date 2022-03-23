import { EventFilter } from '@ethersproject/contracts'
import { Log, TransactionReceipt } from '@ethersproject/providers'
import { getLogWithTimeout } from './utils'
import { Token } from '../entities'
import type { Symbiosis } from './symbiosis'
import { BridgeDirection } from './types'
import { getExternalId } from './utils'

interface WaitForCompleteParams {
    symbiosis: Symbiosis
    tokenOut: Token
    direction: BridgeDirection
    revertableAddress: string
}

// TODO: Rework to pure functions and move to utils
export class WaitForComplete {
    private readonly direction: BridgeDirection
    private readonly symbiosis: Symbiosis
    private readonly tokenOut: Token
    private readonly revertableAddress: string

    public constructor({ direction, symbiosis, tokenOut, revertableAddress }: WaitForCompleteParams) {
        this.direction = direction
        this.symbiosis = symbiosis
        this.tokenOut = tokenOut
        this.revertableAddress = revertableAddress
    }

    public async waitForComplete(receipt: TransactionReceipt): Promise<Log> {
        const filter = this.buildOtherSideFilter(receipt)

        return getLogWithTimeout({
            symbiosis: this.symbiosis,
            chainId: this.tokenOut.chainId,
            filter,
        })
    }

    private buildOtherSideFilter(receipt: TransactionReceipt): EventFilter {
        if (!this.tokenOut) {
            throw new Error('Tokens are not set')
        }

        const requestId = this.getRequestId(receipt)

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

        const event =
            this.direction === 'burn'
                ? this.symbiosis.portal(this.tokenOut.chainId).filters.BurnCompleted()
                : this.symbiosis.synthesis(this.tokenOut.chainId).filters.SynthesizeCompleted()

        if (!event || !event.topics || event.topics.length === 0) {
            throw new Error('Event not found')
        }
        const topic0 = event.topics[0]

        return {
            address: receiveSide,
            topics: [topic0, externalId],
        }
    }

    private getRequestId(receipt: TransactionReceipt): string {
        if (!this.tokenOut) {
            throw new Error('Tokens are not set')
        }

        const event =
            this.direction === 'burn'
                ? this.symbiosis.synthesis(this.tokenOut.chainId).filters.BurnRequest()
                : this.symbiosis.portal(this.tokenOut.chainId).filters.SynthesizeRequest()

        if (!event || !event.topics || event.topics.length === 0) {
            throw new Error('Event not found')
        }
        const topic0 = event.topics[0]

        const log = receipt.logs.find((i) => i.topics[0] === topic0)
        if (!log) {
            throw new Error('Log not found')
        }

        const chunks = log.data.slice(2).match(/.{1,64}/g)
        if (!chunks || chunks.length === 0) {
            throw new Error('RequestId not found')
        }

        return `0x${chunks[0]}`
    }
}
