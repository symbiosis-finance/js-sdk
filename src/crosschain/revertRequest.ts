import type { Symbiosis } from './symbiosis'
import { ChainId } from '../constants'
import { Portal__factory, Synthesis__factory } from './contracts'
import { TransactionReceipt } from '@ethersproject/providers'
import { LogDescription } from '@ethersproject/abi'
import { TokenAmount } from '../entities'
import { PendingRequest, PendingRequestState, PendingRequestType } from './pending'
import { getExternalId } from './utils'

export class RevertRequest {
    constructor(private symbiosis: Symbiosis, private chainId: ChainId, private transactionHash: string) {}

    async init({ validateState = false }: { validateState: boolean }): Promise<PendingRequest | null> {
        const provider = this.symbiosis.getProvider(this.chainId)
        await provider.ready

        const receipt = await provider.getTransactionReceipt(this.transactionHash)
        if (!receipt) {
            throw new Error(
                `Tx ${this.transactionHash} does not exist on chain ${this.chainId}. Provider ${provider.connection.url}`
            )
        }
        let type: PendingRequestType = 'synthesize'
        let log = this.findSynthesizeRequest(receipt)
        if (!log) {
            type = 'burn'
            log = this.findBurnRequest(receipt)
        }
        if (!log) {
            throw new Error('Tx does not contain mint/burn event and cannot be reverted')
        }

        const { id, amount, token: tokenAddress, from, to, chainID, revertableAddress } = log.args

        const chainIdTo = chainID.toNumber()

        let contractAddress
        if (type === 'synthesize') {
            contractAddress = this.symbiosis.synthesis(chainIdTo).address
        } else {
            contractAddress = this.symbiosis.portal(chainIdTo).address
        }

        const token = this.symbiosis.findStable(tokenAddress, this.chainId)
        if (!token) {
            throw new Error(`Cannot find token ${tokenAddress} at chain ${this.chainId}`)
        }

        const externalId = getExternalId({
            internalId: id,
            contractAddress,
            revertableAddress,
            chainId: chainIdTo,
        })

        let state = PendingRequestState.Default
        if (validateState) {
            if (type === 'synthesize') {
                state = await this.symbiosis.synthesis(chainIdTo).synthesizeStates(externalId)
            } else {
                state = await this.symbiosis.portal(chainIdTo).unsynthesizeStates(externalId)
            }
            if (state != 0) {
                throw new Error(`State is not Default (${state}). Tx cannot be reverted`)
            }
        }
        return {
            internalId: id,
            externalId,
            transactionHash: this.transactionHash,
            state,
            type,
            from,
            to,
            revertableAddress,
            chainIdFrom: this.chainId,
            chainIdTo,
            fromTokenAmount: new TokenAmount(token, amount),
        }
    }

    private findSynthesizeRequest(receipt: TransactionReceipt): LogDescription | null {
        const contract = Portal__factory.createInterface()
        const event = contract.events['SynthesizeRequest(bytes32,address,uint256,address,address,uint256,address)']

        const log = receipt.logs.find((log) => {
            const topic = contract.getEventTopic(event)
            return log.topics[0] === topic
        })
        if (!log) return null

        return contract.parseLog(log)
    }

    private findBurnRequest(receipt: TransactionReceipt): LogDescription | null {
        const contract = Synthesis__factory.createInterface()
        const burnRequest = contract.events['BurnRequest(bytes32,address,uint256,address,address,uint256,address)']
        const log = receipt.logs.find((log) => {
            const topic = contract.getEventTopic(burnRequest)
            return log.topics[0] === topic
        })

        if (!log) return null

        return contract.parseLog(log)
    }
}
