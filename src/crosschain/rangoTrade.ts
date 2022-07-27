import { Percent, Token, TokenAmount } from '../entities'
// import { DataProvider } from './dataProvider'
import { RangoClient, EvmTransaction, Asset } from 'rango-sdk-basic'
import { ChainId } from '../constants'

const API_KEY = '39d01091-738c-4c3c-b211-b25e03e11225'

const DEFAULT_BLOCKCHAIN = 'ETH'
const BLOCKCHAIN_MAP: { [chainId in ChainId]?: string } = {
    [ChainId.ETH_MAINNET]: 'ETH',
    [ChainId.BSC_MAINNET]: 'BSC',
    [ChainId.AVAX_MAINNET]: 'AVAX_CCHAIN',
    [ChainId.MATIC_MAINNET]: 'POLYGON',
    [ChainId.BOBA_MAINNET]: 'BOBA',
}

function tokenToAsset(token: Token): Asset {
    return {
        blockchain: BLOCKCHAIN_MAP[token.chainId] || DEFAULT_BLOCKCHAIN,
        symbol: token.symbol as string,
        address: token.address,
    }
}

export class RangoTrade {
    public tokenAmountIn: TokenAmount
    public route!: Token[]
    public amountOut!: TokenAmount
    public callData!: string
    public priceImpact!: Percent
    public routerAddress!: string
    public callDataOffset?: number

    private readonly tokenOut: Token
    private readonly from: string
    private readonly to: string
    private readonly slippage: number
    // private readonly dataProvider: DataProvider
    private readonly rango: RangoClient

    public constructor(
        tokenAmountIn: TokenAmount,
        tokenOut: Token,
        from: string,
        to: string,
        slippage: number
        // dataProvider: DataProvider
    ) {
        this.tokenAmountIn = tokenAmountIn
        this.tokenOut = tokenOut
        this.from = from
        this.to = to
        this.slippage = slippage
        // this.dataProvider = dataProvider
        this.rango = new RangoClient(API_KEY)
    }

    public async init() {
        const swapResponse = await this.rango.swap({
            from: tokenToAsset(this.tokenAmountIn.token),
            to: tokenToAsset(this.tokenOut),
            amount: this.tokenAmountIn.raw.toString(),
            fromAddress: this.from,
            toAddress: this.to,
            disableEstimate: true,
            slippage: this.slippage.toString(),
            referrerAddress: null,
            referrerFee: null,
        })
        if (!swapResponse.route || !swapResponse.tx) {
            throw new Error(`Cannot build rango route`)
        }
        const amountOutRaw: string = swapResponse.route.outputAmount

        const tx: EvmTransaction = swapResponse.tx as EvmTransaction
        this.routerAddress = tx.txTo
        this.callData = tx.txData as string
        this.callDataOffset = this.getOffset(tx.txData as string) || 0
        this.amountOut = new TokenAmount(this.tokenOut, amountOutRaw)
        this.route = [this.tokenAmountIn.token, this.tokenOut]
        this.priceImpact = new Percent('0') // FIXME

        return this
    }

    private getOffset(callData: string) {
        const methods = [
            {
                // swapTokensForExactETH(uint256,uint256,address[],address,uint256)
                sigHash: '4a25d94a',
                offset: 68,
            },
            {
                // swapTokensForExactTokens(uint256,uint256,address[],address,uint256)
                sigHash: '8803dbee',
                offset: 68,
            },
            {
                // swapExactTokensForETH(uint256,uint256,address[],address,uint256)
                sigHash: '18cbafe5',
                offset: 36,
            },
            {
                // swapExactTokensForTokens(uint256,uint256,address[],address,uint256)
                sigHash: '38ed1739',
                offset: 36,
            },
            {
                // ???
                sigHash: 'a60fdfb6',
                offset: 68,
            },
        ]

        const sigHash = callData.slice(2, 10)

        const method = methods.find((i) => {
            return i.sigHash === sigHash
        })

        return method?.offset
    }
}
