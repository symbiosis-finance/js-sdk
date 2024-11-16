import { Symbiosis } from './symbiosis'
import { Token, TokenAmount } from '../entities'
import { ChainId } from '../constants'
import { Error, ErrorCode } from './error'
import { CHAINS_PRIORITY } from './constants'
import { BridgeDirection, OmniPoolConfig } from './types'
import { OctoPoolTrade } from './trade'
import { OctoPoolFeeCollector__factory } from './contracts'
import { BigNumber } from 'ethers'

interface ExtraFeeCollector {
    chainId: ChainId
    address: string
    feeRate: string
    eligibleChains: ChainId[]
}

interface ExtraFeeCall {
    calldata: string
    receiveSide: string
    path: string
    offset: number
}

interface CreateOctoPoolTradeParams {
    tokenAmountIn: TokenAmount
    tokenAmountInMin: TokenAmount
    tokenOut: Token
    to: string
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

export class Transit {
    public direction: BridgeDirection
    public amountOut!: TokenAmount
    public amountOutMin!: TokenAmount
    public trade!: OctoPoolTrade
    public feeToken1: Token
    public feeToken2: Token | undefined

    private preCall?: ExtraFeeCall
    private postCall?: ExtraFeeCall

    public constructor(
        protected symbiosis: Symbiosis,
        public amountIn: TokenAmount,
        public amountInMin: TokenAmount,
        public tokenOut: Token,
        protected slippage: number,
        protected deadline: number,
        protected omniPoolConfig: OmniPoolConfig,
        public fee1?: TokenAmount,
        public fee2?: TokenAmount
    ) {
        this.direction = Transit.getDirection(amountIn.token.chainId, tokenOut.chainId, omniPoolConfig.chainId)

        this.feeToken1 = this.getFeeToken1()
        this.feeToken2 = this.getFeeToken2()

        if (fee1 && !this.feeToken1.equals(fee1.token)) {
            throw new Error('Incorrect fee1 token set')
        }
        if (fee2 && this.feeToken2 && !this.feeToken2.equals(fee2.token)) {
            throw new Error('Incorrect fee2 token set')
        }
    }

    public async init(): Promise<Transit> {
        const { tradeAmountIn, tradeAmountInMin } = this.getTradeAmountsIn(this.amountIn, this.amountInMin)
        const tradeTokenOut = this.getTradeTokenOut()

        const to = this.symbiosis.multicallRouter(this.omniPoolConfig.chainId).address

        this.trade = await this.createOctoPoolTrade({
            tokenAmountIn: tradeAmountIn,
            tokenAmountInMin: tradeAmountInMin,
            tokenOut: tradeTokenOut,
            to,
        })

        const { amountOut, amountOutMin } = this.getAmountsOut(this.trade.amountOut, this.trade.amountOutMin)

        this.amountOut = amountOut
        this.amountOutMin = amountOutMin

        return this
    }

    public isV2() {
        return this.direction === 'v2'
    }

    public calls() {
        if (!this.trade) {
            return undefined
        }

        const calldatas = []
        const receiveSides = []
        const paths = []
        const offsets = []

        if (this.preCall) {
            calldatas.push(this.preCall.calldata)
            receiveSides.push(this.preCall.receiveSide)
            paths.push(this.preCall.path)
            offsets.push(this.preCall.offset)
        }

        // octopool swap
        calldatas.push(this.trade.callData)
        receiveSides.push(this.trade.routerAddress)
        paths.push(...[this.trade.tokenAmountIn.token.address, this.trade.amountOut.token.address])
        offsets.push(this.trade.callDataOffset)

        if (this.postCall) {
            calldatas.push(this.postCall.calldata)
            receiveSides.push(this.postCall.receiveSide)
            paths.push(this.postCall.path)
            offsets.push(this.postCall.offset)
        }

        return {
            calldatas,
            receiveSides,
            paths,
            offsets,
        }
    }

    public getBridgeAmountIn(): TokenAmount {
        if (this.direction === 'burn') {
            return this.trade.amountOut
        }

        return this.amountIn
    }

    public applyFees(fee1: TokenAmount, fee2?: TokenAmount) {
        if (!fee1.token.equals(this.feeToken1)) {
            throw new Error('Incorrect fee1 token')
        }
        this.fee1 = fee1

        if (this.isV2()) {
            if (!fee2) {
                throw new Error('fee2 should be passed')
            }
            if (!this.feeToken2) {
                throw new Error('feeToken2 should have been initialized')
            }
            if (!fee2.token.equals(this.feeToken2)) {
                throw new Error('Incorrect fee2 token')
            }
            this.fee2 = fee2
        }

        const { tradeAmountIn: newAmountIn } = this.getTradeAmountsIn(this.amountIn, this.amountInMin)
        this.trade.applyAmountIn(newAmountIn)

        const { amountOut, amountOutMin } = this.getAmountsOut(this.trade.amountOut, this.trade.amountOutMin)
        this.amountOut = amountOut
        this.amountOutMin = amountOutMin
    }

    public async createOctoPoolTrade(params: CreateOctoPoolTradeParams) {
        const trade = new OctoPoolTrade({
            ...params,
            slippage: this.slippage,
            deadline: this.deadline,
            symbiosis: this.symbiosis,
            omniPoolConfig: this.omniPoolConfig,
        })
        await trade.init()

        return trade
    }

    // PRIVATE

    private getFeeToken1(): Token {
        if (this.direction === 'burn') {
            return this.tokenOut
        }

        const tokenIn = this.amountIn.token
        const sTokenChainId = this.isV2() ? this.omniPoolConfig.chainId : this.tokenOut.chainId
        const sToken = this.symbiosis.getRepresentation(tokenIn, sTokenChainId)
        if (!sToken) {
            throw new Error(
                `Representation of ${tokenIn.chainId}:${tokenIn.symbol} in chain ${sTokenChainId} not found`,
                ErrorCode.NO_REPRESENTATION_FOUND
            )
        }
        return sToken
    }

    private getFeeToken2(): Token | undefined {
        if (!this.isV2()) {
            return
        }

        return this.tokenOut
    }

    private getAmountsOut(
        tradeAmountOut: TokenAmount,
        tradeAmountOutMin: TokenAmount
    ): {
        amountOut: TokenAmount
        amountOutMin: TokenAmount
    } {
        if (this.direction === 'mint') {
            return {
                amountOut: tradeAmountOut,
                amountOutMin: tradeAmountOutMin,
            }
        }

        let amountOut = new TokenAmount(this.tokenOut, tradeAmountOut.raw)
        let amountOutMin = new TokenAmount(this.tokenOut, tradeAmountOutMin.raw)

        let fee = this.fee1
        if (this.isV2()) {
            fee = this.fee2
        }
        if (fee) {
            if (amountOutMin.lessThan(fee) || amountOutMin.equalTo(fee)) {
                throw new Error(
                    `Amount ${amountOutMin.toSignificant()} ${
                        amountOutMin.token.symbol
                    } less than fee ${fee.toSignificant()} ${fee.token.symbol}`,
                    ErrorCode.AMOUNT_LESS_THAN_FEE
                )
            }
            amountOut = amountOut.subtract(fee)
            amountOutMin = amountOutMin.subtract(fee)
        }

        const postFeeCollector = this.getExtraFeeCollector(amountOut.token)
        if (postFeeCollector) {
            this.postCall = Transit.buildFeeCall(amountOut, postFeeCollector)
            amountOut = Transit.applyExtraFee(amountOut, postFeeCollector)
            amountOut = Transit.applyExtraFee(amountOut, postFeeCollector)
        }

        return {
            amountOut,
            amountOutMin,
        }
    }

    private getTradeAmountsIn(
        amountIn: TokenAmount,
        amountInMin: TokenAmount
    ): { tradeAmountIn: TokenAmount; tradeAmountInMin: TokenAmount } {
        if (this.direction === 'burn') {
            return {
                tradeAmountIn: amountIn,
                tradeAmountInMin: amountInMin,
            }
        }

        let tradeAmountIn = new TokenAmount(this.feeToken1, amountIn.raw)
        let tradeAmountInMin = new TokenAmount(this.feeToken1, amountInMin.raw)
        if (this.fee1) {
            if (tradeAmountInMin.lessThan(this.fee1) || tradeAmountInMin.equalTo(this.fee1)) {
                throw new Error(
                    `Amount ${tradeAmountInMin.toSignificant()} ${
                        tradeAmountInMin.token.symbol
                    } less than fee ${this.fee1.toSignificant()} ${this.fee1.token.symbol}`,
                    ErrorCode.AMOUNT_LESS_THAN_FEE
                )
            }
            tradeAmountIn = tradeAmountIn.subtract(this.fee1)
            tradeAmountInMin = tradeAmountInMin.subtract(this.fee1)
        }

        const preFeeCollector = this.getExtraFeeCollector(tradeAmountIn.token)
        if (preFeeCollector) {
            this.preCall = Transit.buildFeeCall(tradeAmountIn, preFeeCollector)
            tradeAmountIn = Transit.applyExtraFee(tradeAmountIn, preFeeCollector)
            tradeAmountInMin = Transit.applyExtraFee(tradeAmountInMin, preFeeCollector)
        }

        return {
            tradeAmountIn,
            tradeAmountInMin,
        }
    }

    private getTradeTokenOut(): Token {
        if (this.direction === 'mint') {
            return this.tokenOut
        }

        const sTokenChainId = this.isV2() ? this.omniPoolConfig.chainId : this.amountIn.token.chainId
        const sToken = this.symbiosis.getRepresentation(this.tokenOut, sTokenChainId)
        if (!sToken) {
            throw new Error(
                `Representation of ${this.tokenOut.symbol} in chain ${sTokenChainId} not found`,
                ErrorCode.NO_REPRESENTATION_FOUND
            )
        }
        return sToken
    }

    private getExtraFeeCollector(token: Token): ExtraFeeCollector | undefined {
        if (!token.chainFromId) {
            return undefined
        }
        return EXTRA_FEE_COLLECTORS.find((i) => {
            return i.chainId === this.omniPoolConfig.chainId && i.eligibleChains.includes(token.chainFromId as ChainId)
        })
    }

    private static buildFeeCall(tokenAmount: TokenAmount, extraFeeCollector: ExtraFeeCollector): ExtraFeeCall {
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

    private static applyExtraFee(amount: TokenAmount, feeCollector: ExtraFeeCollector): TokenAmount {
        const feeRateBase = BigNumber.from(10).pow(18)
        const feeRate = BigNumber.from(feeCollector.feeRate)

        const amountBn = BigNumber.from(amount.raw.toString())
        const raw = amountBn.sub(amountBn.mul(feeRate).div(feeRateBase))
        return new TokenAmount(amount.token, raw.toString())
    }

    private static getDirection(chainIdIn: ChainId, chainIdOut: ChainId, omniPoolChainId?: ChainId): BridgeDirection {
        const withHostChain = chainIdIn === omniPoolChainId || chainIdOut === omniPoolChainId
        if (!withHostChain) {
            return 'v2'
        }

        const chainsPriorityWithHostChain = [...CHAINS_PRIORITY, omniPoolChainId]

        const indexIn = chainsPriorityWithHostChain.indexOf(chainIdIn)
        const indexOut = chainsPriorityWithHostChain.indexOf(chainIdOut)
        if (indexIn === -1) {
            throw new Error(`Chain ${chainIdIn} not found in chains priority`)
        }
        if (indexOut === -1) {
            throw new Error(`Chain ${chainIdOut} not found in chains priority`)
        }

        return indexIn > indexOut ? 'burn' : 'mint'
    }
}
