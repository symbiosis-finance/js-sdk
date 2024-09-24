import BigNumber from 'bignumber.js'
import CryptoJS from 'crypto-js'
import { ChainId, NATIVE_TOKEN_ADDRESS } from '../../constants'
import { Token, TokenAmount } from '../../entities'
import { DataProvider } from '../dataProvider'
import { OneInchTrade, getTradePriceImpact } from '../trade'
import { SwapExactInParams, SwapExactInResult } from '../types'

const OKX_CHAINS = new Set([
    ChainId.ETH_MAINNET,
    ChainId.ZKSYNC_MAINNET,
    ChainId.OPTIMISM_MAINNET,
    ChainId.MATIC_MAINNET,
    ChainId.BSC_MAINNET,
    ChainId.AVAX_MAINNET,
    ChainId.ARBITRUM_MAINNET,
    ChainId.LINEA_MAINNET,
    ChainId.BASE_MAINNET,
])

export function isOKXSwapSupported(params: SwapExactInParams): boolean {
    const inChainId = params.tokenAmountIn.token.chainId
    const outChainId = params.tokenOut.chainId

    return inChainId === outChainId && OKX_CHAINS.has(inChainId) && OneInchTrade.isAvailable(inChainId)
}

function okxSecurityHeaders(url: URL): Record<string, string> {
    const secretKey = '5E7583807F073388BC0E127817D08A4D'
    const timestamp = new Date().toISOString()
    const passphrase = '*N0b0C@1tq&6'
    const hash = CryptoJS.HmacSHA256(`${timestamp}GET${url.pathname}${url.search}`, secretKey)
    const sign = CryptoJS.enc.Base64.stringify(hash)

    return {
        'OK-ACCESS-KEY': 'a90cfe67-4bb8-4d65-9115-d4ab0cb8f83c',
        'OK-ACCESS-SIGN': sign,
        'OK-ACCESS-TIMESTAMP': timestamp,
        'OK-ACCESS-PASSPHRASE': passphrase,
    }
}

function getTokenAddress(token: Token): string {
    if (token.isNative) {
        return NATIVE_TOKEN_ADDRESS
    }

    return token.address
}

export async function okxSwap({
    symbiosis,
    tokenAmountIn,
    tokenOut,
    from,
    to,
    slippage,
}: SwapExactInParams): Promise<SwapExactInResult> {
    if (from.toLowerCase() !== to.toLowerCase()) {
        throw new Error('Sender and receiver must be the same')
    }

    const fromTokenAddress = getTokenAddress(tokenAmountIn.token)
    const toTokenAddress = getTokenAddress(tokenOut)

    const convertedSlippage = new BigNumber(slippage).div(10000).toString()

    const url = new URL('https://www.okx.com/api/v5/dex/aggregator/swap')

    url.searchParams.set('chainId', tokenAmountIn.token.chainId.toString())
    url.searchParams.set('fromTokenAddress', fromTokenAddress)
    url.searchParams.set('toTokenAddress', toTokenAddress)
    url.searchParams.set('amount', tokenAmountIn.raw.toString())
    url.searchParams.set('userWalletAddress', from)
    url.searchParams.set('slippage', convertedSlippage)

    const response = await fetch(url.toString(), {
        headers: {
            'content-type': 'application/json',
            ...okxSecurityHeaders(url),
        },
    })

    const { data } = await response.json()

    if (!data?.length) {
        throw new Error('No data in response')
    }

    const { routerResult, tx } = data[0]

    const amountOut = new TokenAmount(tokenOut, routerResult.toTokenAmount)

    const oracle = symbiosis.oneInchOracle(tokenAmountIn.token.chainId)
    const dataProvider = new DataProvider(symbiosis)
    const priceImpactPromise = getTradePriceImpact({
        dataProvider,
        oracle,
        tokenAmountIn,
        tokenAmountOut: amountOut,
    })

    const approveUrl = new URL('https://www.okx.com/api/v5/dex/aggregator/approve-transaction')
    approveUrl.searchParams.set('chainId', tokenAmountIn.token.chainId.toString())
    approveUrl.searchParams.set('tokenContractAddress', fromTokenAddress)
    approveUrl.searchParams.set('approveAmount', tokenAmountIn.raw.toString())

    const approveResponsePromise = fetch(approveUrl.toString(), {
        headers: { 'content-type': 'application/json', ...okxSecurityHeaders(approveUrl) },
    })

    const [priceImpact, approveResponse] = await Promise.all([priceImpactPromise, approveResponsePromise])

    const { data: approveData } = await approveResponse.json()

    const approveTo = approveData?.[0]?.dexContractAddress

    return {
        kind: 'onchain-swap',
        route: [tokenAmountIn.token, tokenOut],
        tokenAmountOut: amountOut,
        approveTo,
        priceImpact,
        transactionType: 'evm',
        inTradeType: 'okx',
        transactionRequest: {
            to: tx.to,
            data: tx.data,
            value: tokenAmountIn.token.isNative ? tokenAmountIn.raw.toString() : undefined,
        },
        fees: [], // TODO
        routes: [], // TODO
    }
}
