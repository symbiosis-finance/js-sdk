import { Percent, Token, TokenAmount } from '../entities'

export class OneInchTrade {
    public tokenAmountIn: TokenAmount
    public route!: Token[]
    public amountOut!: TokenAmount
    public callData!: string
    public priceImpact!: Percent
    public routerAddress!: string

    private readonly tokenOut: Token
    private readonly from: string
    private readonly slippage: number

    public constructor(tokenAmountIn: TokenAmount, tokenOut: Token, from: string, slippage: number) {
        this.tokenAmountIn = tokenAmountIn
        this.tokenOut = tokenOut
        this.from = from
        this.slippage = slippage
    }

    public async init() {
        let fromTokenAddress = this.tokenAmountIn.token.address
        if (this.tokenAmountIn.token.isNative) {
            fromTokenAddress = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'
        }

        const params = []
        params.push(`fromTokenAddress=${fromTokenAddress}`)
        params.push(`toTokenAddress=${this.tokenOut.address}`)
        params.push(`amount=${this.tokenAmountIn.raw.toString()}`)
        params.push(`fromAddress=${this.from}`)
        params.push(`slippage=${this.slippage}`)
        params.push(`disableEstimate=true`)
        params.push(`allowPartialFill=false`)

        const url = `https://api.1inch.io/v4.0/${this.tokenAmountIn.token.chainId}/swap?${params.join('&')}`

        const response = await fetch(url)
        const json = await response.json()
        if (response.status === 400) {
            throw new Error(`Cannot build 1inch trade: ${json['description']}`)
        }

        const tx: {
            from: string
            to: string
            data: string
            value: string
            gas: string
            gasPrice: string
        } = json['tx']
        const amountOutRaw: string = json['toTokenAmount']

        this.routerAddress = tx.to
        this.callData = tx.data
        this.amountOut = new TokenAmount(this.tokenOut, amountOutRaw)
        this.route = [this.tokenAmountIn.token, this.tokenOut]
        this.priceImpact = new Percent('0') // 0%

        return this
    }
}
