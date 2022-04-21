import { ChainId } from '../constants'
import { Token } from '../entities'
import { Symbiosis } from './symbiosis'
import { AddressZero } from '@ethersproject/constants'
import { parseBytes32String } from '@ethersproject/strings'
import { isTerraChainId } from '../utils'
import { Error } from './error'
import { getTerraTokenFullAddress } from './utils'

export async function getRepresentation(
    symbiosis: Symbiosis,
    token: Token,
    chainId: ChainId
): Promise<Token | undefined> {
    const fabricChainId = token.isSynthetic ? token.chainId : chainId

    if (isTerraChainId(fabricChainId)) {
        throw new Error('Fabric for Terra is not supported yet')
    }

    const isNonEvm = token.isFromTerra() || (token.chainFromId && isTerraChainId(token.chainFromId))

    const fabric = isNonEvm ? symbiosis.fabricNonEnv(fabricChainId) : symbiosis.fabric(fabricChainId)

    try {
        let representation: string
        if (token.isSynthetic) {
            representation = await fabric.getRealRepresentation(token.address)

            if (isNonEvm) {
                representation = parseBytes32String(representation).replace('\x00', '').replace('\x01', '')
            }
        } else {
            let address: string
            if (token.isFromTerra()) {
                address = getTerraTokenFullAddress(token)
            } else {
                address = token.address
            }

            representation = await fabric.getSyntRepresentation(address, token.chainId)
        }

        console.log('rep', representation, chainId)

        if (representation === AddressZero) {
            return undefined
        }

        const stable = symbiosis.findStable(representation, chainId)
        console.log('s', stable)
        return stable
    } catch (e) {
        console.log(e)
        return undefined
    }
}
