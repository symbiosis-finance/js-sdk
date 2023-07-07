import { Symbiosis } from '../symbiosis'
import { AddressZero } from '@ethersproject/constants/lib/addresses'
import { TokenConstructor } from '../../constants'
import { getMulticall } from '../multicall'

type TokenPair = {
    real: TokenConstructor
    synth?: TokenConstructor
}

export class CacheBuilder {
    private tokenPairs: TokenPair[] = []

    public constructor(private readonly symbiosis: Symbiosis) {}

    public chainsWithFabric() {
        return this.symbiosis.config.chains.filter((chain) => chain.fabric !== AddressZero)
    }

    public async loadTokenPairs() {
        const chainsWithFabric = this.chainsWithFabric()
        const stables = this.symbiosis.stables()

        for (let i = 0; i < chainsWithFabric.length; i++) {
            const chainWithFabric = chainsWithFabric[i]

            const fabric = this.symbiosis.fabric(chainWithFabric.id)

            const multicall = await getMulticall(fabric.provider)

            const representationsResults = await multicall.callStatic.tryAggregate(
                false,
                stables.map((token) => ({
                    target: fabric.address,
                    callData: fabric.interface.encodeFunctionData('getSyntRepresentation', [
                        token.address,
                        token.chainId,
                    ]),
                }))
            )
            representationsResults.forEach(([success, returnData], index) => {
                if (!success) {
                    this.tokenPairs.push({
                        real: stables[index],
                        synth: undefined,
                    })
                    return
                }

                const synthAddress = fabric.interface.decodeFunctionResult(
                    'getSyntRepresentation',
                    returnData
                ) as unknown as string

                this.tokenPairs.push({
                    real: stables[index],
                    synth: {
                        ...stables[index],
                        symbol: `s${stables[index].symbol}`,
                        address: synthAddress,
                        chainId: chainWithFabric.id,
                        chainFromId: stables[index].chainId,
                    },
                })
            })
        }
    }
}
