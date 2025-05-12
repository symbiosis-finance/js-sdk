import { SwapExactInParams, SwapExactInResult } from '../types'
import { Token } from '../../entities'
import { ChainId } from '../../constants'
import { theBest } from './utils'
import { ZappingThor } from '../swapping'

const ETH_USDC = new Token({
    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    chainId: ChainId.ETH_MAINNET,
    decimals: 6,
    name: 'USDC',
    symbol: 'USDC',
    icons: {
        large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/3408.png',
        small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/3408.png',
    },
})
const AVAX_USDC = new Token({
    address: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
    chainId: ChainId.AVAX_MAINNET,
    decimals: 6,
    name: 'USDC',
    symbol: 'USDC',
    icons: {
        large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/3408.png',
        small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/3408.png',
    },
})

export const THOR_TOKENS = [ETH_USDC, AVAX_USDC]

export async function thorChainSwap(context: SwapExactInParams): Promise<SwapExactInResult> {
    const { tokenAmountIn, from, to, symbiosis, slippage, deadline, selectMode, partnerAddress } = context

    // via stable pool only
    const poolConfig = symbiosis.config.omniPools[0]

    const promises = THOR_TOKENS.map((thorToken) => {
        const zappingThor = new ZappingThor(symbiosis, poolConfig)

        return zappingThor.exactIn({
            tokenAmountIn,
            thorTokenIn: thorToken,
            from,
            to,
            slippage,
            deadline,
            partnerAddress,
        })
    })

    return theBest(promises, selectMode)
}
