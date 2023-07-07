import { parseUnits } from '@ethersproject/units'
import type { Symbiosis } from './symbiosis'
import { ChainId } from '../constants'
import { Portal__factory, Synthesis__factory } from './contracts'
import { TransactionReceipt } from '@ethersproject/providers'
import { LogDescription } from '@ethersproject/abi'
import { TokenAmount } from '../entities'
import {
    findSourceChainData,
    isSynthesizeV2,
    PendingRequest,
    PendingRequestState,
    PendingRequestType,
    SynthesizeRequestFinder,
} from './pending'
import { getExternalId } from './utils'
import { OmniPoolConfig } from './types'

type InitProps = {
    validateState: boolean
    synthesizeRequestFinder?: SynthesizeRequestFinder
}

export class RevertRequest {
    constructor(private symbiosis: Symbiosis, private chainId: ChainId, private transactionHash: string) {}

    async init({ validateState = false, synthesizeRequestFinder }: InitProps): Promise<PendingRequest | null> {
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

        const { id, amount, token: tokenAddress, from: fromOrigin, to, chainID, revertableAddress } = log.args
        const chainIdTo = chainID.toNumber()
        let chainIdFrom = this.chainId
        let from = fromOrigin

        const token = this.symbiosis.findStable(tokenAddress, this.chainId)
        if (!token) {
            throw new Error(`Cannot find token ${tokenAddress} at chain ${this.chainId}`)
        }
        let fromTokenAmount = new TokenAmount(token, amount)
        const originalFromTokenAmount = fromTokenAmount

        // FIXME
        const omniPoolConfig: OmniPoolConfig | undefined = this.symbiosis.defaultOmniPool
        // this.symbiosis.config.omniPools.find((config) => {
        //     return (
        //         config.chainId === token.chainId &&
        //         !!config.tokens.find((token) => token.address.toLowerCase() === tokenAddress.toLowerCase())
        //     )
        // })

        if (!omniPoolConfig) {
            throw new Error(`Cannot find omni pool config for chain ${chainIdTo} with token ${tokenAddress}`)
        }

        if (type === 'synthesize') {
            const isV2 = await isSynthesizeV2(this.symbiosis, this.chainId, receipt.transactionHash)
            if (isV2) {
                type = 'synthesize-v2'
            }
        }

        if (type === 'burn') {
            const metaRouterAddress = this.symbiosis.metaRouter(omniPoolConfig.chainId).address
            if (from.toLowerCase() === metaRouterAddress.toLowerCase()) {
                type = 'burn-v2'
                const data = await findSourceChainData(
                    this.symbiosis,
                    this.chainId,
                    chainIdTo,
                    receipt.transactionHash,
                    revertableAddress,
                    synthesizeRequestFinder
                )
                if (data) {
                    const { sourceChainId, fromAddress } = data
                    from = fromAddress
                    const sourceChainToken = await this.symbiosis.transitStable(sourceChainId, omniPoolConfig)
                    chainIdFrom = sourceChainToken.chainId
                    fromTokenAmount = new TokenAmount(
                        sourceChainToken,
                        parseUnits(
                            fromTokenAmount.toExact(sourceChainToken.decimals),
                            sourceChainToken.decimals
                        ).toString()
                    )
                } else {
                    const transitStable = await this.symbiosis.transitStable(chainIdTo, omniPoolConfig)
                    type = 'burn-v2-revert'
                    fromTokenAmount = new TokenAmount(transitStable, fromTokenAmount.raw)
                }
            }
        }

        let contractAddress
        if (['synthesize', 'synthesize-v2'].includes(type)) {
            contractAddress = this.symbiosis.synthesis(chainIdTo).address
        } else {
            contractAddress = this.symbiosis.portal(chainIdTo).address
        }

        const externalId = getExternalId({
            internalId: id,
            contractAddress,
            revertableAddress,
            chainId: chainIdTo,
        })

        let state = PendingRequestState.Default
        if (validateState) {
            if (['synthesize', 'synthesize-v2'].includes(type)) {
                state = await this.symbiosis.synthesis(chainIdTo).synthesizeStates(externalId)
            } else {
                state = await this.symbiosis.portal(chainIdTo).unsynthesizeStates(externalId)
            }
            if (state === 1) {
                throw new Error(`Tx is success and cannot be reverted.`)
            }
        }

        let revertChainId = chainIdTo
        if (type === 'synthesize-v2') {
            revertChainId = this.chainId
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
            chainIdFrom,
            chainIdTo,
            fromTokenAmount,
            revertChainId,
            originalFromTokenAmount,
        }
    }

    private findSynthesizeRequest(receipt: TransactionReceipt): LogDescription | null {
        const contract = Portal__factory.createInterface()
        const event = contract.events['SynthesizeRequest(bytes32,address,uint256,address,address,uint256,address)']

        const log = receipt.logs.find((log) => {
            const topic = contract.getEventTopic(event)
            return log.topics[0].toLowerCase() === topic.toLowerCase()
        })
        if (!log) return null

        return contract.parseLog(log)
    }

    private findBurnRequest(receipt: TransactionReceipt): LogDescription | null {
        const contract = Synthesis__factory.createInterface()
        const burnRequest = contract.events['BurnRequest(bytes32,address,uint256,address,address,uint256,address)']
        const log = receipt.logs.find((log) => {
            const topic = contract.getEventTopic(burnRequest)
            return log.topics[0].toLowerCase() === topic.toLowerCase()
        })

        if (!log) return null

        return contract.parseLog(log)
    }
}
