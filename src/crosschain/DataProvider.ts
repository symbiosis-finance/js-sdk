import { ChainId } from 'src/constants'
import { Token } from 'src/entities'
import { NervePool__factory } from './contracts'
import { getMulticall } from './multicall'
import { Symbiosis } from './symbiosis'
import { UniLikeTrade } from './uniLikeTrade'

export class DataProvider {
    private cache = new Map<string, any>()

    constructor(private readonly symbiosis: Symbiosis) {}

    async getRepresentation(token: Token, chainId: ChainId) {
        return this.fromCache(['getRepresentation', token.address, chainId], () =>
            this.symbiosis.getRepresentation(token, chainId)
        )
    }

    async getTokensIndex(tokenIn: Token, tokenOut: Token, addresses: string[]) {
        return this.fromCache(['getTokenIndex', tokenIn.address, tokenIn.address, ...addresses], async () => {
            const nervePool = this.symbiosis.nervePool(tokenIn, tokenOut)
            const nervePoolInterface = NervePool__factory.createInterface()

            const calls = addresses.map((address) => ({
                target: nervePool.address,
                callData: nervePoolInterface.encodeFunctionData('getTokenIndex', [address]),
            }))

            const provider = this.symbiosis.getProvider(tokenIn.chainId)
            const multicall = await getMulticall(provider)

            const aggregateResult = await multicall.callStatic.aggregate(calls)

            const indexes = aggregateResult.returnData.map(
                (value) => nervePoolInterface.decodeFunctionResult('getTokenIndex', value)[0]
            )

            return indexes
        })
    }

    async getPairs(tokenIn: Token, tokenOut: Token) {
        return this.fromCache(['getPairs', tokenIn.address, tokenIn.address], () => {
            const provider = this.symbiosis.getProvider(tokenIn.chainId)

            return UniLikeTrade.getPairs(provider, tokenIn, tokenOut)
        })
    }

    private async fromCache<T>(key: (number | string)[], func: () => Promise<T>): Promise<T> {
        const stringKey = key.join('-')

        let value = this.cache.get(stringKey)
        if (value) {
            return value
        }

        value = await func()

        this.cache.set(stringKey, value)

        return value
    }
}
