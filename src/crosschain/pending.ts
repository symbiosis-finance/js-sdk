import { TokenAmount } from '../entities'
import { ChainId } from '../constants'
import { Portal, Synthesis } from './contracts'
import { SynthesizeRequestEvent } from './contracts/Portal'
import { BurnRequestEvent } from './contracts/Synthesis'
import type { Symbiosis } from './symbiosis'
import { getExternalId } from './utils'
import { MANAGER_CHAIN } from './constants'

export enum PendingRequestState {
    Default = 0,
    Sent,
    Reverted,
}

export type PendingRequestType = 'burn' | 'synthesize' | 'v2'

export interface PendingRequest {
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
}

interface GetChainPendingRequestsParams {
    symbiosis: Symbiosis
    activeChainId: ChainId
    chainsIds: ChainId[]
    address: string
    type: PendingRequestType
}

const WINDOWS_COUNT = 3

export async function getChainPendingRequests({
    symbiosis,
    activeChainId,
    chainsIds,
    address,
    type,
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
    if (type === 'synthesize') {
        selectedContract = symbiosis.portal(activeChainId)

        const eventFragment = selectedContract.interface.getEvent('SynthesizeRequest')

        topics = selectedContract.interface.encodeFilterTopics(eventFragment, [
            undefined,
            undefined, // from
            otherChains, // chains IDs
            address, // revertableAddress
        ])
    } else {
        selectedContract = symbiosis.synthesis(activeChainId)

        const eventFragment = selectedContract.interface.getEvent('BurnRequest')

        topics = selectedContract.interface.encodeFilterTopics(eventFragment, [
            undefined,
            type === 'v2' ? symbiosis.metaRouter(MANAGER_CHAIN).address : undefined, // from
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
            try {
                const { id, amount: amountFrom, token: tokenIdFrom, from, to, chainID, revertableAddress } = event.args

                const chainId = chainID.toNumber() as ChainId

                console.log({ chainId, activeChainId })

                const fromToken = symbiosis.findStable(tokenIdFrom, activeChainId)
                if (!fromToken) {
                    return null
                }

                const fromTokenAmount = new TokenAmount(fromToken, amountFrom.toHexString())

                let contractAddress: string
                let getState: (externalId: string) => Promise<number>

                if (type === 'synthesize') {
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

                return {
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
                }
            } catch {
                // TODO: Capture errors?
                return null
            }
        })
    )

    // Remove failed requests
    return pendingRequests.filter((pendingRequest): pendingRequest is PendingRequest => {
        return pendingRequest !== null
    })
}

export async function getPendingRequests(symbiosis: Symbiosis, address: string): Promise<PendingRequest[]> {
    const chains = symbiosis.chains()
    const chainsIds = chains.map((chain) => chain.id)

    const pendingRequestsPromises: Promise<PendingRequest[]>[] = []

    chains.forEach((chain) => {
        const params: Omit<GetChainPendingRequestsParams, 'type'> = {
            symbiosis,
            chainsIds,
            activeChainId: chain.id,
            address,
        }

        pendingRequestsPromises.push(
            getChainPendingRequests({ ...params, type: 'synthesize' }).catch(() => {
                return []
            }),
            getChainPendingRequests({ ...params, type: 'v2' }).catch(() => {
                return []
            }),
            getChainPendingRequests({ ...params, type: 'burn' }).catch(() => {
                return []
            })
        )
    })

    const pendingRequests = await Promise.all(pendingRequestsPromises)

    return pendingRequests.flat().reduce((acc, r) => {
        const ids = acc.map((i) => i.internalId)
        if (ids.includes(r.internalId)) {
            return acc
        }
        return [...acc, r]
    }, [] as PendingRequest[])
}
