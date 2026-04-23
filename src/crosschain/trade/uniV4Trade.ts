import { BigNumber, constants, utils } from 'ethers'
import JSBI from 'jsbi'

import { ChainId } from '../../constants'
import { Percent, Token, TokenAmount } from '../../entities'
import { getMinAmount } from '../chainUtils'
import { BIPS_BASE } from '../constants'
import { getMulticall } from '../multicall'
import { AggregateSdkError, UniV4TradeError } from '../sdkError'
import type { Symbiosis } from '../symbiosis'
import type { Address } from '../types'
import { SymbiosisTrade, type SymbiosisTradeParams, TradeProvider } from './symbiosisTrade'

// V4 Quoter ABI (only the functions we need)
const QUOTER_ABI = [
    {
        inputs: [
            {
                components: [
                    {
                        components: [
                            { name: 'currency0', type: 'address' },
                            { name: 'currency1', type: 'address' },
                            { name: 'fee', type: 'uint24' },
                            { name: 'tickSpacing', type: 'int24' },
                            { name: 'hooks', type: 'address' },
                        ],
                        name: 'poolKey',
                        type: 'tuple',
                    },
                    { name: 'zeroForOne', type: 'bool' },
                    { name: 'exactAmount', type: 'uint128' },
                    { name: 'hookData', type: 'bytes' },
                ],
                name: 'params',
                type: 'tuple',
            },
        ],
        name: 'quoteExactInputSingle',
        outputs: [
            { name: 'amountOut', type: 'uint256' },
            { name: 'gasEstimate', type: 'uint256' },
        ],
        stateMutability: 'nonpayable',
        type: 'function',
    },
]

// Permit2 ABI (only approve)
const PERMIT2_ABI = ['function approve(address token, address spender, uint160 amount, uint48 expiration)']

// Universal Router ABI (only execute)
const UNIVERSAL_ROUTER_ABI = ['function execute(bytes commands, bytes[] inputs, uint256 deadline) payable']

// V4 Router action codes (from v4-periphery Actions.sol)
const SWAP_EXACT_IN_SINGLE = 0x06
const SWAP_EXACT_IN = 0x07
const SETTLE_ALL = 0x0c
const TAKE_ALL = 0x0f

// V4_SWAP Universal Router command
const V4_SWAP = 0x10

const MAX_UINT160 = BigNumber.from(2).pow(160).sub(1)
const MAX_UINT48 = BigNumber.from(2).pow(48).sub(1)

interface PoolConfig {
    fee: number
    tickSpacing: number
}

const POOL_CONFIGS: PoolConfig[] = [
    { fee: 100, tickSpacing: 1 },
    { fee: 500, tickSpacing: 10 },
    { fee: 3000, tickSpacing: 60 },
    { fee: 10000, tickSpacing: 200 },
]

interface Deployment {
    quoter: Address
    universalRouter: Address
    permit2: Address
    baseTokens: Token[]
}

const DEPLOYMENT_ADDRESSES: Partial<Record<ChainId, Deployment>> = {
    [ChainId.TEMPO_MAINNET]: {
        quoter: '0x20e6487c371a2086f841ef453f85378223df4f4e',
        universalRouter: '0xa2dc7d0266f0cc50b3eeaf36c9bfcecff1beea91',
        permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
        baseTokens: [
            new Token({
                chainId: ChainId.TEMPO_MAINNET,
                address: '0x20C0000000000000000000000000000000000000',
                symbol: 'pathUSD',
                name: 'pathUSD',
                decimals: 6,
            }),
            new Token({
                chainId: ChainId.TEMPO_MAINNET,
                address: '0x20c000000000000000000000b9537d11c60e8b50',
                symbol: 'USDC.e',
                name: 'USDC.e',
                decimals: 6,
            }),
        ],
    },
}

interface PoolKey {
    currency0: string
    currency1: string
    fee: number
    tickSpacing: number
    hooks: string
}

interface SingleHopQuote {
    kind: 'single'
    poolKey: PoolKey
    zeroForOne: boolean
    amountOut: JSBI
}

interface MultiHopQuote {
    kind: 'multi'
    hop1: { poolKey: PoolKey; zeroForOne: boolean }
    hop2: { poolKey: PoolKey; zeroForOne: boolean }
    amountOut: JSBI
}

type QuoteResult = SingleHopQuote | MultiHopQuote

interface UniV4TradeParams extends SymbiosisTradeParams {
    symbiosis: Symbiosis
    deadline: number
    from?: string
}

export class UniV4Trade extends SymbiosisTrade {
    private readonly symbiosis: Symbiosis
    private readonly deadline: number
    private readonly from?: string

    static isSupported(chainId: ChainId): boolean {
        return !!DEPLOYMENT_ADDRESSES[chainId]
    }

    public constructor(params: UniV4TradeParams) {
        super(params)
        this.symbiosis = params.symbiosis
        this.deadline = params.deadline
        this.from = params.from
    }

    get tradeType(): TradeProvider {
        return TradeProvider.UNI_V4
    }

    /**
     * Checks if the trade is called by MetaRouter (cross-chain destination swap).
     * In that case we must use MulticallRouter wrapping because MetaRouter
     * can only do a single approve+call, but Universal Router V4 requires Permit2 flow.
     */
    private isCalledByMetaRouter(): boolean {
        if (!this.from) return false
        try {
            const chainId = this.tokenAmountIn.token.chainId
            const metaRouterAddress = this.symbiosis.metaRouter(chainId).address
            return this.from.toLowerCase() === metaRouterAddress.toLowerCase()
        } catch {
            return false
        }
    }

    public async init() {
        const chainId = this.tokenAmountIn.token.chainId
        const deployment = DEPLOYMENT_ADDRESSES[chainId]
        if (!deployment) {
            throw new UniV4TradeError('Unsupported chain')
        }

        const provider = this.symbiosis.getProvider(chainId)
        const multicall = await getMulticall(provider)
        const quoterIface = new utils.Interface(QUOTER_ABI)

        const tokenIn = this.tokenAmountIn.token
        const tokenOut = this.tokenOut
        const amountInRaw = this.tokenAmountIn.raw.toString()

        // Step 1: build direct quote calls + first-hop calls
        const directKeys = POOL_CONFIGS.map((config) => UniV4Trade.buildPoolKey(tokenIn, tokenOut, config))

        interface FirstHopInfo {
            baseToken: Token
            config: PoolConfig
            poolKey: PoolKey
            zeroForOne: boolean
        }
        const firstHops: FirstHopInfo[] = []
        for (const baseToken of deployment.baseTokens) {
            if (
                baseToken.address.toLowerCase() === tokenIn.address.toLowerCase() ||
                baseToken.address.toLowerCase() === tokenOut.address.toLowerCase()
            ) {
                continue
            }
            for (const config of POOL_CONFIGS) {
                const { poolKey, zeroForOne } = UniV4Trade.buildPoolKey(tokenIn, baseToken, config)
                firstHops.push({ baseToken, config, poolKey, zeroForOne })
            }
        }

        const encodeQuote = (poolKey: PoolKey, zeroForOne: boolean, exactAmount: string) => ({
            target: deployment.quoter,
            callData: quoterIface.encodeFunctionData('quoteExactInputSingle', [
                { poolKey, zeroForOne, exactAmount, hookData: '0x' },
            ]),
        })

        const directCalls = directKeys.map(({ poolKey, zeroForOne }) => encodeQuote(poolKey, zeroForOne, amountInRaw))
        const firstHopCalls = firstHops.map(({ poolKey, zeroForOne }) => encodeQuote(poolKey, zeroForOne, amountInRaw))

        // Multicall 1: direct quotes + first hops
        const results1 = await multicall.callStatic.tryAggregate(false, [...directCalls, ...firstHopCalls])

        let bestQuote: QuoteResult | undefined
        const errors: UniV4TradeError[] = []

        // Process direct results
        for (let i = 0; i < directCalls.length; i++) {
            const [success, returnData] = results1[i]
            if (!success || returnData.length <= 2) {
                errors.push(new UniV4TradeError(`Direct quote failed for fee=${POOL_CONFIGS[i].fee}`))
                continue
            }

            const decoded = quoterIface.decodeFunctionResult('quoteExactInputSingle', returnData)
            if (decoded.amountOut.isZero()) {
                errors.push(new UniV4TradeError(`Zero output for fee=${POOL_CONFIGS[i].fee}`))
                continue
            }

            const amtOut = JSBI.BigInt(decoded.amountOut.toString())
            const { poolKey, zeroForOne } = directKeys[i]
            const quote: SingleHopQuote = { kind: 'single', poolKey, zeroForOne, amountOut: amtOut }
            if (!bestQuote || JSBI.greaterThan(amtOut, bestQuote.amountOut)) {
                bestQuote = quote
            }
        }

        // Build second-hop calls from successful first hops
        interface PendingSecondHop {
            info: FirstHopInfo
            hop2PoolKey: PoolKey
            hop2ZeroForOne: boolean
        }
        const pendingSecondHops: PendingSecondHop[] = []
        const secondHopCalls: { target: string; callData: string }[] = []

        const offset = directCalls.length
        for (let i = 0; i < firstHopCalls.length; i++) {
            const [success, returnData] = results1[offset + i]
            if (!success || returnData.length <= 2) {
                errors.push(new UniV4TradeError(`Multi-hop first quote failed`))
                continue
            }

            const decoded = quoterIface.decodeFunctionResult('quoteExactInputSingle', returnData)
            if (decoded.amountOut.isZero()) {
                errors.push(new UniV4TradeError(`Multi-hop first quote zero output`))
                continue
            }

            const info = firstHops[i]
            const { poolKey, zeroForOne } = UniV4Trade.buildPoolKey(info.baseToken, tokenOut, info.config)
            pendingSecondHops.push({ info, hop2PoolKey: poolKey, hop2ZeroForOne: zeroForOne })
            secondHopCalls.push(encodeQuote(poolKey, zeroForOne, decoded.amountOut.toString()))
        }

        // Multicall 2: second hops
        if (secondHopCalls.length > 0) {
            const results2 = await multicall.callStatic.tryAggregate(false, secondHopCalls)

            for (let i = 0; i < results2.length; i++) {
                const [success, returnData] = results2[i]
                if (!success || returnData.length <= 2) {
                    errors.push(new UniV4TradeError(`Multi-hop second quote failed`))
                    continue
                }

                const decoded = quoterIface.decodeFunctionResult('quoteExactInputSingle', returnData)
                if (decoded.amountOut.isZero()) {
                    errors.push(new UniV4TradeError(`Multi-hop second quote zero output`))
                    continue
                }

                const amtOut = JSBI.BigInt(decoded.amountOut.toString())
                const { info, hop2PoolKey, hop2ZeroForOne } = pendingSecondHops[i]
                const quote: MultiHopQuote = {
                    kind: 'multi',
                    hop1: { poolKey: info.poolKey, zeroForOne: info.zeroForOne },
                    hop2: { poolKey: hop2PoolKey, zeroForOne: hop2ZeroForOne },
                    amountOut: amtOut,
                }
                if (!bestQuote || JSBI.greaterThan(amtOut, bestQuote.amountOut)) {
                    bestQuote = quote
                }
            }
        }

        if (!bestQuote) {
            throw new AggregateSdkError(errors, 'UniV4: no route found')
        }

        const amountOut = new TokenAmount(this.tokenOut, bestQuote.amountOut.toString())
        const amountOutMinRaw = getMinAmount(this.slippage, bestQuote.amountOut)
        const amountOutMin = new TokenAmount(this.tokenOut, amountOutMinRaw.toString())

        const amountInBn = BigNumber.from(this.tokenAmountIn.raw.toString())
        const amountOutMinBn = BigNumber.from(amountOutMinRaw.toString())

        const priceImpact = new Percent(JSBI.BigInt(0), BIPS_BASE)

        if (this.isCalledByMetaRouter()) {
            this.initMulticallRouter(
                deployment,
                bestQuote,
                amountInBn,
                amountOutMinBn,
                amountOut,
                amountOutMin,
                priceImpact
            )
        } else {
            this.initDirect(deployment, bestQuote, amountInBn, amountOutMinBn, amountOut, amountOutMin, priceImpact)
        }

        return this
    }

    /**
     * On-chain swap: user calls Universal Router directly.
     * User must do ERC20 approve to Permit2, then Permit2.approve for Universal Router (permit2Approve pre-tx).
     */
    private initDirect(
        deployment: Deployment,
        bestQuote: QuoteResult,
        amountInBn: BigNumber,
        amountOutMinBn: BigNumber,
        amountOut: TokenAmount,
        amountOutMin: TokenAmount,
        priceImpact: Percent
    ) {
        const { callData, callDataOffset, minReceivedOffset } = this.buildUniversalRouterCallData(
            bestQuote,
            amountInBn,
            amountOutMinBn
        )

        const permit2Interface = new utils.Interface(PERMIT2_ABI)
        const permit2ApproveCallData = permit2Interface.encodeFunctionData('approve', [
            this.tokenAmountIn.token.address,
            deployment.universalRouter,
            MAX_UINT160,
            MAX_UINT48,
        ])

        this.out = {
            amountOut,
            amountOutMin,
            routerAddress: deployment.universalRouter as Address,
            route: [this.tokenAmountIn.token, this.tokenOut],
            callData,
            callDataOffset,
            minReceivedOffset,
            priceImpact,
            approveTo: deployment.permit2 as Address,
            permit2Approve: {
                to: deployment.permit2 as Address,
                callData: permit2ApproveCallData,
            },
        }
    }

    /**
     * Cross-chain swap: MetaRouter calls via externalCall.
     * MetaRouter can only do one approve + one call, so we wrap Permit2 setup + UR execute
     * into a MulticallRouter.multicall() call.
     *
     * Flow: MetaRouter → approve MulticallRouter → MulticallRouter.multicall(
     *   [Permit2.approve(token, UR), UR.execute(swap)],
     *   [permit2, universalRouter],
     *   [inputToken, inputToken, outputToken],
     *   ...
     * )
     */
    private initMulticallRouter(
        deployment: Deployment,
        bestQuote: QuoteResult,
        amountInBn: BigNumber,
        amountOutMinBn: BigNumber,
        amountOut: TokenAmount,
        amountOutMin: TokenAmount,
        priceImpact: Percent
    ) {
        const chainId = this.tokenAmountIn.token.chainId
        const inputToken = this.tokenAmountIn.token.address
        const outputToken = this.tokenOut.address

        // Step 0: Permit2.approve(token, universalRouter, maxAmount, maxExpiration)
        const permit2Interface = new utils.Interface(PERMIT2_ABI)
        const permit2CallData = permit2Interface.encodeFunctionData('approve', [
            inputToken,
            deployment.universalRouter,
            MAX_UINT160,
            MAX_UINT48,
        ])
        const permit2AmountOffset = 4 + 32 * 3 // 4 (selector) + 32 (token) + 32 (spender) + 32 (amount) = 100

        // Step 1: Universal Router execute
        const {
            callData: urCallData,
            callDataOffset: urCallDataOffset,
            minReceivedOffset: urMinReceivedOffset,
        } = this.buildUniversalRouterCallData(bestQuote, amountInBn, amountOutMinBn)

        // Build MulticallRouter.multicall calldata
        const multicallRouter = this.symbiosis.multicallRouter(chainId)
        const callData = multicallRouter.interface.encodeFunctionData('multicall', [
            amountInBn.toString(),
            [permit2CallData, urCallData],
            [deployment.permit2, deployment.universalRouter],
            [inputToken, inputToken, outputToken],
            [permit2AmountOffset, urCallDataOffset],
            this.to,
        ])

        // callDataOffset = the first param of multicall (uint256 _amountIn) ends at byte 4 + 32 = 36
        const callDataOffset = 4 + 32

        // Calculate minReceivedOffset within the full multicall calldata.
        // urMinReceivedOffset is the byte offset of amountOutMin END within the UR calldata.
        // Find where the UR calldata is embedded in the full multicall calldata and add the internal offset.
        const urCallDataRaw = urCallData.slice(2).toLowerCase()
        const fullCallDataRaw = callData.slice(2).toLowerCase()
        const urStartByte = fullCallDataRaw.indexOf(urCallDataRaw) / 2
        const minReceivedOffset = urStartByte + urMinReceivedOffset

        this.out = {
            amountOut,
            amountOutMin,
            routerAddress: multicallRouter.address as Address,
            approveTo: multicallRouter.address as Address,
            route: [this.tokenAmountIn.token, this.tokenOut],
            callData,
            callDataOffset,
            minReceivedOffset,
            priceImpact,
        }
    }

    static buildPoolKey(
        tokenA: Token,
        tokenB: Token,
        poolConfig: PoolConfig
    ): { poolKey: PoolKey; zeroForOne: boolean } {
        const addrA = tokenA.address.toLowerCase()
        const addrB = tokenB.address.toLowerCase()
        const zeroForOne = addrA < addrB

        const currency0 = zeroForOne ? tokenA.address : tokenB.address
        const currency1 = zeroForOne ? tokenB.address : tokenA.address

        return {
            poolKey: {
                currency0,
                currency1,
                fee: poolConfig.fee,
                tickSpacing: poolConfig.tickSpacing,
                hooks: constants.AddressZero,
            },
            zeroForOne,
        }
    }

    /**
     * Builds the V4_SWAP input data (abi.encode(bytes actions, bytes[] params)).
     * Used by both initDirect and initMulticallRouter.
     */
    private buildV4SwapData(quote: QuoteResult, amountIn: BigNumber, amountOutMin: BigNumber): string {
        if (quote.kind === 'single') {
            return this.buildSingleHopSwapData(quote, amountIn, amountOutMin)
        }
        return this.buildMultiHopSwapData(quote, amountIn, amountOutMin)
    }

    private buildSingleHopSwapData(quote: SingleHopQuote, amountIn: BigNumber, amountOutMin: BigNumber): string {
        const inputCurrency = quote.zeroForOne ? quote.poolKey.currency0 : quote.poolKey.currency1
        const outputCurrency = quote.zeroForOne ? quote.poolKey.currency1 : quote.poolKey.currency0

        const swapParams = utils.defaultAbiCoder.encode(
            ['tuple(tuple(address,address,uint24,int24,address),bool,uint128,uint128,bytes)'],
            [
                [
                    [
                        quote.poolKey.currency0,
                        quote.poolKey.currency1,
                        quote.poolKey.fee,
                        quote.poolKey.tickSpacing,
                        quote.poolKey.hooks,
                    ],
                    quote.zeroForOne,
                    amountIn,
                    amountOutMin,
                    '0x',
                ],
            ]
        )

        const settleParams = utils.defaultAbiCoder.encode(['address', 'uint256'], [inputCurrency, constants.MaxUint256])
        const takeParams = utils.defaultAbiCoder.encode(['address', 'uint256'], [outputCurrency, 0])
        const actions = utils.hexlify([SWAP_EXACT_IN_SINGLE, SETTLE_ALL, TAKE_ALL])

        return utils.defaultAbiCoder.encode(['bytes', 'bytes[]'], [actions, [swapParams, settleParams, takeParams]])
    }

    /**
     * Builds V4_SWAP data for multi-hop using SWAP_EXACT_IN (0x07).
     * ExactInputParams: (Currency currencyIn, PathKey[] path, uint128 amountIn, uint128 amountOutMinimum)
     * PathKey: (Currency intermediateCurrency, uint24 fee, int24 tickSpacing, IHooks hooks, bytes hookData)
     */
    private buildMultiHopSwapData(quote: MultiHopQuote, amountIn: BigNumber, amountOutMin: BigNumber): string {
        const { hop1, hop2 } = quote

        // Derive currencyIn from hop1
        const currencyIn = hop1.zeroForOne ? hop1.poolKey.currency0 : hop1.poolKey.currency1
        // Intermediate currency is the output of hop1
        const intermediateCurrency = hop1.zeroForOne ? hop1.poolKey.currency1 : hop1.poolKey.currency0
        // Final output currency from hop2
        const outputCurrency = hop2.zeroForOne ? hop2.poolKey.currency1 : hop2.poolKey.currency0

        // PathKey[] — each entry describes a hop: destination currency + pool params
        const pathKeys = [
            [intermediateCurrency, hop1.poolKey.fee, hop1.poolKey.tickSpacing, hop1.poolKey.hooks, '0x'],
            [outputCurrency, hop2.poolKey.fee, hop2.poolKey.tickSpacing, hop2.poolKey.hooks, '0x'],
        ]

        const swapParams = utils.defaultAbiCoder.encode(
            ['tuple(address,tuple(address,uint24,int24,address,bytes)[],uint128,uint128)'],
            [[currencyIn, pathKeys, amountIn, amountOutMin]]
        )

        const settleParams = utils.defaultAbiCoder.encode(['address', 'uint256'], [currencyIn, constants.MaxUint256])
        const takeParams = utils.defaultAbiCoder.encode(['address', 'uint256'], [outputCurrency, 0])
        const actions = utils.hexlify([SWAP_EXACT_IN, SETTLE_ALL, TAKE_ALL])

        return utils.defaultAbiCoder.encode(['bytes', 'bytes[]'], [actions, [swapParams, settleParams, takeParams]])
    }

    /**
     * Builds UR.execute calldata with a single V4_SWAP command.
     * Used by initMulticallRouter (cross-chain path).
     */
    private buildUniversalRouterCallData(
        quote: QuoteResult,
        amountIn: BigNumber,
        amountOutMin: BigNumber
    ): { callData: string; callDataOffset: number; minReceivedOffset: number } {
        const v4SwapData = this.buildV4SwapData(quote, amountIn, amountOutMin)

        const universalRouterInterface = new utils.Interface(UNIVERSAL_ROUTER_ABI)
        const callData = universalRouterInterface.encodeFunctionData('execute', [
            utils.hexlify([V4_SWAP]),
            [v4SwapData],
            this.deadline,
        ])

        const callDataNoPrefix = callData.slice(2).toLowerCase()

        const amountInHex = amountIn.toHexString().slice(2).padStart(64, '0').toLowerCase()
        const amountInHexPos = callDataNoPrefix.indexOf(amountInHex)
        const callDataOffset = (amountInHexPos + 64) / 2

        const amountOutMinHex = amountOutMin.toHexString().slice(2).padStart(64, '0').toLowerCase()
        const amountOutMinHexPos = callDataNoPrefix.indexOf(amountOutMinHex, amountInHexPos + 64)
        const minReceivedOffset = (amountOutMinHexPos + 64) / 2

        return { callData, callDataOffset, minReceivedOffset }
    }
}
