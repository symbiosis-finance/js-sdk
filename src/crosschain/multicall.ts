import { Provider } from '@ethersproject/providers'
import { ChainId } from '../constants'
import { MULTICALL_ADDRESSES } from './constants'
import { Multicall, Multicall__factory } from './contracts'

export class NoMulticallAddressError extends Error {
    public constructor(chainId: ChainId) {
        super(
            `Failed to create Multicall instance. We do not know the multicall address on this network. ChainId: ${chainId}`
        )
    }
}

export async function getMulticall(provider: Provider): Promise<Multicall> {
    const { chainId } = await provider.getNetwork()

    const address = MULTICALL_ADDRESSES[chainId as ChainId]

    if (!address) {
        throw new NoMulticallAddressError(chainId)
    }

    return Multicall__factory.connect(address, provider)
}
