import { Token, TokenAmount, wrappedToken } from '../../entities'
import { SwapExactInBridge, SwapExactInContex, SwapExactInTransactionPayload } from './types'

function getBridgeTokens(context: SwapExactInContex): { inToken: Token; outToken: Token } | undefined {
    if (context.inTokenChainId === context.outTokenChainId) {
        return undefined
    }

    const { symbiosis } = context

    const wrappedInToken = wrappedToken(context.inAmount.token)
    const wrappedOutToken = wrappedToken(context.outToken)

    const tokens = symbiosis.tokens().filter((token) => token.equals(wrappedInToken) || token.equals(wrappedOutToken))

    if (!tokens.length) {
        return undefined
    }

    let inToken: Token | undefined
    let outToken: Token | undefined
    for (const token of tokens) {
        const chainId = token.chainId === wrappedInToken.chainId ? wrappedOutToken.chainId : wrappedInToken.chainId

        const representation = symbiosis.getRepresentation(token, chainId)

        if (!representation) {
            continue
        }

        if (
            (wrappedInToken.equals(token) && wrappedOutToken.equals(representation)) ||
            (wrappedOutToken.equals(token) && wrappedInToken.equals(representation))
        ) {
            inToken = token.chainId === wrappedInToken.chainId ? token : representation
            outToken = token.chainId === wrappedInToken.chainId ? representation : token
        }
    }

    if (!inToken || !outToken) {
        return undefined
    }

    return {
        inToken: context.inAmount.token.isNative ? context.inAmount.token : inToken,
        outToken: context.outToken.isNative ? context.outToken : outToken,
    }
}

export function isBridgeSupported(context: SwapExactInContex): boolean {
    return !!getBridgeTokens(context)
}

export async function bridge(context: SwapExactInContex): Promise<SwapExactInBridge & SwapExactInTransactionPayload> {
    const tokens = getBridgeTokens(context)

    if (!tokens) {
        throw new Error('Bridge is not supported')
    }

    const { inToken, outToken } = tokens

    const briging = context.symbiosis.newBridging()

    const result = await briging.exactIn({
        from: context.fromAddress,
        to: context.toAddress,
        tokenAmountIn: new TokenAmount(inToken, context.inAmount.raw),
        tokenOut: outToken,
    })

    const payload = {
        transactionType: result.type,
        transactionRequest: result.transactionRequest,
    } as SwapExactInTransactionPayload

    return {
        kind: 'bridge',
        fee: result.fee,
        tokenAmountOut: result.tokenAmountOut,
        ...payload,
    }
}
