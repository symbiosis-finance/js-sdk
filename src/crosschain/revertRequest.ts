import { parseUnits } from '@ethersproject/units'
import type { Symbiosis } from './symbiosis'
import { ChainId } from '../constants'
import { Portal__factory, Synthesis__factory } from './contracts'
import { TransactionReceipt } from '@ethersproject/providers'
import { LogDescription } from '@ethersproject/abi'
import { TokenAmount } from '../entities'
import { getExternalId } from './utils'
import { SynthesizeRequestEvent } from './contracts/Portal'
import { utils } from 'ethers'
import { OmniPoolConfig } from './types'
import { Error, ErrorCode } from './error'

type InitProps = {
    validateState: boolean
    synthesizeRequestFinder?: SynthesizeRequestFinder
}

export enum PendingRequestState {
    Default = 0,
    Sent,
    Reverted,
}

export type PendingRequestType = 'burn' | 'synthesize' | 'burn-v2' | 'burn-v2-revert' | 'synthesize-v2'

export interface PendingRequest {
    originalFromTokenAmount: TokenAmount
    fromTokenAmount: TokenAmount
    transactionHash: string
    state: PendingRequestState
    internalId: string
    externalId: string
    type: PendingRequestType
    from: string
    to: string
    revertableAddress: string
    chainIdFrom: ChainId
    chainIdTo: ChainId
    revertChainId: ChainId
}

export interface SourceChainData {
    fromAddress: string
    sourceChainId: ChainId
}
export type SynthesizeRequestFinder = (externalId: string) => Promise<SourceChainData | undefined>

export const findSourceChainData = async (
    symbiosis: Symbiosis,
    chainIdFrom: ChainId,
    chainIdTo: ChainId,
    txHash: string,
    revertableAddress: string,
    omniPoolConfig: OmniPoolConfig,
    synthesizeRequestFinder?: SynthesizeRequestFinder
): Promise<SourceChainData | undefined> => {
    const synthesis = symbiosis.synthesis(omniPoolConfig.chainId)
    const filter = synthesis.filters.SynthesizeCompleted()
    const tx = await synthesis.provider.getTransactionReceipt(txHash)
    const foundSynthesizeCompleted = tx.logs.find((i) => {
        return i.topics[0] === filter.topics?.[0]
    })
    if (!foundSynthesizeCompleted) return undefined
    const externalId = foundSynthesizeCompleted.topics?.[1]

    let sourceChainId = undefined
    let fromAddress = undefined
    const chains = symbiosis.chains()
    for (let i = 0; i < chains.length; i++) {
        const chainId = chains[i].id
        if (chainId === chainIdFrom || chainId === chainIdTo) {
            continue
        }
        const foundSynthesizeRequest = await findSynthesizeRequestOnChain(
            symbiosis,
            chainId,
            revertableAddress,
            externalId,
            omniPoolConfig
        )
        if (foundSynthesizeRequest !== undefined) {
            sourceChainId = chainId
            fromAddress = foundSynthesizeRequest.args.from
            break
        }
    }

    if (!fromAddress && synthesizeRequestFinder) {
        const data = await synthesizeRequestFinder(externalId)
        sourceChainId = data?.sourceChainId
        fromAddress = data?.fromAddress
    }

    if (!fromAddress || !sourceChainId) {
        return
    }

    return {
        sourceChainId,
        fromAddress,
    }
}

const findSynthesizeRequestOnChain = async (
    symbiosis: Symbiosis,
    chainId: ChainId,
    revertableAddress: string,
    originExternalId: string,
    omniPoolConfig: OmniPoolConfig
): Promise<SynthesizeRequestEvent | undefined> => {
    const portal = symbiosis.portal(chainId)
    const eventFragment = portal.interface.getEvent('SynthesizeRequest')
    const topics = portal.interface.encodeFilterTopics(eventFragment, [
        undefined,
        undefined, // from
        omniPoolConfig.chainId, // chains IDs
        revertableAddress, // revertableAddress
    ])
    const blockOffset = symbiosis.filterBlockOffset(chainId)
    const toBlock = await portal.provider.getBlockNumber()
    const fromBlock = toBlock - blockOffset
    const events = await portal.queryFilter<SynthesizeRequestEvent>({ topics }, fromBlock, toBlock)

    const synthesis = symbiosis.synthesis(omniPoolConfig.chainId)
    return events.find((e) => {
        const { id } = e.args
        const externalId = getExternalId({
            internalId: id,
            contractAddress: synthesis.address,
            revertableAddress,
            chainId: omniPoolConfig.chainId,
        })
        return originExternalId === externalId
    })
}

export const isSynthesizeV2 = async (symbiosis: Symbiosis, chainId: ChainId, txHash: string): Promise<boolean> => {
    const id = utils.id(
        'metaBurnSyntheticToken((uint256,uint256,address,address,address,bytes,uint256,address,address,address,address,uint256,bytes32))'
    )
    const hash = id.slice(2, 10)
    const tx = await symbiosis.getProvider(chainId).getTransaction(txHash)

    return tx.data.includes(hash)
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

        const token = this.symbiosis.findToken(tokenAddress, this.chainId)
        if (!token) {
            throw new Error(`Cannot find token ${tokenAddress} at chain ${this.chainId}`)
        }
        const omniPoolConfig = this.symbiosis.getOmniPoolByToken(token)
        if (!omniPoolConfig) {
            throw new Error(
                `Cannot find omni pool config for chain ${chainIdTo} with token ${tokenAddress}`,
                ErrorCode.NO_TRANSIT_POOL
            )
        }

        let fromTokenAmount = new TokenAmount(token, amount)
        const originalFromTokenAmount = fromTokenAmount

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
                    omniPoolConfig,
                    synthesizeRequestFinder
                )
                if (data) {
                    const { sourceChainId, fromAddress } = data
                    from = fromAddress
                    const sourceChainToken = await this.symbiosis.transitToken(sourceChainId, omniPoolConfig)
                    chainIdFrom = sourceChainToken.chainId
                    fromTokenAmount = new TokenAmount(
                        sourceChainToken,
                        parseUnits(
                            fromTokenAmount.toExact(sourceChainToken.decimals),
                            sourceChainToken.decimals
                        ).toString()
                    )
                } else {
                    const transitToken = await this.symbiosis.transitToken(chainIdTo, omniPoolConfig)
                    type = 'burn-v2-revert'
                    fromTokenAmount = new TokenAmount(transitToken, fromTokenAmount.raw)
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
