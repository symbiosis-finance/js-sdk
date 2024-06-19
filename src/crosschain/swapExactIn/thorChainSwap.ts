import { SwapExactInParams, SwapExactInResult, SwapExactInTransactionPayload } from './types'
import { Token } from '../../entities'
import { ChainId } from '../../constants'
import { CrosschainSwapExactInResult } from '../baseSwappingImplementation'
import { Error, ErrorCode } from '../error'

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

const THOR_TOKENS = [ETH_USDC, AVAX_USDC]

export async function thorChainSwap(context: SwapExactInParams): Promise<SwapExactInResult> {
    const { inTokenAmount } = context

    // via stable pool only
    const omniPool = context.symbiosis.config.omniPools[0]

    const promises = THOR_TOKENS.map((thorToken) => {
        const zappingThor = context.symbiosis.newZappingThor(omniPool)

        return zappingThor.exactIn({
            tokenAmountIn: inTokenAmount,
            thorTokenIn: thorToken,
            from: context.fromAddress,
            to: context.toAddress,
            slippage: context.slippage,
            deadline: context.deadline,
        })
    })

    const results = await Promise.allSettled(promises)

    let bestResult: CrosschainSwapExactInResult | undefined
    const errors: Error[] = []
    for (const item of results) {
        if (item.status !== 'fulfilled') {
            errors.push(item.reason)
            continue
        }

        const { value: result } = item

        if (bestResult && bestResult.tokenAmountOut.greaterThanOrEqual(result.tokenAmountOut.raw)) {
            continue
        }

        bestResult = result
    }

    if (!bestResult) {
        for (const error of errors) {
            if (error.code === ErrorCode.MIN_THORCHAIN_AMOUNT_IN) {
                throw error
            }
            if (error.code === ErrorCode.THORCHAIN_NOT_SUPPORTED_ADDRESS) {
                throw error
            }
        }

        throw new Error(`Can't build route upto the THORChain`)
    }

    const payload = {
        transactionType: bestResult.type,
        transactionRequest: bestResult.transactionRequest,
    } as SwapExactInTransactionPayload

    return {
        kind: 'crosschain-swap',
        ...bestResult,
        ...payload,
        zapType: 'thor-chain',
    }
}
