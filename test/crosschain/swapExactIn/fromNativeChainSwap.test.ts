import { describe, expect, test, vi, beforeEach } from 'vitest'
import { ChainId, GAS_TOKEN, Percent, TokenAmount } from '../../../src'

vi.mock('../../../src/crosschain/swapExactIn/swapChangelly', async () => {
    const actual: any = await vi.importActual('../../../src/crosschain/swapExactIn/swapChangelly')
    const { GAS_TOKEN: GT } = await vi.importActual<any>('../../../src/entities/gasToken')
    const { ChainId: CID } = await vi.importActual<any>('../../../src/constants')
    const { Percent: P } = await vi.importActual<any>('../../../src/entities/fractions/percent')
    const { TokenAmount: TA } = await vi.importActual<any>('../../../src/entities/fractions/tokenAmount')
    const btcToken = GT[CID.BTC_MAINNET]
    const ZERO = new P('0', '10000')
    return {
        ...actual,
        isChangellyNativeSupported: () => true,
        changellyNativeSwap: vi.fn().mockResolvedValue({
            kind: 'changelly-deposit',
            transactionType: 'changelly',
            tokenAmountOut: new TA(btcToken, '90000000'),
            tokenAmountOutMin: new TA(btcToken, '90000000'),
            priceImpact: ZERO,
            approveTo: '',
            routes: [],
            fees: [],
            labels: [],
            transactionRequest: {},
        }),
    }
})

vi.mock('../../../src/crosschain/swapExactIn/swapThorChain/thorChainDepositSwap', async () => {
    const { GAS_TOKEN: GT } = await vi.importActual<any>('../../../src/entities/gasToken')
    const { ChainId: CID } = await vi.importActual<any>('../../../src/constants')
    const { Percent: P } = await vi.importActual<any>('../../../src/entities/fractions/percent')
    const { TokenAmount: TA } = await vi.importActual<any>('../../../src/entities/fractions/tokenAmount')
    const btcToken = GT[CID.BTC_MAINNET]
    const ZERO = new P('0', '10000')
    return {
        thorChainDepositSwap: vi.fn().mockResolvedValue({
            kind: 'thorchain-deposit',
            transactionType: 'thorchain',
            tokenAmountOut: new TA(btcToken, '95000000'),
            tokenAmountOutMin: new TA(btcToken, '95000000'),
            priceImpact: ZERO,
            approveTo: '',
            routes: [],
            fees: [],
            labels: [],
            transactionRequest: { inboundAddress: 'x', memo: 'm', expectedAmountOut: '95000000' },
        }),
    }
})

import { fromNativeChainSwap } from '../../../src/crosschain/swapExactIn/fromNativeChainSwap'

const btc = GAS_TOKEN[ChainId.BTC_MAINNET]
const ltc = GAS_TOKEN[ChainId.LTC_MAINNET]
const ZERO = new Percent('0', '10000')

describe('fromNativeChainSwap best-route', () => {
    beforeEach(() => vi.clearAllMocks())

    test('picks THORChain when its tokenAmountOut is larger', async () => {
        const result = await fromNativeChainSwap({
            tokenAmountIn: new TokenAmount(ltc, '100000000'),
            tokenOut: btc,
            from: 'ltc1q',
            to: 'bc1qn9esxuw8ca7ts8l6w66kdh800s09msvutydc46',
            selectMode: 'best_return',
            slippage: 100,
            deadline: 0,
            symbiosis: {} as any,
        })
        expect(result.kind).toBe('thorchain-deposit')
    })

    test('picks Changelly when its tokenAmountOut is larger', async () => {
        // Override THORChain mock to return less
        const dep = await import('../../../src/crosschain/swapExactIn/swapThorChain/thorChainDepositSwap')
        ;(dep.thorChainDepositSwap as any).mockResolvedValueOnce({
            kind: 'thorchain-deposit',
            transactionType: 'thorchain',
            tokenAmountOut: new TokenAmount(btc, '80000000'),
            tokenAmountOutMin: new TokenAmount(btc, '80000000'),
            priceImpact: ZERO,
            approveTo: '',
            routes: [],
            fees: [],
            labels: [],
            transactionRequest: { inboundAddress: 'x', memo: 'm', expectedAmountOut: '80000000' },
        })

        const result = await fromNativeChainSwap({
            tokenAmountIn: new TokenAmount(ltc, '100000000'),
            tokenOut: btc,
            from: 'ltc1q',
            to: 'bc1qn9esxuw8ca7ts8l6w66kdh800s09msvutydc46',
            selectMode: 'best_return',
            slippage: 100,
            deadline: 0,
            symbiosis: {} as any,
        })
        expect(result.kind).toBe('changelly-deposit')
    })
})
