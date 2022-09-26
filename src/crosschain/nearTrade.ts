import { Percent, Token, TokenAmount } from '../entities'
import { ChainId } from '../constants'
import { objectToBase64 } from './utils'
import { Symbiosis } from './symbiosis'
import { loadPools } from './nearSmartRoute/getAllPools'
import {
    Context,
    EstimateSwapView,
    getConfig,
    getExpectedOutputFromActions,
    getExtraStablePoolConfig,
    NearUtils,
    percentLess,
    PoolMode,
    round,
    scientificNotationToString,
    stableSmart,
    toNonDivisibleNumber,
    toReadableNumber,
} from './nearSmartRoute'
import Big from 'big.js'
import BigNumber from 'bignumber.js'

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
        let from: Token = this.tokenAmountIn.token
        let to: Token = this.tokenOut
        if (from.isNative) {
            from = WNEAR_TOKEN
        } else if (to.isNative) {
            to = WNEAR_TOKEN
        }

        const { actions, outAmount } = await this.buildRoute(
            to.chainId,
            from.address,
            to.address,
            this.tokenAmountIn.raw.toString()
        )

        // @@ TODO: Make shift without BigNumber
        const estimate = new BigNumber(outAmount).shiftedBy(this.tokenOut.decimals).toFixed(0)

        const amountOut = new TokenAmount(this.tokenOut, estimate)
        const actionsList = this.buildActionsList(from, to, actions, 0.5)
        console.log(actions, actionsList, outAmount)

        const swapMsg = {
            receiver_id: 'ref-finance-101.testnet',
            amount: this.tokenAmountIn.raw.toString(),
            msg: JSON.stringify({
                force: 0,
                actions: actionsList,
            }),
        }

        this.callData = objectToBase64(swapMsg)

        this.routerAddress = this.tokenAmountIn.token.address
        this.amountOut = amountOut
        this.route = [from, to]
        this.priceImpact = new Percent('0')
    }

    private async buildRoute(
        chainId: ChainId,
        inputToken: string,
        outputToken: string,
        amount: string
    ): Promise<{ actions: EstimateSwapView[]; outAmount: string }> {
        const near = await this.symbiosis.getNearConnection(chainId)
        const account = await near.account('symbiosis.testnet')

        const config = getConfig('pub-testnet')

        const context: Context = {
            ftViewFunction: (tokenId, { methodName, args }) => {
                return account.viewFunction(tokenId, methodName, args)
            },
            refFiViewFunction: ({ methodName, args }) => {
                return account.viewFunction(config.REF_FI_CONTRACT_ID, methodName, args)
            },
            config,
            nearUtils: new NearUtils(config, getExtraStablePoolConfig('pub-testnet')),
        }

        const pools = await loadPools(context)

        const stableSmartActionsV2 = await stableSmart(
            context,
            pools.filter((p) => !p?.Dex || p.Dex !== 'tri'),
            inputToken,
            outputToken,
            amount
        )

        const expectedOut = (await getExpectedOutputFromActions(context, stableSmartActionsV2, outputToken, 3)) as Big
        const outAmount = expectedOut.toString()

        return { actions: stableSmartActionsV2, outAmount }
    }

    private buildActionsList(
        tokenIn: Token,
        tokenOut: Token,
        swapsToDo: EstimateSwapView[],
        slippageTolerance: number
    ) {
        const actionsList = []
        const allSwapsTokens = swapsToDo.map((s) => [s.inputToken, s.outputToken]) // to get the hop tokens

        const isParallelSwap = swapsToDo.every((estimate) => estimate.status === PoolMode.PARALLEL)

        if (isParallelSwap) {
            swapsToDo.forEach((s2d) => {
                if (s2d.pool.partialAmountIn === undefined) {
                    return
                }

                const minTokenOutAmount = s2d.estimate ? percentLess(slippageTolerance, s2d.estimate) : '0'
                const allocation = toReadableNumber(
                    tokenIn.decimals,
                    scientificNotationToString(s2d.pool.partialAmountIn)
                )

                actionsList.push({
                    pool_id: s2d.pool.id,
                    token_in: tokenIn.address,
                    token_out: tokenOut.address,
                    amount_in: round(tokenIn.decimals, toNonDivisibleNumber(tokenIn.decimals, allocation)),
                    min_amount_out: round(
                        tokenOut.decimals,
                        toNonDivisibleNumber(tokenOut.decimals, minTokenOutAmount)
                    ),
                })
            })
        } else {
            for (const i in allSwapsTokens) {
                const swapTokens = allSwapsTokens[i]
                if (swapTokens[0] == tokenIn.address && swapTokens[1] == tokenOut.address) {
                    // parallel, direct hop route.
                    actionsList.push({
                        pool_id: swapsToDo[i].pool.id,
                        token_in: tokenIn.address,
                        token_out: tokenOut.address,
                        amount_in: swapsToDo[i].pool.partialAmountIn,
                        min_amount_out: round(
                            tokenOut.decimals,
                            toNonDivisibleNumber(
                                tokenOut.decimals,
                                percentLess(slippageTolerance, swapsToDo[i].estimate)
                            )
                        ),
                    })
                } else if (swapTokens[0] == tokenIn.address) {
                    // first hop in double hop route
                    //TODO -- put in a check to make sure this first hop matches with the next (i+1) hop as a second hop.
                    actionsList.push({
                        pool_id: swapsToDo[i].pool.id,
                        token_in: swapTokens[0],
                        token_out: swapTokens[1],
                        amount_in: swapsToDo[i].pool.partialAmountIn,
                        min_amount_out: '0',
                    })
                } else {
                    // second hop in double hop route.
                    //TODO -- put in a check to make sure this second hop matches with the previous (i-1) hop as a first hop.
                    actionsList.push({
                        pool_id: swapsToDo[i].pool.id,
                        token_in: swapTokens[0],
                        token_out: swapTokens[1],
                        min_amount_out: round(
                            tokenOut.decimals,
                            toNonDivisibleNumber(
                                tokenOut.decimals,
                                percentLess(slippageTolerance, swapsToDo[i].estimate)
                            )
                        ),
                    })
                }
            }
        }

        return actionsList
    }
}
