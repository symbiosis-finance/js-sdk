import { SwapExactInParams, SwapExactInResult } from '../types'
import { Token } from '../../entities'
import { ChainId } from '../../constants'
import { theBest } from './utils'
import { ZappingChainFlip } from '../swapping/zappingChainFlip'

const ARB_USDC = new Token({
    address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    chainId: ChainId.ARBITRUM_MAINNET,
    decimals: 6,
    name: 'USDC',
    symbol: 'USDC',
    icons: {
        large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/3408.png',
        small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/3408.png',
    },
})

export const CHAIN_FLIP_TOKENS = [ARB_USDC]

export async function chainFlipSwap(context: SwapExactInParams): Promise<SwapExactInResult> {
    const { tokenAmountIn, from, to, symbiosis, slippage, deadline, selectMode } = context

    // via stable pool only
    const poolConfig = symbiosis.config.omniPools[0]

    const promises = CHAIN_FLIP_TOKENS.map((chainFlipToken) => {
        const zappingChainFlip = new ZappingChainFlip(symbiosis, poolConfig)

        return zappingChainFlip.exactIn({
            tokenAmountIn,
            chainFlipTokenIn: chainFlipToken,
            from,
            to,
            slippage,
            deadline,
        })
    })

    return theBest(promises, selectMode)
}
