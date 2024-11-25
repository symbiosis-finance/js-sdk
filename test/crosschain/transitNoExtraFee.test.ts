import { beforeEach, describe, expect, test, vi } from 'vitest'
import { ChainId, Symbiosis, Token, TokenAmount } from '../../src'
import { BigNumber } from 'ethers'
import { Transit } from '../../src/crosschain/transit'
import { OctoPoolTrade } from '../../src/crosschain/trade'

const DECIMALS = BigNumber.from(10).pow(18)

describe('Transit#NoExtraFee', async () => {
    const symbiosis = new Symbiosis('mainnet', 'test')
    const omniPoolConfig = symbiosis.config.omniPools[0]

    const tokenIn = new Token({
        address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        symbol: 'USDC',
        decimals: 6,
        chainId: ChainId.ETH_MAINNET,
    })
    const tokenAmountIn = new TokenAmount(tokenIn, BigNumber.from(100).mul(DECIMALS).toString())
    const tokenAmountInMin = new TokenAmount(tokenIn, BigNumber.from(90).mul(DECIMALS).toString())

    const tokenOut = new Token({
        address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
        symbol: 'USDC',
        decimals: 6,
        chainId: ChainId.BSC_MAINNET,
    })
    const slippage = 100
    const deadline = Math.floor(Date.now() / 1000) + 3600

    const tradeTokenIn = new Token({
        decimals: 6,
        symbol: 'sUSDC',
        name: 'Synthetic USD Coin from Ethereum',
        chainId: 56288,
        icons: {
            large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/3408.png',
            small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/3408.png',
        },
        chainFromId: 1,
        address: '0x7d6EC42b5d9566931560411a8652Cea00b90d982',
    })

    const tradeTokenOut = new Token({
        decimals: 18,
        symbol: 'sUSDC',
        name: 'Synthetic Binance-Peg USD Coin from BSC',
        chainId: 56288,
        icons: {
            large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/3408.png',
            small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/3408.png',
        },
        chainFromId: 56,
        address: '0x5e19eFc6AC9C80bfAA755259c9fab2398A8E87eB',
    })

    const feeToken1 = new Token({
        decimals: 6,
        symbol: 'sUSDC',
        name: 'Synthetic USD Coin from Ethereum',
        chainId: 56288,
        icons: {
            large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/3408.png',
            small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/3408.png',
        },
        chainFromId: 1,
        address: '0x7d6EC42b5d9566931560411a8652Cea00b90d982',
    })

    const feeToken2 = new Token({
        address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
        symbol: 'USDC',
        decimals: 6,
        chainId: ChainId.BSC_MAINNET,
    })
    const fee1 = new TokenAmount(feeToken1, BigNumber.from('10').mul(DECIMALS).toString())
    const fee2 = new TokenAmount(feeToken2, BigNumber.from('20').mul(DECIMALS).toString())

    // mock permanently
    const quote = BigNumber.from('80').mul(DECIMALS)
    const quoteSpy = vi.spyOn(OctoPoolTrade.prototype, 'quote').mockResolvedValue(quote)
    const createOctoPoolTradeSpy = vi.spyOn(Transit.prototype, 'createOctoPoolTrade')

    const newTransit = (fee1?: TokenAmount, fee2?: TokenAmount): Transit => {
        return new Transit(
            symbiosis,
            tokenAmountIn,
            tokenAmountInMin,
            tokenOut,
            slippage,
            deadline,
            omniPoolConfig,
            fee1,
            fee2
        )
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

    test('NO FEES SET', async () => {
        const transit = await newTransit().init()
        expect(quoteSpy).toHaveBeenCalledOnce()
        expect(createOctoPoolTradeSpy).toHaveBeenCalledOnce()
        expect(transit.calls()).toBeDefined()
        expect(transit.calls()?.calldatas.length).toEqual(1)
        const multicallRouterOnHostChain = '0xcB28fbE3E9C0FEA62E0E63ff3f232CECfE555aD4'
        expect(createOctoPoolTradeSpy).toHaveBeenCalledWith({
            to: multicallRouterOnHostChain,
            // 100
            tokenAmountIn: new TokenAmount(tradeTokenIn, '100000000000000000000'),
            // 90
            tokenAmountInMin: new TokenAmount(tradeTokenIn, '90000000000000000000'),
            tokenOut: tradeTokenOut,
        })

        // 80 (mock quote)
        expect(transit.trade.amountOut.token).toEqual(tradeTokenOut)
        expect(transit.trade.amountOut.raw.toString()).toEqual('80000000000000000000')

        // 80 (mock quote) * (90/100) - 1% (slippage)
        expect(transit.trade.amountOutMin.token).toEqual(tradeTokenOut)
        expect(transit.trade.amountOutMin.raw.toString()).toEqual('71280000000000000000')

        // 80000000000000000000
        expect(transit.amountOut.token.equals(tokenOut)).toBeTruthy()
        expect(transit.amountOut.raw.toString()).toEqual('80000000000000000000')

        // 80000000000000000000 * (90/100) - 1% (slippage)
        expect(transit.amountOutMin.token.equals(tokenOut)).toBeTruthy()
        expect(transit.amountOutMin.raw.toString()).toEqual('71280000000000000000')
    })

    test('WITH FEES SET', async () => {
        const transit = await newTransit(fee1, fee2).init()

        expect(quoteSpy).toHaveBeenCalledOnce()

        const multicallRouterOnHostChain = '0xcB28fbE3E9C0FEA62E0E63ff3f232CECfE555aD4'
        expect(createOctoPoolTradeSpy).toHaveBeenCalledWith({
            to: multicallRouterOnHostChain,
            // 100 - 10 (fee1)
            tokenAmountIn: new TokenAmount(tradeTokenIn, '90000000000000000000'),
            // 90 - 10 (fee1)
            tokenAmountInMin: new TokenAmount(tradeTokenIn, '80000000000000000000'),
            tokenOut: tradeTokenOut,
        })

        // 80 (mock quote)
        expect(transit.trade.amountOut.token).toEqual(tradeTokenOut)
        expect(transit.trade.amountOut.raw.toString()).toEqual('80000000000000000000')

        // 80 (mock quote) * (80/90) - 1% (slippage)
        expect(transit.trade.amountOutMin.token).toEqual(tradeTokenOut)
        expect(transit.trade.amountOutMin.raw.toString()).toEqual('70399999999999999999')

        // 80 (trade.amountOut) - 20 (fee2)
        expect(transit.amountOut.token.equals(tokenOut)).toBeTruthy()
        expect(transit.amountOut.raw.toString()).toEqual('60000000000000000000')

        // 70399999999999999999 (trade.amountOutMin) - 20 (fee2)
        expect(transit.amountOutMin.token.equals(tokenOut)).toBeTruthy()
        expect(transit.amountOutMin.raw.toString()).toEqual('50399999999999999999')
    })

    test('PATCHED FEES', async () => {
        const transit = await newTransit().init()

        // before applying fees trade has default quote
        expect(transit.trade.amountOut.token).toEqual(tradeTokenOut)
        expect(transit.trade.amountOut.raw.toString()).toEqual('80000000000000000000')
        expect(transit.trade.amountOutMin.token).toEqual(tradeTokenOut)
        expect(transit.trade.amountOutMin.raw.toString()).toEqual('71280000000000000000')

        const applyAmountInSpy = vi.spyOn(OctoPoolTrade.prototype, 'applyAmountIn')
        transit.applyFees(fee1, fee2)

        expect(quoteSpy).toHaveBeenCalledTimes(1)
        expect(createOctoPoolTradeSpy).toHaveBeenCalledTimes(1)

        // 100 - 10 (fee1)
        expect(applyAmountInSpy).toHaveBeenCalledWith(new TokenAmount(tradeTokenIn, '90000000000000000000'))

        // new newAmountIn was set
        expect(transit.trade.tokenAmountIn.raw.toString()).toEqual('90000000000000000000')

        // 80 * newAmountIn (above) / 100
        expect(transit.trade.amountOut.token).toEqual(tradeTokenOut)
        expect(transit.trade.amountOut.raw.toString()).toEqual('72000000000000000000')

        // 71.28 * newAmountIn (above) / 100
        expect(transit.trade.amountOutMin.token).toEqual(tradeTokenOut)
        expect(transit.trade.amountOutMin.raw.toString()).toEqual('64152000000000000000')

        // includes amountIn 90000000000000000000
        expect(transit.trade.callData.includes('4E1003B28D9280000'.toLowerCase())).toBeTruthy()
        // includes minReceived 64152000000000000000
        expect(transit.trade.callData.includes('37A49B01BAEDC0000'.toLowerCase())).toBeTruthy()

        // 72000000000000000000 (trade.amountOut) - 20 (fee2)
        expect(transit.amountOut.token.equals(tokenOut)).toBeTruthy()
        expect(transit.amountOut.raw.toString()).toEqual('52000000000000000000')

        // 64152000000000000000 (trade.amountOutMin) - 20 (fee2)
        expect(transit.amountOutMin.token.equals(tokenOut)).toBeTruthy()
        expect(transit.amountOutMin.raw.toString()).toEqual('44152000000000000000')
    })
})
