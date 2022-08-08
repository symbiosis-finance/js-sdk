import { AddressZero } from '@ethersproject/constants'
import { toUtf8String, toUtf8Bytes } from '@ethersproject/strings'
import { ChainId } from '../constants'
import { Token } from '../entities'
import { isNearChainId } from '../utils'
import { Symbiosis } from './symbiosis'

export async function getRepresentation(
    symbiosis: Symbiosis,
    token: Token,
    chainId: ChainId
): Promise<Token | undefined> {
    const needDecodeNearAddress = token.isSynthetic && !!token.chainFromId && isNearChainId(token.chainFromId)

    let representation: string

    try {
        if (isNearChainId(token.chainId)) {
            const fabric = symbiosis.fabricNonEvm(chainId)

            representation = await fabric.getSyntRepresentation(
                toUtf8Bytes(token.address) as unknown as string,
                token.chainId
            )
        } else if (needDecodeNearAddress) {
            const fabric = symbiosis.fabricNonEvm(token.chainId)

            representation = await fabric.getRealRepresentation(token.address)
        } else if (token.isSynthetic) {
            const fabric = symbiosis.fabric(token.chainId)

            representation = await fabric.getRealRepresentation(token.address)
        } else {
            const fabric = symbiosis.fabric(chainId)

            representation = await fabric.getSyntRepresentation(token.address, token.chainId)
        }

        if (representation === AddressZero) {
            return undefined
        }

        if (needDecodeNearAddress) {
            representation = toUtf8String(representation)
        }

        return symbiosis.findStable(representation, chainId)
    } catch {
        return undefined
    }
}
