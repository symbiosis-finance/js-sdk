import { Symbiosis } from './symbiosis'
import { chains, Token, TokenAmount } from '../entities'
import { ChainId } from '../constants'
import { Error, ErrorCode } from './error'
import { BridgeDirection, OmniPoolConfig, VolumeFeeCollector } from './types'
import { OctoPoolTrade } from './trade'
import { OctoPoolFeeCollector__factory } from './contracts'
import { BigNumber } from 'ethers'

interface VolumeFeeCall {
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

const VOLUME_FEE_COLLECTORS: VolumeFeeCollector[] = [
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
        eligibleChains: [ChainId.SEI_EVM_MAINNET, ChainId.MANTLE_MAINNET],
        default: true,
    },
    {
        chainId: ChainId.BOBA_BNB,
        address: '0x0f68eE6BD92dE3eD499142812C89F825e65d7241',
        feeRate: '500000000000000', // 0.05%
        eligibleChains: [],
    },
]

export interface TransitOutResult {
    trade: OctoPoolTrade
    postCall?: VolumeFeeCall
    amountOut: TokenAmount
    amountOutMin: TokenAmount
}

class OutNotInitializedError extends Error {
    constructor(msg?: string) {
        super(`Out is not initialized: ${msg}`)
    }
}

export class Transit {
    public direction: BridgeDirection
    public feeToken1: Token
    public feeToken2: Token | undefined

    protected volumeFeeCollector?: VolumeFeeCollector
    protected out?: TransitOutResult

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

    get amountOut(): TokenAmount {
        this.assertOutInitialized('amountOut')
        return this.out.amountOut
    }

    get amountOutMin(): TokenAmount {
        this.assertOutInitialized('amountOutMin')
        return this.out.amountOutMin
    }

    get trade(): OctoPoolTrade {
        this.assertOutInitialized('trade')
        return this.out.trade
    }

    get postCall(): VolumeFeeCall | undefined {
        this.assertOutInitialized('postCall')
        return this.out.postCall
    }

    public async init(): Promise<Transit> {
        const { tradeAmountIn, tradeAmountInMin } = this.getTradeAmountsIn(this.amountIn, this.amountInMin)
        const tradeTokenOut = this.getTradeTokenOut()

        const to = this.symbiosis.multicallRouter(this.omniPoolConfig.chainId).address

        const trade = await this.createOctoPoolTrade({
            tokenAmountIn: tradeAmountIn,
            tokenAmountInMin: tradeAmountInMin,
            tokenOut: tradeTokenOut,
            to,
        })

        const { amountOut, amountOutMin, postCall } = this.getAmountsOut(trade)

        this.out = {
            amountOut,
            amountOutMin,
            trade,
            postCall,
        }
        return this
    }

    public isV2() {
        return this.direction === 'v2'
    }

    public calls() {
        this.assertOutInitialized('calls')

        const calldatas = []
        const receiveSides = []
        const paths = []
        const offsets = []

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
        this.assertOutInitialized('getBridgeAmountIn')

        if (this.direction === 'burn') {
            return this.trade.amountOut
        }

        return this.amountIn
    }

    public applyFees(fee1: TokenAmount, fee2?: TokenAmount) {
        this.assertOutInitialized('applyFees')

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

        const { amountOut, amountOutMin, postCall } = this.getAmountsOut(this.trade)

        this.out = {
            trade: this.trade,
            postCall,
            amountOut,
            amountOutMin,
        }
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

    private getAmountsOut(trade: OctoPoolTrade): {
        amountOut: TokenAmount
        amountOutMin: TokenAmount
        postCall: VolumeFeeCall | undefined
    } {
        const { tokenAmountIn: tradeAmountIn, amountOut: tradeAmountOut, amountOutMin: tradeAmountOutMin } = trade
        let tradeAmountOutNew = tradeAmountOut
        let tradeAmountOutMinNew = tradeAmountOutMin
        let postCall: VolumeFeeCall | undefined = undefined
        const volumeFeeCollector = this.getVolumeFeeCollector(tradeAmountIn.token, tradeAmountOut.token)
        if (volumeFeeCollector) {
            postCall = Transit.buildFeeCall(tradeAmountOut, volumeFeeCollector)
            tradeAmountOutNew = Transit.applyVolumeFee(tradeAmountOut, volumeFeeCollector)
            tradeAmountOutMinNew = Transit.applyVolumeFee(tradeAmountOutMin, volumeFeeCollector)
        }

        if (this.direction === 'mint') {
            return {
                postCall,
                amountOut: tradeAmountOutNew,
                amountOutMin: tradeAmountOutMinNew,
            }
        }

        let amountOut = new TokenAmount(this.tokenOut, tradeAmountOutNew.raw)
        let amountOutMin = new TokenAmount(this.tokenOut, tradeAmountOutMinNew.raw)

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

        return {
            postCall,
            amountOut,
            amountOutMin,
        }
    }

    private getTradeAmountsIn(
        amountIn: TokenAmount,
        amountInMin: TokenAmount
    ): {
        tradeAmountIn: TokenAmount
        tradeAmountInMin: TokenAmount
    } {
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

    private getVolumeFeeCollector(tokenIn: Token, tokenOut: Token): VolumeFeeCollector | undefined {
        const chainEligibleFeeCollector = [...VOLUME_FEE_COLLECTORS].find((i) => {
            return (
                i.chainId === this.omniPoolConfig.chainId &&
                (i.eligibleChains.includes(tokenIn.chainFromId || tokenIn.chainId) ||
                    i.eligibleChains.includes(tokenOut.chainFromId || tokenOut.chainId))
            )
        })
        if (chainEligibleFeeCollector) {
            return chainEligibleFeeCollector
        }
        // get default volume fee collector
        return [...VOLUME_FEE_COLLECTORS].find((i) => {
            return i.chainId === this.omniPoolConfig.chainId && i.default
        })
    }

    private static buildFeeCall(tokenAmount: TokenAmount, volumeFeeCollector: VolumeFeeCollector): VolumeFeeCall {
        const calldata = OctoPoolFeeCollector__factory.createInterface().encodeFunctionData('collectFee', [
            tokenAmount.raw.toString(),
            tokenAmount.token.address,
        ])
        return {
            calldata,
            receiveSide: volumeFeeCollector.address,
            path: tokenAmount.token.address,
            offset: 36,
        }
    }

    private static applyVolumeFee(amount: TokenAmount, volumeFeeCollector: VolumeFeeCollector): TokenAmount {
        const feeRateBase = BigNumber.from(10).pow(18)
        const feeRate = BigNumber.from(volumeFeeCollector.feeRate)

        const amountBn = BigNumber.from(amount.raw.toString())
        const raw = amountBn.sub(amountBn.mul(feeRate).div(feeRateBase))
        return new TokenAmount(amount.token, raw.toString())
    }

    private static getDirection(chainIdIn: ChainId, chainIdOut: ChainId, hostChainId: ChainId): BridgeDirection {
        const withHostChain = chainIdIn === hostChainId || chainIdOut === hostChainId
        if (!withHostChain) {
            return 'v2'
        }

        const chainsExceptHostChain = chains.map((chain) => chain.id).filter((chainId) => chainId !== hostChainId)
        const chainsWithHostChain = [...chainsExceptHostChain, hostChainId]

        const indexIn = chainsWithHostChain.indexOf(chainIdIn)
        if (indexIn === -1) {
            throw new Error(`Chain ${chainIdIn} not found in chains priority`)
        }
        const indexOut = chainsWithHostChain.indexOf(chainIdOut)
        if (indexOut === -1) {
            throw new Error(`Chain ${chainIdOut} not found in chains priority`)
        }

        return indexIn > indexOut ? 'burn' : 'mint'
    }

    private assertOutInitialized(msg?: string): asserts this is {
        out: TransitOutResult
    } {
        if (!this.out) {
            throw new OutNotInitializedError(msg)
        }
    }
}
