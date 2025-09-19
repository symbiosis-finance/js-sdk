import { Address, beginCell, Cell, OpenedContract, toNano } from '@ton/core'
import {
    Asset,
    Factory,
    JettonRoot,
    JettonWallet,
    MAINNET_FACTORY_ADDR,
    PoolType,
    ReadinessStatus,
    VaultJetton,
    VaultNative,
    Pool,
} from '@dedust/sdk'

import { GAS_TOKEN, Percent, Token, TokenAmount } from '../../entities'
import { TON_REFERRAL_ADDRESS } from '../chainUtils'
import { Symbiosis } from '../symbiosis'
import { SymbiosisTrade, SymbiosisTradeParams, SymbiosisTradeType } from './symbiosisTrade'
import { getTokenAmountUsd, getTokenPriceUsd } from '../coingecko'
import JSBI from 'jsbi'
import { BIPS_BASE } from '../constants'
import { ChainId } from '../../constants'
import { Address as AddressType, FeeItem } from '../types'

interface DedustTradeParams extends SymbiosisTradeParams {
    symbiosis: Symbiosis
    tokenAmountInMin: TokenAmount
    deadline: number
    from: string
}

interface JettonSwapParams {
    queryId?: number | bigint
    destination: Address
    amountIn: bigint
    responseAddress?: Address | null
    poolAddress: Address
    recipientAddress?: Address | null
    minAmountOut: bigint
}

interface MultiHopSwapParams {
    queryId?: number | bigint
    destination: Address
    amountIn: bigint
    responseAddress?: Address | null
    poolAddressTonOut: Address
    poolAddressTonIn: Address
    minAmountTon: bigint
    minAmountOut: bigint
}

interface TonSwapParams {
    queryId?: number | bigint
    poolAddress: Address
    value: bigint
    minAmountOut: bigint
}

interface CallDataResult {
    expectedAmountOut: bigint
    minAmountOut: bigint
    to: Address
    body: Cell
    value: bigint
    fees: FeeItem[]
}

export class DedustTrade extends SymbiosisTrade {
    public readonly symbiosis: Symbiosis
    public readonly deadline: number
    public readonly to: string
    public readonly from: string

    public constructor(params: DedustTradeParams) {
        super(params)

        const { symbiosis, deadline, to, from } = params

        this.symbiosis = symbiosis
        this.deadline = deadline
        this.to = to
        this.from = from
    }

    get tradeType(): SymbiosisTradeType {
        return 'dedust'
    }

    public async init() {
        const { expectedAmountOut, minAmountOut, to, body, value, fees } = await this.buildCalldata(
            this.tokenAmountIn,
            this.tokenOut
        )

        const amountOut = new TokenAmount(this.tokenOut, expectedAmountOut)
        const amountOutMin = new TokenAmount(this.tokenOut, minAmountOut)

        const priceImpact = await this.getPriceImpact(this.tokenAmountIn, amountOut)

        this.out = {
            amountOut,
            amountOutMin,
            route: [this.tokenAmountIn.token, this.tokenOut],
            priceImpact,
            routerAddress: (to.toString() ?? '') as AddressType, // TODO: is .toString() really needed and why?
            callData: body?.toBoc().toString('base64') ?? '',
            callDataOffset: 0,
            minReceivedOffset: 0,
            value,
            fees,
        }

        return this
    }

    private async getTokenPrice(token: Token) {
        return this.symbiosis.cache.get(
            ['getTokenPriceUsd', token.chainId.toString(), token.address],
            () => {
                return getTokenPriceUsd(token)
            },
            600 // 10 minutes
        )
    }

    private async getPriceImpact(tokenAmountIn: TokenAmount, tokenAmountOut: TokenAmount): Promise<Percent> {
        try {
            const [tokenInPrice, tokenOutPrice] = await Promise.all([
                this.getTokenPrice(tokenAmountIn.token),
                this.getTokenPrice(tokenAmountOut.token),
            ])
            const tokenAmountInUsd = getTokenAmountUsd(tokenAmountIn, tokenInPrice)
            const tokenAmountOutUsd = getTokenAmountUsd(tokenAmountOut, tokenOutPrice)

            const impactNumber = -(1 - tokenAmountOutUsd / tokenAmountInUsd)

            return new Percent(parseInt(`${impactNumber * JSBI.toNumber(BIPS_BASE)}`).toString(), BIPS_BASE)
        } catch {
            return new Percent('0', BIPS_BASE)
        }
    }

    private async findPool(tokenAmountIn: TokenAmount, tokenOut: Token) {
        const client = await this.symbiosis.getTonClient()
        const factory = client.open(Factory.createFromAddress(MAINNET_FACTORY_ADDR))

        let pool: OpenedContract<Pool>
        let secondPool: OpenedContract<Pool> | null = null // only for multihop

        // TON -> jetton
        if (tokenAmountIn.token.isNative) {
            const tonVault = client.open(await factory.getNativeVault())
            const tokenB = Asset.jetton(Address.parse(tokenOut.tonAddress))

            pool = client.open(await factory.getPool(PoolType.VOLATILE, [Asset.native(), tokenB]))

            if ((await tonVault.getReadinessStatus()) !== ReadinessStatus.READY) {
                throw new Error('Vault (TON) Dedust does not exist.')
            }
        } else if (tokenOut.isNative) {
            const tokenA = Asset.jetton(Address.parse(tokenAmountIn.token.tonAddress))

            // jetton -> TON
            pool = client.open(await factory.getPool(PoolType.VOLATILE, [tokenA, Asset.native()]))
        } else {
            const tokenA = Asset.jetton(Address.parse(tokenAmountIn.token.tonAddress))
            const tokenB = Asset.jetton(Address.parse(tokenOut.tonAddress))

            // jetton -> jetton
            pool = client.open(await factory.getPool(PoolType.VOLATILE, [tokenA, tokenB]))

            if ((await pool.getReadinessStatus()) !== ReadinessStatus.READY) {
                // No direct pool. Try jetton -> TON -> jetton
                const [poolTonOut, poolTonIn] = await Promise.all([
                    client.open(
                        await factory.getPool(PoolType.VOLATILE, [
                            Asset.jetton(Address.parse(tokenAmountIn.token.tonAddress)),
                            Asset.native(),
                        ])
                    ),
                    client.open(
                        await factory.getPool(PoolType.VOLATILE, [
                            Asset.native(),
                            Asset.jetton(Address.parse(tokenOut.tonAddress)),
                        ])
                    ),
                ])

                if (
                    (await poolTonIn.getReadinessStatus()) === ReadinessStatus.READY &&
                    (await poolTonOut.getReadinessStatus()) === ReadinessStatus.READY
                ) {
                    pool = poolTonOut
                    secondPool = poolTonIn
                } else {
                    throw new Error('Dedust can not find pool for this trade')
                }
            }
        }

        return { pool, secondPool }
    }

    public async buildCalldata(tokenAmountIn: TokenAmount, tokenOut: Token): Promise<CallDataResult> {
        const client = await this.symbiosis.getTonClient()
        const factory = client.open(Factory.createFromAddress(MAINNET_FACTORY_ADDR))
        const tonVault = client.open(await factory.getNativeVault())
        const isTonIn = tokenAmountIn.token.isNative

        const tokenIn = isTonIn ? Asset.native() : Asset.jetton(Address.parse(tokenAmountIn.token.tonAddress))

        const { pool, secondPool } = await this.findPool(tokenAmountIn, tokenOut)

        let expectedAmountOut: bigint
        let minAmountOut: bigint
        let minAmountTon: bigint = BigInt(0)
        const fees: FeeItem[] = []

        // multihop swap jetton -> ton -> jetton
        if (secondPool) {
            const {
                amountOut: tonAmountOut,
                assetOut: tonOut,
                tradeFee: firstPoolTradeFee,
            } = await pool.getEstimatedSwapOut({
                assetIn: tokenIn,
                amountIn: BigInt(tokenAmountIn.raw.toString()),
            })

            minAmountTon = (tonAmountOut * BigInt(10000 - this.slippage / 2)) / BigInt(10000)

            const { amountOut: estimatedAmountOut, tradeFee: secondPoolTradeFee } =
                await secondPool.getEstimatedSwapOut({
                    assetIn: tonOut,
                    amountIn: tonAmountOut,
                })

            fees.push({
                provider: 'dedust',
                value: new TokenAmount(GAS_TOKEN[ChainId.TON_MAINNET], firstPoolTradeFee),
                description: 'Dedust fee',
            })
            fees.push({
                provider: 'dedust',
                value: new TokenAmount(tokenOut, secondPoolTradeFee),
                description: 'Dedust fee',
            })
            minAmountOut = (estimatedAmountOut * BigInt(10000 - this.slippage / 2)) / BigInt(10000)
            expectedAmountOut = estimatedAmountOut
        } else {
            // single hop swap
            const { amountOut: estimatedAmountOut, tradeFee } = await pool.getEstimatedSwapOut({
                assetIn: tokenIn,
                amountIn: BigInt(tokenAmountIn.raw.toString()),
            })

            fees.push({
                provider: 'dedust',
                value: new TokenAmount(tokenOut, tradeFee),
                description: 'Dedust fee',
            })
            minAmountOut = (estimatedAmountOut * BigInt(10000 - this.slippage)) / BigInt(10000)
            expectedAmountOut = estimatedAmountOut
        }

        let txParams: { body: Cell; value: bigint } | null = null
        let tokenInWalletAddress: Address | null = null

        // TON -> jetton
        if (isTonIn) {
            // Check if vault exits:
            if ((await tonVault.getReadinessStatus()) !== ReadinessStatus.READY) {
                throw new Error('Vault (TON) does not exist.')
            }

            txParams = this.buildTonSwapCalldata({
                queryId: 0,
                poolAddress: pool.address,
                value: BigInt(tokenAmountIn.raw.toString()),
                minAmountOut,
            })
        } else if (tokenOut.isNative && tokenIn.address) {
            const tokenInVault = client.open(await factory.getJettonVault(tokenIn.address))
            const tokenInRoot = client.open(JettonRoot.createFromAddress(tokenIn.address))
            tokenInWalletAddress = client.open(await tokenInRoot.getWallet(Address.parse(this.from))).address

            txParams = this.buildJettonSwapCalldata({
                queryId: 0,
                poolAddress: pool.address,
                destination: tokenInVault.address,
                amountIn: BigInt(tokenAmountIn.raw.toString()),
                responseAddress: Address.parse(this.from),
                minAmountOut,
            })
        } else if (tokenIn.address) {
            const tokenInVault = client.open(await factory.getJettonVault(tokenIn.address))
            const tokenInRoot = client.open(JettonRoot.createFromAddress(tokenIn.address))
            tokenInWalletAddress = client.open(await tokenInRoot.getWallet(Address.parse(this.from))).address

            // jetton -> jetton

            if (secondPool) {
                txParams = this.buildMultiHopSwapCalldata({
                    queryId: 0,
                    amountIn: BigInt(tokenAmountIn.raw.toString()),
                    destination: tokenInVault.address,
                    poolAddressTonOut: pool.address,
                    poolAddressTonIn: secondPool.address,
                    responseAddress: Address.parse(this.from),
                    minAmountTon,
                    minAmountOut,
                })
            } else {
                txParams = this.buildJettonSwapCalldata({
                    queryId: 0,
                    poolAddress: pool.address,
                    destination: tokenInVault.address,
                    amountIn: BigInt(tokenAmountIn.raw.toString()),
                    responseAddress: Address.parse(this.from),
                    minAmountOut,
                })
            }
        } else {
            throw new Error('Failed to build calldata for dedust trade')
        }

        if (!txParams) {
            throw new Error("Dedust doesn't support this trade")
        }

        return {
            expectedAmountOut,
            minAmountOut,
            to: tokenInWalletAddress ? tokenInWalletAddress : tonVault.address,
            body: txParams?.body,
            value: txParams?.value,
            fees,
        }
    }

    buildTonSwapCalldata({ queryId, poolAddress, value, minAmountOut }: TonSwapParams) {
        return {
            body: beginCell()
                .storeUint(VaultNative.SWAP, 32)
                .storeUint(queryId ?? 0, 64)
                .storeCoins(value)
                .storeAddress(poolAddress)
                .storeUint(0, 1)
                .storeCoins(minAmountOut) // limit
                .storeMaybeRef(null) // next
                .storeRef(
                    beginCell()
                        .storeUint(0, 32) // deadline
                        .storeAddress(Address.parse(this.to)) // recipientAddress
                        .storeAddress(TON_REFERRAL_ADDRESS) // referralAddress
                        .storeMaybeRef(null) // fulfillPayload
                        .storeMaybeRef(null) // rejectPayload
                        .endCell()
                )
                .endCell(),
            value: value + toNano('0.25'),
        }
    }

    buildJettonSwapCalldata({
        queryId,
        amountIn,
        destination,
        responseAddress,
        poolAddress,
        minAmountOut,
    }: JettonSwapParams) {
        return {
            value: toNano('0.3'),
            body: beginCell()
                .storeUint(JettonWallet.TRANSFER, 32)
                .storeUint(queryId ?? 0, 64)
                .storeCoins(amountIn)
                .storeAddress(destination)
                .storeAddress(responseAddress)
                .storeMaybeRef(null)
                .storeCoins(toNano('0.25')) // forwardAmount
                .storeMaybeRef(
                    VaultJetton.createSwapPayload({
                        poolAddress,
                        limit: minAmountOut,
                        swapParams: {
                            recipientAddress: Address.parse(this.to),
                            referralAddress: TON_REFERRAL_ADDRESS,
                        },
                    })
                )
                .endCell(),
        }
    }

    buildMultiHopSwapCalldata({
        queryId,
        amountIn,
        destination,
        responseAddress,
        poolAddressTonOut,
        poolAddressTonIn,
        minAmountTon,
        minAmountOut,
    }: MultiHopSwapParams) {
        return {
            value: toNano('0.3'),
            body: beginCell()
                .storeUint(JettonWallet.TRANSFER, 32)
                .storeUint(queryId ?? 0, 64)
                .storeCoins(amountIn)
                .storeAddress(destination)
                .storeAddress(responseAddress)
                .storeMaybeRef(null)
                .storeCoins(toNano('0.25')) // forwardAmount
                .storeMaybeRef(
                    VaultJetton.createSwapPayload({
                        poolAddress: poolAddressTonOut,
                        limit: minAmountTon,
                        swapParams: {
                            recipientAddress: Address.parse(this.to),
                            referralAddress: TON_REFERRAL_ADDRESS,
                        },
                        next: {
                            poolAddress: poolAddressTonIn,
                            limit: minAmountOut,
                        },
                    })
                )
                .endCell(),
        }
    }
}
