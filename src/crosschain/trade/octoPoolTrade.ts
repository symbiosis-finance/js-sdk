import { Token, TokenAmount } from '../../entities'
import { OctoPoolFeeCollector__factory, OmniPool__factory } from '../contracts'
import { calculatePriceImpact, getMinAmount } from '../chainUtils'
import { Symbiosis } from '../symbiosis'
import { OmniPoolConfig } from '../types'
import { ChainId } from '../../constants'
import { BigNumber } from 'ethers'
import { SymbiosisTrade, SymbiosisTradeParams, SymbiosisTradeType } from './symbiosisTrade'

interface ExtraFeeCollector {
    chainId: ChainId
    address: string
    feeRate: string
    eligibleChains: ChainId[]
}

const EXTRA_FEE_COLLECTORS: ExtraFeeCollector[] = [
    {
        chainId: ChainId.BOBA_BNB,
        address: '0xe8035f3e32E1728A0558B67C6F410607d7Da2B6b',
        feeRate: '6000000000000000', // 0.6%
        eligibleChains: [],
    },
    {
        chainId: ChainId.BOBA_BNB,
        address: '0xe63a8E9fD72e70121f99974A4E288Fb9e8668BBe',
        feeRate: '5000000000000000', // 0.5%
        eligibleChains: [],
    },
    {
        chainId: ChainId.BOBA_BNB,
        address: '0x5f5829F7CDca871b16ed76E498EeE35D4250738A',
        feeRate: '4000000000000000', // 0.4%
        eligibleChains: [],
    },
    {
        chainId: ChainId.BOBA_BNB,
        address: '0x0E8c084c7Edcf863eDdf0579A013b5c9f85462a2',
        feeRate: '3000000000000000', // 0.3%
        eligibleChains: [ChainId.CRONOS_MAINNET],
    },
    {
        chainId: ChainId.BOBA_BNB,
        address: '0x56aE0251a9059fb35C21BffBe127d8E769A34D0D',
        feeRate: '2000000000000000', // 0.2%
        eligibleChains: [ChainId.TRON_MAINNET],
    },
    {
        chainId: ChainId.BOBA_BNB,
        address: '0x602Bf79772763fEe47701FA2772F5aA9d505Fbf4',
        feeRate: '1000000000000000', // 0.1%
        eligibleChains: [ChainId.SEI_EVM_MAINNET],
    },
]

const FEE_RATE_BASE = BigNumber.from(10).pow(18)

interface OctoPoolTradeParams extends SymbiosisTradeParams {
    symbiosis: Symbiosis
    tokenAmountInMin: TokenAmount
    deadline: number
    omniPoolConfig: OmniPoolConfig
}

export class OctoPoolTrade extends SymbiosisTrade {
    public readonly symbiosis: Symbiosis
    public readonly tokenAmountInMin: TokenAmount
    public readonly deadline: number
    public readonly poolConfig: OmniPoolConfig

    public constructor(params: OctoPoolTradeParams) {
        super(params)

        const { symbiosis, omniPoolConfig, tokenAmountInMin, deadline } = params
        this.symbiosis = symbiosis
        this.tokenAmountInMin = tokenAmountInMin
        this.deadline = deadline
        this.poolConfig = omniPoolConfig
    }

    get tradeType(): SymbiosisTradeType {
        return 'octopool'
    }

    public async init() {
        const indexIn = this.symbiosis.getOmniPoolTokenIndex(this.poolConfig, this.tokenAmountIn.token)
        const indexOut = this.symbiosis.getOmniPoolTokenIndex(this.poolConfig, this.tokenOut)

        let amountIn = BigNumber.from(this.tokenAmountIn.raw.toString())
        let amountInMin = BigNumber.from(this.tokenAmountInMin.raw.toString())

        const preFeeCollector = this.getExtraFeeCollector(this.tokenAmountIn.token)
        if (preFeeCollector) {
            const preFeeRate = BigNumber.from(preFeeCollector.feeRate)
            amountIn = amountIn.sub(amountIn.mul(preFeeRate).div(FEE_RATE_BASE))
            amountInMin = amountInMin.sub(amountInMin.mul(preFeeRate).div(FEE_RATE_BASE))
        }

        const poolOracle = this.symbiosis.omniPoolOracle(this.poolConfig)
        let { actualToAmount: quote } = await poolOracle.quoteFrom(indexIn, indexOut, amountIn)

        let quoteMin = quote
        if (amountInMin.lt(amountIn)) {
            quoteMin = quote.mul(amountInMin).div(amountIn) // proportionally
        }

        quoteMin = BigNumber.from(getMinAmount(this.slippage, quoteMin.toString()).toString())

        const callData = OmniPool__factory.createInterface().encodeFunctionData('swap', [
            indexIn,
            indexOut,
            amountIn.toString(),
            quoteMin.toString(),
            this.to,
            this.deadline,
        ])

        const postFeeCollector = this.getExtraFeeCollector(this.tokenOut)
        if (postFeeCollector) {
            const postFeeRate = BigNumber.from(postFeeCollector.feeRate)
            quote = quote.sub(quote.mul(postFeeRate).div(FEE_RATE_BASE))
            quoteMin = quoteMin.sub(quoteMin.mul(postFeeRate).div(FEE_RATE_BASE))
        }

        const amountOut = new TokenAmount(this.tokenOut, quote.toString())
        const amountOutMin = new TokenAmount(this.tokenOut, quoteMin.toString())
        const priceImpact = calculatePriceImpact(this.tokenAmountIn, amountOut)

        this.out = {
            amountOut,
            amountOutMin,
            routerAddress: this.poolConfig.address,
            route: [this.tokenAmountIn.token, this.tokenOut],
            callData,
            callDataOffset: 100,
            minReceivedOffset: 132,
            priceImpact,
        }

        return this
    }

    public buildFeePreCall() {
        return this.buildFeeCall(this.tokenAmountIn)
    }

    public buildFeePostCall() {
        return this.buildFeeCall(this.amountOut)
    }

    // private

    private getExtraFeeCollector(token: Token): ExtraFeeCollector | undefined {
        if (!token.chainFromId) {
            return undefined
        }
        return EXTRA_FEE_COLLECTORS.find((i) => {
            return i.chainId === this.poolConfig.chainId && i.eligibleChains.includes(token.chainFromId as ChainId)
        })
    }

    private buildFeeCall(tokenAmount: TokenAmount) {
        const extraFeeCollector = this.getExtraFeeCollector(tokenAmount.token)
        if (!extraFeeCollector) {
            return
        }

        const calldata = OctoPoolFeeCollector__factory.createInterface().encodeFunctionData('collectFee', [
            tokenAmount.raw.toString(),
            tokenAmount.token.address,
        ])
        return {
            calldata,
            receiveSide: extraFeeCollector.address,
            path: tokenAmount.token.address,
            offset: 36,
        }
    }
}
