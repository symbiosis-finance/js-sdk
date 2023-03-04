import { ChainId } from '../constants'
import { Token } from '../entities'
import { Symbiosis } from './symbiosis'
import { AddressZero } from '@ethersproject/constants'

export async function getRepresentation(
    symbiosis: Symbiosis,
    token: Token,
    chainId: ChainId
): Promise<Token | undefined> {
    const fabricChainId = token.isSynthetic ? token.chainId : chainId
    const fabric = symbiosis.fabric(fabricChainId)

    try {
        let representation: string
        if (token.isSynthetic) {
            representation = await fabric.getRealRepresentation(token.address)
        } else {
            representation = await fabric.getSyntRepresentation(token.address, token.chainId)
        }

        if (representation === AddressZero) {
            console.error(`Error while getting representation of ${token.address} in chain ${chainId}: Address is zero`)
            return undefined
        }

        return symbiosis.findStable(representation, chainId)
    } catch (e) {
        console.error(`Error while getting representation of ${token.address} in chain ${chainId}`, e)
        return undefined
    }
}
