import BigNumber from 'bignumber.js'
import { Percent, Token, TokenAmount } from '../entities'
import { ChainId } from '../constants'
import { objectToBase64 } from './utils'
import { Symbiosis } from './symbiosis'
import { loadPools } from './nearSmartRoute/getAllPools'
import {
    Context,
    getConfig,
    getExtraStablePoolConfig,
    NearUtils,
    stableSmart,
    getExpectedOutputFromActions,
    EstimateSwapView,
} from './nearSmartRoute'

// @@
const WNEAR_TOKEN = new Token({
    chainId: 30001,
    address: 'wrap.testnet',
    decimals: 24,
    symbol: 'wNEAR',
    name: 'Wrapped NEAR',
    evm: false,
})

export class NearTrade {
    public tokenAmountIn: TokenAmount
    public route!: Token[]
    public amountOut!: TokenAmount
    public callData!: string
    public readonly callDataOffset = 0
    public priceImpact!: Percent
    public routerAddress!: string

    private readonly tokenOut: Token
    private readonly symbiosis: Symbiosis

    public constructor(tokenAmountIn: TokenAmount, tokenOut: Token, symbiosis: Symbiosis) {
        this.tokenAmountIn = tokenAmountIn
        this.tokenOut = tokenOut
        this.symbiosis = symbiosis
    }

    public async init() {
        // wnear -> usdc or usdc -> wnear
        // https://github.com/ref-finance/ref-ui/blob/d6d5ab4eff74d66fdf9e02b9a29f071211527b01/src/services/swap.ts#L217
        const response = await fetch('https://testnet-indexer.ref-finance.com/get-pool?pool_id=1159')

        const { token0_ref_price } = await response.json()

        const fromNear = this.tokenAmountIn.token.isNative

        let estimate: string
        let from: Token
        let to: Token
        if (fromNear) {
            estimate = new BigNumber(token0_ref_price)
                .multipliedBy(this.tokenAmountIn.toFixed())
                .shiftedBy(this.tokenOut.decimals)
                .toFixed(0)

            from = WNEAR_TOKEN
            to = this.tokenOut
        } else {
            estimate = new BigNumber(this.tokenAmountIn.toFixed())
                .dividedBy(token0_ref_price)
                .shiftedBy(this.tokenOut.decimals)
                .toFixed(0)
            from = this.tokenAmountIn.token
            to = WNEAR_TOKEN
        }

        const amountOut = new TokenAmount(this.tokenOut, estimate)

        const swapMsg = {
            receiver_id: 'ref-finance-101.testnet',
            amount: this.tokenAmountIn.raw.toString(),
            msg: JSON.stringify({
                force: 0,
                actions: [
                    {
                        pool_id: 1159,
                        token_in: from.address,
                        token_out: to.address,
                        amount_in: this.tokenAmountIn.raw.toString(),
                        min_amount_out: '0',
                    },
                ],
            }),
        }

        this.callData = objectToBase64(swapMsg)

        this.routerAddress = this.tokenAmountIn.token.address
        this.amountOut = amountOut
        this.route = [from, to]
        this.priceImpact = new Percent('0')

        const { actions, outAmount } = await this.buildRoute(
            to.chainId,
            from.address,
            to.address,
            this.tokenAmountIn.raw.toString()
        )

        console.log(actions, outAmount)
    }

    private async buildRoute(
        chainId: ChainId,
        inputToken: string,
        outputToken: string,
        amount: string
    ): Promise<{ actions: EstimateSwapView[]; outAmount: string }> {
        const near = await this.symbiosis.getNearConnection(chainId)
        const account = await near.account('symbiosis.testnet')

        const config = getConfig('testnet')

        const pools = await loadPools(account, config.REF_FI_CONTRACT_ID)

        const context: Context = {
            ftViewFunction: (tokenId, { methodName, args }) => {
                return account.viewFunction(tokenId, methodName, args)
            },
            refFiViewFunction: ({ methodName, args }) => {
                return account.viewFunction(config.REF_FI_CONTRACT_ID, methodName, args)
            },
            config,
            nearUtils: new NearUtils(config, getExtraStablePoolConfig('testnet')),
        }

        const stableSmartActionsV2 = await stableSmart(
            context,
            pools.filter((p) => !p?.Dex || p.Dex !== 'tri'),
            inputToken,
            outputToken,
            amount
        )

        const expectedOut = (
            await getExpectedOutputFromActions(context, stableSmartActionsV2, outputToken, 0.5)
        ).toString()

        return { actions: stableSmartActionsV2, outAmount: expectedOut }
    }
}
