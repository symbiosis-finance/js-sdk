import { ChainId } from '../constants'
import { Token, wrappedToken } from '../entities'
import { Symbiosis } from './symbiosis'
import { AddressZero } from '@ethersproject/constants'

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

    try {
        let representation: string
        if (token.isSynthetic) {
            representation = await fabric.getRealRepresentation(wrapped.address)
        } else {
            representation = await fabric.getSyntRepresentation(wrapped.address, wrapped.chainId)
        }

        console.log('token', representation)

        if (representation === AddressZero) {
            return undefined
        }

        return symbiosis.findStable(representation, chainId)
    } catch (e) {
        console.error(`Error while getting representation of ${token.address} in chain ${chainId}`, e)
        return undefined
    }
}
