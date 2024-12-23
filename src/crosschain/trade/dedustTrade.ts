import { Address, beginCell, Cell, toNano } from '@ton/core'
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
} from '@dedust/sdk'

import { Percent, Token, TokenAmount } from '../../entities'
import { getTonTokenAddress, TON_EVM_ADDRESS, TON_REFERRAL_ADDRESS } from '../chainUtils'
import { Symbiosis } from '../symbiosis'
import { SymbiosisTrade, SymbiosisTradeParams, SymbiosisTradeType } from './symbiosisTrade'

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
}

interface TonSwapParams {
    queryId?: number | bigint
    poolAddress: Address
    value: bigint
}

interface CallDataResult {
    expectedAmountOut: bigint
    minAmountOut: bigint
    to: Address
    body: Cell
    value: bigint
}

export class DedustTrade extends SymbiosisTrade {
    public readonly symbiosis: Symbiosis
    public readonly deadline: number
    public readonly from: string

    public constructor(params: DedustTradeParams) {
        super(params)

        const { symbiosis, deadline, from } = params

        this.symbiosis = symbiosis
        this.deadline = deadline
        this.from = from
    }

    get tradeType(): SymbiosisTradeType {
        return 'dedust'
    }

    public async init() {
        const { expectedAmountOut, minAmountOut, to, body, value } = await this.buildCalldata(
            this.tokenAmountIn,
            this.tokenOut
        )

        const amountOut = new TokenAmount(this.tokenOut, expectedAmountOut)
        const amountOutMin = new TokenAmount(this.tokenOut, minAmountOut)

        this.out = {
            amountOut,
            amountOutMin,
            route: [this.tokenAmountIn.token, this.tokenOut],
            priceImpact: new Percent('0', '10000'), // [TODO]: calc
            routerAddress: to.toString() ?? '',
            callData: body?.toBoc().toString('base64') ?? '',
            callDataOffset: 0,
            minReceivedOffset: 0,
            value,
        }

        return this
    }

    public async buildCalldata(tokenAmountIn: TokenAmount, tokenOut: Token): Promise<CallDataResult> {
        const client = await this.symbiosis.getTonClient()
        const factory = client.open(Factory.createFromAddress(MAINNET_FACTORY_ADDR))
        const tonVault = client.open(await factory.getNativeVault())
        const isTonIn = tokenAmountIn.token.address === TON_EVM_ADDRESS

        let pool
        let assetIn: Asset
        let txParams: { body: Cell; value: bigint } | { value: bigint; payload: Cell } | null = null
        let tokenWalletAddress: Address | null = null
        // TON -> jetton
        if (isTonIn) {
            const tokenB = Asset.jetton(Address.parse(getTonTokenAddress(tokenOut.address)))

            pool = client.open(await factory.getPool(PoolType.VOLATILE, [Asset.native(), tokenB]))

            // Check if vault exits:
            if ((await tonVault.getReadinessStatus()) !== ReadinessStatus.READY) {
                throw new Error('Vault (TON) does not exist.')
            }

            txParams = this.buildTonSwapCalldata({
                queryId: 0,
                poolAddress: pool.address,
                value: BigInt(tokenAmountIn.raw.toString()),
            })
            assetIn = Asset.native()
        } else if (tokenOut.address === TON_EVM_ADDRESS) {
            const tonAddressIn = Address.parse(getTonTokenAddress(tokenAmountIn.token.address))
            const tokenAVault = client.open(await factory.getJettonVault(tonAddressIn))
            const tokenARoot = client.open(JettonRoot.createFromAddress(tonAddressIn))
            tokenWalletAddress = client.open(await tokenARoot.getWallet(Address.parse(this.from))).address

            const tokenA = Asset.jetton(Address.parse(getTonTokenAddress(tokenAmountIn.token.address)))

            // jetton -> TON
            pool = client.open(await factory.getPool(PoolType.VOLATILE, [tokenA, Asset.native()]))

            assetIn = tokenA
            txParams = this.buildJettonSwapCalldata({
                queryId: 0,
                poolAddress: pool.address,
                destination: tokenAVault.address,
                amountIn: BigInt(tokenAmountIn.raw.toString()),
            })
        } else {
            const tonAddressIn = Address.parse(getTonTokenAddress(tokenAmountIn.token.address))
            const tokenAVault = client.open(await factory.getJettonVault(tonAddressIn))
            const tokenARoot = client.open(JettonRoot.createFromAddress(tonAddressIn))
            tokenWalletAddress = client.open(await tokenARoot.getWallet(Address.parse(this.from))).address

            const tokenA = Asset.jetton(Address.parse(getTonTokenAddress(tokenAmountIn.token.address)))
            const tokenB = Asset.jetton(Address.parse(getTonTokenAddress(tokenOut.address)))
            // jetton -> jetton
            pool = client.open(await factory.getPool(PoolType.VOLATILE, [tokenA, tokenB]))

            assetIn = tokenA
            txParams = this.buildJettonSwapCalldata({
                queryId: 0,
                poolAddress: pool.address,
                destination: tokenAVault.address,
                amountIn: BigInt(tokenAmountIn.raw.toString()),
            })
        }

        const {
            amountOut: expectedAmountOut,
            tradeFee,
            assetOut,
        } = await pool.getEstimatedSwapOut({
            assetIn,
            amountIn: BigInt(tokenAmountIn.raw.toString()),
        })

        console.log('tradeFee dedust', tradeFee)
        console.log('assetOut dedust', assetOut)

        const minAmountOut = (expectedAmountOut * BigInt(10000 - this.slippage)) / BigInt(10000)

        return {
            expectedAmountOut,
            minAmountOut,
            to: tokenWalletAddress ? tokenWalletAddress : tonVault.address,
            body: txParams?.body,
            value: txParams?.value,
        }
    }

    buildTonSwapCalldata({ queryId, poolAddress, value }: TonSwapParams) {
        return {
            body: beginCell()
                .storeUint(VaultNative.SWAP, 32)
                .storeUint(queryId ?? 0, 64)
                .storeCoins(value)
                .storeAddress(poolAddress)
                .storeUint(0, 1)
                .storeCoins(0)
                .storeMaybeRef(null)
                .storeRef(
                    beginCell()
                        .storeUint(0, 32) // deadline
                        .storeAddress(Address.parse(this.from)) // recipientAddress
                        .storeAddress(TON_REFERRAL_ADDRESS) // referralAddress
                        .storeMaybeRef(null) // fulfillPayload
                        .storeMaybeRef(null) // rejectPayload
                        .endCell()
                )
                .endCell(),
            value: value + toNano('0.25'),
        }
    }

    buildJettonSwapCalldata({ queryId, amountIn, destination, responseAddress, poolAddress }: JettonSwapParams) {
        return {
            value: toNano('0.3'),
            body: beginCell()
                .storeUint(JettonWallet.TRANSFER, 32)
                .storeUint(queryId ?? 0, 64)
                .storeCoins(amountIn)
                .storeAddress(destination)
                .storeAddress(responseAddress)
                .storeMaybeRef(null)
                .storeCoins(toNano('0.25'))
                .storeMaybeRef(
                    VaultJetton.createSwapPayload({
                        poolAddress,
                        swapParams: {
                            recipientAddress: Address.parse(this.from),
                            referralAddress: TON_REFERRAL_ADDRESS,
                        },
                    })
                )
                .endCell(),
        }
    }
}
