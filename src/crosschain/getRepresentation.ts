import { AddressZero } from '@ethersproject/constants'
import { ChainId } from '../constants'
import { Token, wrappedToken } from '../entities'
import { Symbiosis } from './symbiosis'
import { isTronToken, tronAddressToEvm } from './tron'

export async function getRepresentation(
    symbiosis: Symbiosis,
    token: Token,
    chainId: ChainId
): Promise<Token | undefined> {
    const fabricChainId = token.isSynthetic ? token.chainId : chainId
    const fabric = symbiosis.fabric(fabricChainId)

    if (fabric.address === AddressZero) {
        return undefined
    }

    const wrapped = wrappedToken(token)
    let tokenAddress
    if (isTronToken(wrapped)) {
        tokenAddress = tronAddressToEvm(wrapped.address)
    } else {
        tokenAddress = wrapped.address
    }

    try {
        let representation: string
        if (token.isSynthetic) {
            representation = await fabric.getRealRepresentation(tokenAddress)
        } else {
            representation = await fabric.getSyntRepresentation(tokenAddress, wrapped.chainId)
        }

        if (representation === AddressZero) {
            return undefined
        }

        return symbiosis.findToken(representation, chainId)
    } catch (e) {
        console.error(`Error while getting representation of ${token.address} in chain ${chainId}`, e)
        return undefined
    }
}
