import { ChainId } from '../constants'
import { Token } from '../entities'
import { Symbiosis } from './symbiosis'
import { AddressZero } from '@ethersproject/constants'
import { isTerraChainId } from '../utils'
import { Error } from './error'
import { encodeTerraAddressToEvmAddress, parseBytesTerraAddressString } from './utils'

export async function getRepresentation(
    symbiosis: Symbiosis,
    token: Token,
    chainId: ChainId
): Promise<Token | undefined> {
    const fabricChainId = token.isSynthetic ? token.chainId : chainId

    if (isTerraChainId(fabricChainId)) {
        throw new Error('Fabric for Terra is not supported yet')
    }

    const fabric = symbiosis.fabric(fabricChainId)

    try {
        let representation: string
        if (token.isSynthetic) {
            console.log(token.symbol, token.address)
            representation = await fabric.getRealRepresentation(token.address)

            if (token.chainFromId && isTerraChainId(token.chainFromId)) {
                representation = parseBytesTerraAddressString(representation)
            }
        } else {
            let address: string
            if (token.isFromTerra()) {
                address = encodeTerraAddressToEvmAddress(token)
            } else {
                address = token.address
            }

            representation = await fabric.getSyntRepresentation(address, token.chainId)
        }

        if (representation === AddressZero) {
            return undefined
        }

        return symbiosis.findStable(representation, chainId)
    } catch (e) {
        console.log(e)
        return undefined
    }
}
