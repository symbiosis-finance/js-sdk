import { BigNumber } from 'ethers'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { ChainId, Symbiosis, Token, TokenAmount } from '../../src'
import { OctoPoolTrade } from '../../src/crosschain/trade'
import { Transit } from '../../src/crosschain/transit'

const DECIMALS = BigNumber.from(10).pow(18)

describe('Transit#Fees', async () => {
    const symbiosis = new Symbiosis('mainnet', 'test')
    const omniPoolConfig = symbiosis.config.omniPools[0]

    const tokenIn = new Token({
        address: '0xa614f803b6fd780986a42c78ec9c7f77e6ded13c',
        symbol: 'USDC',
        decimals: 6,
        chainId: ChainId.TRON_MAINNET,
    })
    const tokenAmountIn = new TokenAmount(tokenIn, BigNumber.from(100).mul(DECIMALS).toString())
    const tokenAmountInMin = new TokenAmount(tokenIn, BigNumber.from(90).mul(DECIMALS).toString())

    const tokenOut = new Token({
        address: '0x3894085Ef7Ff0f0aeDf52E2A2704928d1Ec074F1',
        symbol: 'USDC',
        decimals: 6,
        chainId: ChainId.SEI_EVM_MAINNET,
    })
    const slippage = 100
    const deadline = Math.floor(Date.now() / 1000) + 3600

    const tradeTokenIn = new Token({
        decimals: 6,
        symbol: 'sUSDT',
        name: 'Synthetic USDT From Tron',
        chainId: ChainId.SYMBIOSIS_MAINNET,
        icons: {
            large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/825.png',
            small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/825.png',
        },
        chainFromId: ChainId.TRON_MAINNET,
        address: '0x4e7498c4db259065b73d21c81A5b41cadbEc7d4D',
    })

    // const tradeTokenOut = new Token({
    //     decimals: 6,
    //     symbol: 'sUSDC',
    //     name: 'Synthetic USDС From Sei',
    //     chainId: ChainId.SYMBIOSIS_MAINNET,
    //     isNative: false,
    //     icons: {
    //         large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/3408.png',
    //         small: 'https://s2.coinmarketcap.com/static/img/coins/128x128/3408.png',
    //     },
    //     chainFromId: ChainId.SEI_EVM_MAINNET,
    //     address: '0x90CaF0F3FE4Ae3282F8F97A2aA691b0CB8d48c13',
    // })

    const feeToken1 = tradeTokenIn
    const feeToken2 = tokenOut
    // const fee1 = new TokenAmount(feeToken1, BigNumber.from('10').mul(DECIMALS).toString())
    // const fee2 = new TokenAmount(feeToken2, BigNumber.from('20').mul(DECIMALS).toString())

    // mock permanently
    const quote = BigNumber.from('80').mul(DECIMALS)
    const quoteSpy = vi.spyOn(OctoPoolTrade.prototype, 'quote').mockResolvedValue(quote)
    const createOctoPoolTradeSpy = vi.spyOn(Transit.prototype, 'createOctoPoolTrade')

    const newTransit = (fee1?: TokenAmount, fee2?: TokenAmount, partnerAddress?: string): Transit => {
        return new Transit({
            symbiosis,
            amountIn: tokenAmountIn,
            amountInMin: tokenAmountInMin,
            tokenOut,
            slippage,
            deadline,
            omniPoolConfig,
            fee1,
            fee2,
            partnerAddress,
        })
    }

    beforeEach(() => {
        vi.clearAllMocks()
    })

    test('constructor', () => {
        const transit = newTransit()
        expect(quoteSpy).toHaveBeenCalledTimes(0)
        expect(createOctoPoolTradeSpy).toHaveBeenCalledTimes(0)
        expect(transit.direction).toEqual('v2')
        expect(transit.isV2()).toBeTruthy()
        expect(transit.feeToken1).toEqual(feeToken1)
        expect(transit.feeToken2).toEqual(feeToken2)
    })

    test('NO PARTNER ADDRESS SET', async () => {
        const transit = await newTransit().init()
        expect(quoteSpy).toHaveBeenCalledOnce()
        expect(createOctoPoolTradeSpy).toHaveBeenCalledOnce()
        expect(transit.calls()).toBeDefined()
        expect(transit.calls()?.calldatas.length).toEqual(1) // pool swap call only
    })

    // test('PARTNER ADDRESS SET', async () => {
    //     const cacheGetSpy = vi.spyOn(Cache.prototype, 'get').mockResolvedValue({
    //         isActive: true,
    //         feeRate: BigNumber.from(1),
    //     })
    //
    //     const transit = await newTransit(undefined, undefined, '0x04fDE790D26Da69AA9178249EAD6863977684e9D').init()
    //     expect(quoteSpy).toHaveBeenCalledOnce()
    //     expect(createOctoPoolTradeSpy).toHaveBeenCalledOnce()
    //     expect(transit.calls()).toBeDefined()
    //     expect(transit.calls()?.calldatas.length).toEqual(2) // pool swap call + partner fee call only
    //     // 80 (mock quote)
    //     expect(transit.trade.amountOut.token).toEqual(tradeTokenOut)
    //     expect(transit.trade.amountOut.raw.toString()).toEqual('80000000000000000000')
    //
    //     // 80 (mock quote) * (90/100) - 1% (slippage)
    //     expect(transit.trade.amountOutMin.token).toEqual(tradeTokenOut)
    //     expect(transit.trade.amountOutMin.raw.toString()).toEqual('71280000000000000000')
    //
    //     // 80000000000000000000 - 0.2% of SEI extra fee (because we select max fee tron/sei)
    //     expect(transit.amountOut.token.equals(tokenOut)).toBeTruthy()
    //     expect(transit.amountOut.raw.toString()).toEqual('79840000000000000000')
    //
    //     // 80000000000000000000 * (90/100) - 1% (slippage) - 0.2% of SEI extra fee (because we select max fee tron/sei)
    //     expect(transit.amountOutMin.token.equals(tokenOut)).toBeTruthy()
    //     expect(transit.amountOutMin.raw.toString()).toEqual('71137440000000000000')
    // })
    //
    // test('WITH PARTNER FEE', async () => {
    //     const transit = await newTransit(undefined, undefined, '0x04fDE790D26Da69AA9178249EAD6863977684e9D').init()
    //
    //     expect(quoteSpy).toHaveBeenCalledOnce()
    //     expect(createOctoPoolTradeSpy).toHaveBeenCalledOnce()
    //     expect(transit.calls()).toBeDefined()
    //     expect(transit.calls()?.calldatas.length).toEqual(3)
    // })
    //
    // test('WITH FEES SET', async () => {
    //     const transit = await newTransit(fee1, fee2).init()
    //
    //     expect(quoteSpy).toHaveBeenCalledOnce()
    //
    //     // const multicallRouterOnHostChain = '0xcB28fbE3E9C0FEA62E0E63ff3f232CECfE555aD4'
    //     // expect(createOctoPoolTradeSpy).toHaveBeenCalledWith({
    //     //     to: multicallRouterOnHostChain,
    //     //     // 100 - 10 (fee1) - 0.2% (Tron extraFee)
    //     //     tokenAmountIn: new TokenAmount(tradeTokenIn, '89820000000000000000'),
    //     //     // 90 - 10 (fee1) - 0.2% (Tron extraFee)
    //     //     tokenAmountInMin: new TokenAmount(tradeTokenIn, '79840000000000000000'),
    //     //     tokenOut: tradeTokenOut,
    //     // })
    //
    //     // 80 (mock quote)
    //     expect(transit.trade.amountOut.token).toEqual(tradeTokenOut)
    //     expect(transit.trade.amountOut.raw.toString()).toEqual('80000000000000000000')
    //
    //     // 80 (mock quote) * (80/90) - 1% (slippage)
    //     expect(transit.trade.amountOutMin.token).toEqual(tradeTokenOut)
    //     expect(transit.trade.amountOutMin.raw.toString()).toEqual('70399999999999999999')
    //
    //     // 80 (trade.amountOut) - 0.2% (SEI extraFee) - 20 (fee2) (because we select max fee tron/sei)
    //     expect(transit.amountOut.token.equals(tokenOut)).toBeTruthy()
    //     expect(transit.amountOut.raw.toString()).toEqual('59840000000000000000')
    //
    //     // 70399999999999999999 (trade.amountOutMin) - 0.1% (SEI extraFee) - 20 (fee2) (because we select max fee tron/sei)
    //     expect(transit.amountOutMin.token.equals(tokenOut)).toBeTruthy()
    //     expect(transit.amountOutMin.raw.toString()).toEqual('50259200000000000000')
    // })
    //
    // test('PATCHED FEES', async () => {
    //     const transit = await newTransit().init()
    //
    //     // before applying fees trade has default quote
    //     expect(transit.trade.amountOut.token).toEqual(tradeTokenOut)
    //     expect(transit.trade.amountOut.raw.toString()).toEqual('80000000000000000000')
    //     expect(transit.trade.amountOutMin.token).toEqual(tradeTokenOut)
    //     expect(transit.trade.amountOutMin.raw.toString()).toEqual('71280000000000000000')
    //
    //     const applyAmountInSpy = vi.spyOn(OctoPoolTrade.prototype, 'applyAmountIn')
    //     transit.applyFees(fee1, fee2)
    //
    //     expect(quoteSpy).toHaveBeenCalledTimes(1)
    //     expect(createOctoPoolTradeSpy).toHaveBeenCalledTimes(1)
    //
    //     return
    //     // 100 - 10 (fee1) - 0.2% (Tron extraFee)
    //     expect(applyAmountInSpy).toHaveBeenCalledWith(new TokenAmount(tradeTokenIn, '89820000000000000000'))
    //
    //     // new newAmountIn was set
    //     expect(transit.trade.tokenAmountIn.raw.toString()).toEqual('89820000000000000000')
    //
    //     // 80 * newAmountIn (above) / (100 - 0.2% (Tron extraFee))
    //     expect(transit.trade.amountOut.token).toEqual(tradeTokenOut)
    //     expect(transit.trade.amountOut.raw.toString()).toEqual('72000000000000000000')
    //
    //     // 71.28 * newAmountIn (above) / (100 - 0.2% (Tron extraFee))
    //     expect(transit.trade.amountOutMin.token).toEqual(tradeTokenOut)
    //     expect(transit.trade.amountOutMin.raw.toString()).toEqual('64152000000000000000')
    //
    //     // includes amountIn 89820000000000000000
    //     expect(transit.trade.callData.includes('4DE80BE1CFD960000'.toLowerCase())).toBeTruthy()
    //     // includes minReceived 64152000000000000000
    //     expect(transit.trade.callData.includes('37A49B01BAEDC0000'.toLowerCase())).toBeTruthy()
    //
    //     // 72000000000000000000 (trade.amountOut) - 0.1% (SEI extraFee) - 20 (fee2)
    //     expect(transit.amountOut.token.equals(tokenOut)).toBeTruthy()
    //     expect(transit.amountOut.raw.toString()).toEqual('51928000000000000000')
    //
    //     // 64152000000000000000 (trade.amountOutMin) - 0.1% (SEI extraFee) - 20 (fee2)
    //     expect(transit.amountOutMin.token.equals(tokenOut)).toBeTruthy()
    //     expect(transit.amountOutMin.raw.toString()).toEqual('44087848000000000000')
    // })
})
