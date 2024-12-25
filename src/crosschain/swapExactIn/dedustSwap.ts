import { SwapExactInParams, SwapExactInResult } from '../types'
import { getTonTokenAddress, TON_EVM_ADDRESS } from '../chainUtils'
import { DedustTrade } from '../trade/dedustTrade'
import { Asset, Factory, MAINNET_FACTORY_ADDR, PoolType, ReadinessStatus } from '@dedust/sdk'
import { Address } from '@ton/core'

export async function isDedustSwapSupported(context: SwapExactInParams): Promise<boolean> {
    const { tokenAmountIn, tokenOut, symbiosis } = context

    const isTonIn = tokenAmountIn.token.address === TON_EVM_ADDRESS
    const isTonOut = tokenOut.address === TON_EVM_ADDRESS

    const client = await symbiosis.getTonClient()

    const factory = client.open(Factory.createFromAddress(MAINNET_FACTORY_ADDR))

    // [TODO]: Select stable pool if USDC/TON
    const pool = client.open(
        await factory.getPool(PoolType.VOLATILE, [
            isTonIn ? Asset.native() : Asset.jetton(Address.parse(getTonTokenAddress(tokenAmountIn.token.address))),
            isTonOut ? Asset.native() : Asset.jetton(Address.parse(getTonTokenAddress(tokenOut.address))),
        ])
    )

    if ((await pool.getReadinessStatus()) !== ReadinessStatus.READY) {
        const [poolTonOut, poolTonIn] = await Promise.all([
            client.open(
                await factory.getPool(PoolType.VOLATILE, [
                    Asset.jetton(Address.parse(getTonTokenAddress(tokenAmountIn.token.address))),
                    Asset.native(),
                ])
            ),
            client.open(
                await factory.getPool(PoolType.VOLATILE, [
                    Asset.native(),
                    Asset.jetton(Address.parse(getTonTokenAddress(tokenOut.address))),
                ])
            ),
        ])

        if (
            (await poolTonOut.getReadinessStatus()) !== ReadinessStatus.READY ||
            (await poolTonIn.getReadinessStatus()) !== ReadinessStatus.READY
        ) {
            return false
        }
    }

    return true
}

export async function dedustSwap({
    symbiosis,
    tokenAmountIn,
    tokenOut,
    from,
    to,
    slippage,
    deadline,
}: SwapExactInParams): Promise<SwapExactInResult> {
    const trade = new DedustTrade({
        symbiosis,
        tokenAmountIn,
        tokenAmountInMin: tokenAmountIn,
        tokenOut,
        from,
        to,
        slippage,
        deadline,
    })

    await trade.init()

    return {
        kind: 'onchain-swap',
        tokenAmountOut: trade.amountOut,
        tokenAmountOutMin: trade.amountOutMin,
        priceImpact: trade.priceImpact,
        transactionType: 'ton',
        approveTo: '0x0000000000000000000000000000000000000000',
        transactionRequest: {
            validUntil: trade.deadline,
            messages: [
                {
                    address: trade.routerAddress,
                    amount: trade.value?.toString() ?? '0',
                    payload: trade.callData,
                },
            ],
        },
        fees: [],
        routes: [
            {
                provider: 'dedust',
                tokens: [tokenAmountIn.token, tokenOut],
            },
        ],
    }
}
