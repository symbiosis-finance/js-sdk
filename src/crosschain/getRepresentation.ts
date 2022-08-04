import { AddressZero } from '@ethersproject/constants'
import { toUtf8String } from '@ethersproject/strings'
import { ChainId } from '../constants'
import { Token } from '../entities'
import { isNearChainId } from '../utils'
import { Fabric, SyntFabricNonEvm } from './contracts'
import { Symbiosis } from './symbiosis'

export async function getRepresentation(
    symbiosis: Symbiosis,
    token: Token,
    chainId: ChainId
): Promise<Token | undefined> {
    const fabricChainId = token.isSynthetic ? token.chainId : chainId

    let fabric: Fabric | SyntFabricNonEvm
    let isFromNear = false

    if (token.isSynthetic && token.chainFromId && isNearChainId(token.chainFromId)) {
        isFromNear = true
        fabric = symbiosis.fabricNonEvm(fabricChainId)
    } else {
        fabric = symbiosis.fabric(fabricChainId)
    }

    try {
        let representation: string
        if (token.isSynthetic) {
            representation = await fabric.getRealRepresentation(token.address)
        } else {
            representation = await fabric.getSyntRepresentation(token.address, token.chainId)
        }

        if (representation === AddressZero) {
            return undefined
        }

        if (isFromNear) {
            representation = toUtf8String(representation)
        }

        return symbiosis.findStable(representation, chainId)
    } catch {
        return undefined
    }
}
