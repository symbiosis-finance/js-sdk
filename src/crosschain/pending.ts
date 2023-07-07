import { utils } from 'ethers'
import { parseUnits } from '@ethersproject/units'
import { TokenAmount } from '../entities'
import { ChainId } from '../constants'
import { Portal, Synthesis } from './contracts'
import { SynthesizeRequestEvent } from './contracts/Portal'
import { BurnRequestEvent } from './contracts/Synthesis'
import type { Symbiosis } from './symbiosis'
import { getExternalId } from './utils'

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

interface GetChainPendingRequestsParams {
    symbiosis: Symbiosis
    activeChainId: ChainId
    chainsIds: ChainId[]
    address: string
    type: PendingRequestType
    synthesizeRequestFinder?: SynthesizeRequestFinder
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
    synthesizeRequestFinder?: SynthesizeRequestFinder
): Promise<SourceChainData | undefined> => {
    const synthesis = symbiosis.synthesis(symbiosis.defaultOmniPool.chainId)
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
            externalId
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
    originExternalId: string
): Promise<SynthesizeRequestEvent | undefined> => {
    const portal = symbiosis.portal(chainId)
    const eventFragment = portal.interface.getEvent('SynthesizeRequest')
    const topics = portal.interface.encodeFilterTopics(eventFragment, [
        undefined,
        undefined, // from
        symbiosis.defaultOmniPool.chainId, // chains IDs
        revertableAddress, // revertableAddress
    ])
    const blockOffset = symbiosis.filterBlockOffset(chainId)
    const toBlock = await portal.provider.getBlockNumber()
    const fromBlock = toBlock - blockOffset
    const events = await portal.queryFilter<SynthesizeRequestEvent>({ topics }, fromBlock, toBlock)

    const synthesis = symbiosis.synthesis(symbiosis.defaultOmniPool.chainId)
    return events.find((e) => {
        const { id } = e.args
        const externalId = getExternalId({
            internalId: id,
            contractAddress: synthesis.address,
            revertableAddress,
            chainId: symbiosis.defaultOmniPool.chainId,
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

const WINDOWS_COUNT = 3

export async function getChainPendingRequests({
    symbiosis,
    activeChainId,
    chainsIds,
    address,
    type,
    synthesizeRequestFinder,
}: GetChainPendingRequestsParams): Promise<PendingRequest[]> {
    const provider = symbiosis.getProvider(activeChainId)

    await provider.ready

    const otherChains = chainsIds.filter((chainId) => chainId !== activeChainId)

    const blockOffset = symbiosis.filterBlockOffset(activeChainId)

    const windows: { fromBlock: number; toBlock: number }[] = []

    let toBlock = await provider.getBlockNumber()

    while (toBlock !== 0 && windows.length < WINDOWS_COUNT) {
        const fromBlock = Math.max(toBlock - blockOffset, 0)

        windows.push({ fromBlock, toBlock })

        toBlock = Math.max(fromBlock - 1, 0)
    }

    let selectedContract: Portal | Synthesis
    let topics: (string | string[])[]
    if (['synthesize', 'synthesize-v2'].includes(type)) {
        selectedContract = symbiosis.portal(activeChainId)

        const eventFragment = selectedContract.interface.getEvent('SynthesizeRequest')

        topics = selectedContract.interface.encodeFilterTopics(eventFragment, [
            undefined,
            undefined, // from
            otherChains, // chains IDs
            address, // revertableAddress
        ])
    } else {
        // burn, burn-v2, burn-v2-revert
        selectedContract = symbiosis.synthesis(activeChainId)

        const eventFragment = selectedContract.interface.getEvent('BurnRequest')

        topics = selectedContract.interface.encodeFilterTopics(eventFragment, [
            undefined,
            type === 'burn-v2' ? symbiosis.metaRouter(symbiosis.defaultOmniPool.chainId).address : undefined, // from
            otherChains, // chains IDs
            address, // revertableAddress
        ])
    }

    const eventsByWindow = await Promise.all(
        windows.map(({ fromBlock, toBlock }) => {
            return selectedContract.queryFilter<BurnRequestEvent | SynthesizeRequestEvent>(
                { address, topics },
                fromBlock,
                toBlock
            )
        })
    )

    const events: SynthesizeRequestEvent[] | BurnRequestEvent[] = eventsByWindow.flat()

    const pendingRequests: (PendingRequest | null)[] = await Promise.all(
        events.map(async (event) => {
            const { id, amount: amountFrom, token: tokenAddressFrom, from, to, chainID, revertableAddress } = event.args

            const chainId = chainID.toNumber() as ChainId

            const fromToken = symbiosis.findStable(tokenAddressFrom, activeChainId)
            if (!fromToken) {
                return null
            }

            const fromTokenAmount = new TokenAmount(fromToken, amountFrom.toHexString())

            let contractAddress: string
            let getState: (externalId: string) => Promise<number>

            if (['synthesize', 'synthesize-v2'].includes(type)) {
                const synthesis = symbiosis.synthesis(chainId)
                contractAddress = synthesis.address
                getState = synthesis.synthesizeStates
            } else {
                const portal = symbiosis.portal(chainId)
                contractAddress = portal.address
                getState = portal.unsynthesizeStates
            }

            const externalId = getExternalId({
                internalId: id,
                contractAddress,
                revertableAddress,
                chainId,
            })

            const { state: otherState } = await selectedContract.requests(externalId)

            // The transaction was not sent from the sender network
            if (otherState !== PendingRequestState.Sent) {
                return null
            }

            const state = await getState(externalId)

            // The transaction still new/reverted in the receiver network
            if (state === PendingRequestState.Sent) {
                return null
            }

            const pendingRequest = {
                internalId: id,
                externalId,
                from,
                to,
                revertableAddress,
                fromTokenAmount,
                state,
                transactionHash: event.transactionHash,
                type,
                chainIdTo: chainId,
                chainIdFrom: activeChainId,
                status: 'new',
                transactionHashReverted: undefined,
                originalFromTokenAmount: fromTokenAmount,
                revertChainId: chainId,
            }
            if (type === 'burn-v2') {
                const data = await findSourceChainData(
                    symbiosis,
                    pendingRequest.chainIdFrom,
                    pendingRequest.chainIdTo,
                    pendingRequest.transactionHash,
                    pendingRequest.revertableAddress,
                    synthesizeRequestFinder
                )
                if (data) {
                    const { sourceChainId, fromAddress } = data
                    const sourceChainToken = await symbiosis.transitStable(sourceChainId, symbiosis.defaultOmniPool)
                    pendingRequest.from = fromAddress
                    pendingRequest.chainIdFrom = sourceChainToken.chainId
                    pendingRequest.fromTokenAmount = new TokenAmount(
                        sourceChainToken,
                        parseUnits(
                            pendingRequest.fromTokenAmount.toExact(sourceChainToken.decimals),
                            sourceChainToken.decimals
                        ).toString()
                    )
                } else {
                    const transitStable = await symbiosis.transitStable(
                        pendingRequest.chainIdTo,
                        symbiosis.defaultOmniPool
                    )
                    pendingRequest.type = 'burn-v2-revert'
                    pendingRequest.fromTokenAmount = new TokenAmount(transitStable, pendingRequest.fromTokenAmount.raw)
                }
            }
            if (type === 'synthesize-v2') {
                const isV2 = await isSynthesizeV2(symbiosis, pendingRequest.chainIdFrom, pendingRequest.transactionHash)
                if (isV2) {
                    pendingRequest.revertChainId = activeChainId
                } else {
                    pendingRequest.type = 'synthesize'
                }
            }

            return pendingRequest
        })
    )
    // Remove failed requests
    return pendingRequests.filter((pendingRequest): pendingRequest is PendingRequest => {
        return pendingRequest !== null
    })
}

export async function getPendingRequests(
    symbiosis: Symbiosis,
    address: string,
    synthesizeRequestFinder?: SynthesizeRequestFinder
): Promise<PendingRequest[]> {
    const chains = symbiosis.chains()
    const chainsIds = chains.map((chain) => chain.id)

    const pendingRequestsPromises: Promise<PendingRequest[]>[] = []

    chains.forEach((chain) => {
        const params: Omit<GetChainPendingRequestsParams, 'type'> = {
            symbiosis,
            chainsIds,
            activeChainId: chain.id,
            address,
            synthesizeRequestFinder,
        }

        pendingRequestsPromises.push(
            getChainPendingRequests({ ...params, type: 'synthesize-v2' }),
            getChainPendingRequests({ ...params, type: 'burn-v2' }),
            getChainPendingRequests({ ...params, type: 'synthesize' }),
            getChainPendingRequests({ ...params, type: 'burn' })
        )
    })

    try {
        const pendingRequests = await Promise.all(pendingRequestsPromises)
        return pendingRequests.flat().reduce((acc, r) => {
            const ids = acc.map((i) => i.internalId)
            if (ids.includes(r.internalId)) {
                return acc
            }
            return [...acc, r]
        }, [] as PendingRequest[])
    } catch (e) {
        console.error(e)
        return []
    }
}
