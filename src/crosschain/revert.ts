import { Filter, TransactionRequest } from '@ethersproject/providers'
import { ContractTransaction, Signer } from 'ethers'
import JSBI from 'jsbi'
import { TokenAmount } from '../entities'
import { Error, ErrorCode } from './error'
import { PendingRequest } from './pending'
import type { Symbiosis } from './symbiosis'
import { calculateGasMargin, getExternalId, getLogWithTimeout } from './utils'

export class RevertPending {
    constructor(private symbiosis: Symbiosis, private request: PendingRequest) {}

    async revert() {
        const fee = await this.getFee()

        const transactionRequest = this.getTransactionRequest(fee)

        return {
            fee,
            transactionRequest,
            execute: (signer: Signer) => this.execute(transactionRequest, signer),
        }
    }

    // Wait for the revert transaction to be mined on the original chain
    async waitForComplete() {
        const { chainIdFrom, type } = this.request

        const externalId = this.getExternalId()

        let filter: Filter
        if (type === 'synthesize') {
            const otherPortal = this.symbiosis.portal(chainIdFrom)
            filter = otherPortal.filters.RevertSynthesizeCompleted(externalId)
        } else {
            const otherSynthesis = this.symbiosis.synthesis(chainIdFrom)
            filter = otherSynthesis.filters.RevertBurnCompleted(externalId)
        }

        const log = await getLogWithTimeout({ chainId: chainIdFrom, filter, symbiosis: this.symbiosis })

        return log.transactionHash
    }

    private async getFee() {
        const { type, chainIdTo, chainIdFrom } = this.request

        const externalId = this.getExternalId()

        let receiveSide: string
        let calldata: string

        if (type === 'synthesize') {
            const portal = this.symbiosis.portal(chainIdFrom)
            calldata = portal.interface.encodeFunctionData('revertSynthesize', ['0', externalId])
            receiveSide = portal.address
        } else {
            const synthesis = this.symbiosis.synthesis(chainIdFrom)
            calldata = synthesis.interface.encodeFunctionData('revertBurn', ['0', externalId])
            receiveSide = synthesis.address
        }

        const fee = await this.symbiosis.getBridgeFee({
            receiveSide,
            calldata,
            chainIdFrom: chainIdTo,
            chainIdTo: chainIdFrom,
        })

        const feeTokenAmount = new TokenAmount(this.request.fromTokenAmount.token, fee.toString())
        if (this.request.fromTokenAmount.lessThan(feeTokenAmount)) {
            throw new Error(
                `Amount $${this.request.fromTokenAmount.toSignificant()} less than fee $${feeTokenAmount.toSignificant()}`,
                ErrorCode.AMOUNT_LESS_THAN_FEE
            )
        }

        return fee
    }

    private getTransactionRequest(fee: JSBI): TransactionRequest {
        if (this.request.type === 'synthesize') {
            return this.getRevertSynthesizeTransactionRequest(fee)
        }

        return this.getRevertBurnTransactionRequest(fee)
    }

    private getRevertSynthesizeTransactionRequest(fee: JSBI): TransactionRequest {
        const { internalId, chainIdTo, chainIdFrom } = this.request

        const synthesis = this.symbiosis.synthesis(chainIdTo)
        const otherPortal = this.symbiosis.portal(chainIdFrom)
        const otherBridge = this.symbiosis.bridge(chainIdFrom)

        return {
            to: synthesis.address,
            data: synthesis.interface.encodeFunctionData('revertSynthesizeRequest', [
                fee.toString(),
                internalId,
                otherPortal.address,
                otherBridge.address,
                chainIdFrom,
                this.symbiosis.clientId,
            ]),
            chainId: chainIdTo,
        }
    }

    private getRevertBurnTransactionRequest(fee: JSBI): TransactionRequest {
        const { internalId, chainIdTo, chainIdFrom } = this.request

        const otherBridge = this.symbiosis.bridge(chainIdFrom)
        const portal = this.symbiosis.portal(chainIdTo)
        const otherSynthesis = this.symbiosis.synthesis(chainIdFrom)

        return {
            to: portal.address,
            data: portal.interface.encodeFunctionData('revertBurnRequest', [
                fee.toString(),
                internalId,
                otherSynthesis.address,
                otherBridge.address,
                chainIdFrom,
                this.symbiosis.clientId,
            ]),
            chainId: chainIdTo,
        }
    }

    private async execute(transactionRequest: TransactionRequest, signer: Signer) {
        const transactionRequestWithGasLimit = { ...transactionRequest }

        const gasLimit = await signer.estimateGas(transactionRequest)

        transactionRequestWithGasLimit.gasLimit = calculateGasMargin(gasLimit)

        const transaction = await signer.sendTransaction(transactionRequestWithGasLimit)

        return {
            waitForMined: (confirmations = 1) => this.waitForMined(confirmations, transaction),
            transaction,
        }
    }

    private async waitForMined(confirmations: number, response: ContractTransaction) {
        const receipt = await response.wait(confirmations)

        return {
            receipt,
            waitForComplete: () => this.waitForComplete(),
        }
    }

    private getExternalId(): string {
        const { type, internalId, chainIdTo: chainId, revertableAddress } = this.request

        let contractAddress: string
        if (type === 'synthesize') {
            contractAddress = this.symbiosis.synthesis(chainId).address
        } else {
            contractAddress = this.symbiosis.portal(chainId).address
        }

        return getExternalId({ internalId, chainId, revertableAddress, contractAddress })
    }
}
