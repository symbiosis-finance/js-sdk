import { Percent, Token, TokenAmount } from '../../entities'
import { OctoPoolFeeCollector__factory, OmniPool, OmniPoolOracle } from '../contracts'
import { calculatePriceImpact, getMinAmount } from '../chainUtils'
import { Symbiosis } from '../symbiosis'
import { OmniPoolConfig } from '../types'
import { ChainId } from '../../constants'
import { BigNumber } from 'ethers'

interface ExtraFeeCollector {
    chainId: ChainId
    address: string
    eligibleChains: ChainId[]
}

const EXTRA_FEE_COLLECTORS: ExtraFeeCollector[] = [
    {
        // 0.6%
        chainId: ChainId.BOBA_BNB,
        address: '0xe8035f3e32E1728A0558B67C6F410607d7Da2B6b',
        eligibleChains: [],
    },
    {
        // 0.5%
        chainId: ChainId.BOBA_BNB,
        address: '0xe63a8E9fD72e70121f99974A4E288Fb9e8668BBe',
        eligibleChains: [],
    },
    {
        // 0.4%
        chainId: ChainId.BOBA_BNB,
        address: '0x5f5829F7CDca871b16ed76E498EeE35D4250738A',
        eligibleChains: [],
    },
    {
        // 0.3%
        chainId: ChainId.BOBA_BNB,
        address: '0x0E8c084c7Edcf863eDdf0579A013b5c9f85462a2',
        eligibleChains: [ChainId.CRONOS_MAINNET],
    },
    {
        // 0.2%
        chainId: ChainId.BOBA_BNB,
        address: '0x56aE0251a9059fb35C21BffBe127d8E769A34D0D',
        eligibleChains: [ChainId.TRON_MAINNET],
    },
    {
        // 0.1%
        chainId: ChainId.BOBA_BNB,
        address: '0x602Bf79772763fEe47701FA2772F5aA9d505Fbf4',
        eligibleChains: [ChainId.SEI_EVM_MAINNET],
    },
]

export class OmniTrade {
    public route!: Token[]
    public amountOut!: TokenAmount
    public amountOutMin!: TokenAmount
    public callData!: string
    public callDataOffset: number
    public priceImpact!: Percent

    public readonly pool: OmniPool
    public readonly poolOracle: OmniPoolOracle

    public constructor(
        public readonly tokenAmountIn: TokenAmount,
        public readonly tokenAmountInMin: TokenAmount,
        private readonly tokenOut: Token,
        private readonly slippage: number,
        private readonly deadline: number,
        private readonly symbiosis: Symbiosis,
        private readonly to: string,
        private readonly omniPoolConfig: OmniPoolConfig
    ) {
        this.pool = this.symbiosis.omniPool(omniPoolConfig)
        this.poolOracle = this.symbiosis.omniPoolOracle(omniPoolConfig)
        this.callDataOffset = 100
    }

    public async init() {
        this.route = [this.tokenAmountIn.token, this.tokenOut]

        const indexIn = this.symbiosis.getOmniPoolTokenIndex(this.omniPoolConfig, this.tokenAmountIn.token)
        const indexOut = this.symbiosis.getOmniPoolTokenIndex(this.omniPoolConfig, this.tokenOut)

        let amountIn = BigNumber.from(this.tokenAmountIn.raw.toString())
        let amountInMin = BigNumber.from(this.tokenAmountInMin.raw.toString())

        const preFeeCollector = this.getExtraFeeCollector(this.tokenAmountIn.token)
        const postFeeCollector = this.getExtraFeeCollector(this.tokenOut)

        const feeRateBase = BigNumber.from(10).pow(18)

        const [preFeeRate, postFeeRate] = await Promise.all([
            preFeeCollector ? this.getFeeRate(preFeeCollector) : BigNumber.from(0),
            postFeeCollector ? this.getFeeRate(postFeeCollector) : BigNumber.from(0),
        ])

        if (preFeeCollector) {
            amountIn = amountIn.sub(amountIn.mul(preFeeRate).div(feeRateBase))
            amountInMin = amountInMin.sub(amountInMin.mul(preFeeRate).div(feeRateBase))
        }

        let { actualToAmount: quote } = await this.poolOracle.quoteFrom(indexIn, indexOut, amountIn)

        let quoteMin = quote
        if (!amountIn.eq(amountInMin)) {
            const response = await this.poolOracle.quoteFrom(indexIn, indexOut, amountInMin)
            quoteMin = response.actualToAmount
        }

        if (postFeeCollector) {
            quote = quote.sub(quote.mul(postFeeRate).div(feeRateBase))
            quoteMin = quoteMin.sub(quoteMin.mul(postFeeRate).div(feeRateBase))
        }

        this.amountOut = new TokenAmount(this.tokenOut, quote.toString())

        const amountOutMinRaw = getMinAmount(this.slippage, quoteMin.toString())
        this.amountOutMin = new TokenAmount(this.tokenOut, amountOutMinRaw)

        this.callData = this.pool.interface.encodeFunctionData('swap', [
            indexIn,
            indexOut,
            this.tokenAmountIn.raw.toString(),
            amountOutMinRaw.toString(),
            this.to,
            this.deadline,
        ])

        const priceImpact = calculatePriceImpact(this.tokenAmountIn, this.amountOut)
        if (!priceImpact) {
            throw new Error('Cannot calculate priceImpact')
        }
        this.priceImpact = priceImpact

        return this
    }

    public buildFeePreCall() {
        return this.buildFeeCall(this.tokenAmountIn)
    }

    public buildFeePostCall() {
        return this.buildFeeCall(this.amountOut)
    }

    // private
    private async getFeeRate(extraFeeCollector: ExtraFeeCollector) {
        const { chainId, address } = extraFeeCollector
        const provider = this.symbiosis.getProvider(chainId)
        const feeCollector = OctoPoolFeeCollector__factory.connect(address, provider)
        return feeCollector.feeRate()
    }

    private getExtraFeeCollector(token: Token): ExtraFeeCollector | undefined {
        if (!token.chainFromId) {
            return undefined
        }
        return EXTRA_FEE_COLLECTORS.find((i) => {
            return i.chainId === this.omniPoolConfig.chainId && i.eligibleChains.includes(token.chainFromId as ChainId)
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
