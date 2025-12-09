import TronWeb from 'tronweb'
import { describe, expect, test } from 'vitest'

import type { SwapExactInParams, SwapExactInResult } from '../../../src'
import { ChainId, GAS_TOKEN, Percent, Symbiosis, TokenAmount, WETH } from '../../../src'
import { isWrapSupported, wrap } from '../../../src/crosschain/swapExactIn/wrap'

const symbiosis = new Symbiosis('mainnet', 'test')

const evmUserAddress = '0x93F68892E5BFB763B0E9aa101b694dFc708c2ca0'
const eth = GAS_TOKEN[ChainId.ETH_MAINNET]
const weth = WETH[ChainId.ETH_MAINNET]
const evmParams: SwapExactInParams = {
    symbiosis,
    tokenAmountIn: new TokenAmount(eth, '1000'),
    tokenOut: weth,
    from: evmUserAddress,
    to: evmUserAddress,
    slippage: 0,
    deadline: 0,
}

const tronUserAddress = 'TNNQT4PomAZXE2hSbYW6i1m29tVzNWaw8G'
const trx = GAS_TOKEN[ChainId.TRON_MAINNET]
const wtrx = WETH[ChainId.TRON_MAINNET]
const tronParams: SwapExactInParams = {
    symbiosis,
    tokenAmountIn: new TokenAmount(trx, '1000'),
    tokenOut: wtrx,
    from: tronUserAddress,
    to: tronUserAddress,
    slippage: 0,
    deadline: 0,
}
describe('#isWrapSupported', () => {
    test('ok', () => {
        const supported = isWrapSupported(evmParams)
        expect(supported).toBe(true)
    })
    test('unwrap', () => {
        const supported = isWrapSupported({
            ...evmParams,
            tokenAmountIn: new TokenAmount(weth, '0'),
            tokenOut: eth,
        })
        expect(supported).toBe(false)
    })
    test('different addresses', () => {
        const supported = isWrapSupported({
            ...evmParams,
            to: '0x1111111111111111111111111111111111111111',
        })
        expect(supported).toBe(false)
    })
    test('different chains', () => {
        const supported = isWrapSupported({
            ...evmParams,
            tokenAmountIn: new TokenAmount(GAS_TOKEN[ChainId.BSC_MAINNET], '0'),
        })
        expect(supported).toBe(false)
    })
})

describe('#wrap', () => {
    test('EVM response structure', async () => {
        const result = await wrap(evmParams)
        expect(result).toStrictEqual({
            kind: 'wrap',
            approveTo: weth.address,
            fees: [],
            priceImpact: new Percent('0', '10000'),
            routes: [
                {
                    provider: 'wrap',
                    tokens: [eth, weth],
                },
            ],
            tokenAmountOut: new TokenAmount(weth, '1000'),
            tokenAmountOutMin: new TokenAmount(weth, '1000'),
            transactionType: 'evm',
            transactionRequest: {
                data: '0xd0e30db0',
                value: '1000',
                to: weth.address,
                from: evmUserAddress,
                chainId: ChainId.ETH_MAINNET,
            },
        } as SwapExactInResult)
    })
    test('TRON response structure', async () => {
        const result = await wrap(tronParams)
        const wtrxNativeAddress = 'TNUC9Qb1rRpS5CbWLmNMxXBjyFoydXjWFR'

        expect(TronWeb.address.fromHex(wtrx.address)).toBe(wtrxNativeAddress)
        expect(result).toStrictEqual({
            kind: 'wrap',
            approveTo: wtrxNativeAddress,
            fees: [],
            priceImpact: new Percent('0', '10000'),
            routes: [
                {
                    provider: 'wrap',
                    tokens: [trx, wtrx],
                },
            ],
            tokenAmountOut: new TokenAmount(wtrx, '1000'),
            tokenAmountOutMin: new TokenAmount(wtrx, '1000'),
            transactionType: 'tron',
            transactionRequest: {
                call_value: '1000',
                chain_id: ChainId.TRON_MAINNET,
                contract_address: wtrxNativeAddress,
                fee_limit: 150000000,
                function_selector: 'deposit()',
                owner_address: tronUserAddress,
                raw_parameter: '',
            },
        } as SwapExactInResult)
    })
})
