import invariant from 'tiny-invariant'

import { ChainId, TradeType } from './constants.ts'
import { validateAndParseAddress } from './utils.ts'
import { Percent, TokenAmount, Trade } from './entities/index.ts'

/**
 * Options for producing the arguments to send call to the router.
 */
export interface TradeOptions {
    /**
     * How much the execution price is allowed to move unfavorably from the trade execution price.
     */
    allowedSlippage: Percent
    /**
     * How long the swap is valid until it expires, in seconds.
     * This will be used to produce a `deadline` parameter which is computed from when the swap call parameters
     * are generated.
     */
    ttl: number
    /**
     * The account that should receive the output of the swap.
     */
    recipient: string

    /**
     * Whether any of the tokens in the path are fee on transfer tokens, which should be handled with special methods
     */
    feeOnTransfer?: boolean
}

type Route = {
    from: string
    to: string
    stable: boolean
}

/**
 * The parameters to use in the call to the Uniswap V2 Router to execute a trade.
 */
export interface SwapParameters {
    /**
     * The method to call on the Uniswap V2 Router.
     */
    methodName: string
    /**
     * The arguments to pass to the method, all hex encoded.
     */
    args: (string | string[] | Route[])[]
    /**
     * The amount of wei to send in hex.
     */
    value: string

    /**
     * The offset of amount.
     */
    offset: number

    minReceivedOffset: number
}

function toHex(tokenAmount: TokenAmount) {
    return `0x${tokenAmount.raw.toString(16)}`
}

const ZERO_HEX = '0x0'

/**
 * Represents the Uniswap V2 Router, and has static methods for helping execute trades.
 */
export abstract class Router {
    /**
     * Produces the on-chain method name to call and the hex encoded parameters to pass as arguments for a given trade.
     * @param trade to produce call parameters for
     * @param options options for the call parameters
     */
    public static swapCallParameters(trade: Trade, options: TradeOptions): SwapParameters {
        // the router does not support both ether in and out
        invariant(!(trade.inputAmount.token.isNative && trade.outputAmount.token.isNative), 'ETHER_IN_OUT')
        invariant(options.ttl > 0, 'TTL')

        const to: string = validateAndParseAddress(options.recipient)
        const amountIn: string = toHex(trade.maximumAmountIn(options.allowedSlippage))
        const amountOut: string = toHex(trade.minimumAmountOut(options.allowedSlippage))

        let path

        if (trade.inputAmount.token.chainId === ChainId.KAVA_MAINNET) {
            const routes: Route[] = []
            for (let i = 0; i < trade.route.path.length - 1; i++) {
                routes.push({
                    from: trade.route.path[i].address,
                    to: trade.route.path[i + 1].address,
                    stable: false,
                })
            }
            path = routes
        } else {
            path = trade.route.path.map((token) => token.address)
        }

        const deadline = `0x${(Math.floor(new Date().getTime() / 1000) + options.ttl).toString(16)}`
        const useFeeOnTransfer = Boolean(options.feeOnTransfer)

        const hasReferrer = [ChainId.MODE_MAINNET, ChainId.HYPERLIQUID_MAINNET].includes(
            trade.outputAmount.token.chainId
        )

        let methodName: string
        let args: (string | string[] | Route[])[]
        let value: string
        let offset: number
        let minReceivedOffset: number
        switch (trade.tradeType) {
            case TradeType.EXACT_INPUT:
                if (trade.inputAmount.token.isNative) {
                    methodName = 'swapExactETHForTokens'
                    // (uint amountOutMin, address[] call  data path, address to, uint deadline)
                    args = [amountOut, path, to, deadline]
                    if (useFeeOnTransfer) {
                        methodName = 'swapExactETHForTokensSupportingFeeOnTransferTokens'
                        if (hasReferrer) {
                            args = [amountOut, path, to, to, deadline]
                        }
                    }
                    value = amountIn
                    offset = 0
                    minReceivedOffset = 36
                } else if (trade.outputAmount.token.isNative) {
                    methodName = 'swapExactTokensForETH'
                    // (uint amountIn, uint amountOutMin, address[] call data path, address to, uint deadline)
                    args = [amountIn, amountOut, path, to, deadline]
                    if (useFeeOnTransfer) {
                        methodName = 'swapExactTokensForETHSupportingFeeOnTransferTokens'
                        if (hasReferrer) {
                            args = [amountIn, amountOut, path, to, to, deadline]
                        }
                    }
                    value = ZERO_HEX
                    offset = 36
                    minReceivedOffset = 68
                } else {
                    methodName = 'swapExactTokensForTokens'
                    // (uint amountIn, uint amountOutMin, address[] call data path, address to, uint deadline)
                    args = [amountIn, amountOut, path, to, deadline]
                    if (useFeeOnTransfer) {
                        methodName = 'swapExactTokensForTokensSupportingFeeOnTransferTokens'
                        if (hasReferrer) {
                            args = [amountIn, amountOut, path, to, to, deadline]
                        }
                    }
                    value = ZERO_HEX
                    offset = 36
                    minReceivedOffset = 68
                }
                break
            case TradeType.EXACT_OUTPUT:
                invariant(!useFeeOnTransfer, 'EXACT_OUT_FOT')
                if (trade.inputAmount.token.isNative) {
                    methodName = 'swapETHForExactTokens'
                    // (uint amountOut, address[] call data path, address to, uint deadline)
                    args = [amountOut, path, to, deadline]
                    value = amountIn
                    offset = 0
                    minReceivedOffset = 0
                } else if (trade.outputAmount.token.isNative) {
                    methodName = 'swapTokensForExactETH'
                    // (uint amountOut, uint amountInMax, address[] call data path, address to, uint deadline)
                    args = [amountOut, amountIn, path, to, deadline]
                    value = ZERO_HEX
                    offset = 68
                    minReceivedOffset = 0
                } else {
                    methodName = 'swapTokensForExactTokens'
                    // (uint amountOut, uint amountInMax, address[] call data path, address to, uint deadline)
                    args = [amountOut, amountIn, path, to, deadline]
                    value = ZERO_HEX
                    offset = 68
                    minReceivedOffset = 0
                }
                break
        }
        return {
            methodName,
            args,
            value,
            offset,
            minReceivedOffset,
        }
    }
}
