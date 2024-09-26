import { describe, expect, test } from 'vitest'
import { ChainId, GAS_TOKEN, SwapExactInParams, Symbiosis, TokenAmount, WETH } from '../../../src'
import { feeCollectorSwap, isFeeCollectorSwapSupported } from '../../../src/crosschain/swapExactIn/feeCollectorSwap'

const symbiosis = new Symbiosis('mainnet', 'test')

const ethereumOnchainGateway = '0x38C5412464A03EfDc3820d227b24316C11729E0a'

const evmUserAddress = '0x93F68892E5BFB763B0E9aa101b694dFc708c2ca0'
const eth = GAS_TOKEN[ChainId.ETH_MAINNET]
const weth = WETH[ChainId.ETH_MAINNET]
const evmParams: SwapExactInParams = {
    symbiosis,
    tokenAmountIn: new TokenAmount(eth, '100000000000000000'),
    tokenOut: weth,
    from: evmUserAddress,
    to: evmUserAddress,
    slippage: 0,
    deadline: 0,
}

describe('#isFeeCollectorSwapSupported', () => {
    test('ok', () => {
        const supported = isFeeCollectorSwapSupported(evmParams)
        expect(supported).toBe(true)
    })
    test('different addresses', () => {
        const supported = isFeeCollectorSwapSupported({
            ...evmParams,
            to: '0x1111111111111111111111111111111111111111',
        })
        expect(supported).toBe(true)
    })
    test('different chains', () => {
        const supported = isFeeCollectorSwapSupported({
            ...evmParams,
            tokenOut: WETH[ChainId.BSC_MAINNET],
        })
        expect(supported).toBe(false)
    })
})

describe('#feeCollectorSwap', () => {
    test('EVM response structure', async () => {
        const result = await feeCollectorSwap(evmParams)

        expect(result.kind).toBe('onchain-swap')
        expect(result.approveTo).toBe(ethereumOnchainGateway) // important to give approve to gateway address
        expect(result.transactionType).toBe('evm')
        expect(result.fees).toStrictEqual([
            {
                provider: 'symbiosis',
                description: 'Symbiosis on-chain fee',
                value: new TokenAmount(eth, '150000000000000'),
            },
        ])
    })
})
