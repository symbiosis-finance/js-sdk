import { Symbiosis } from './symbiosis'
import { chains, Token, TokenAmount } from '../entities'
import { ChainId } from '../constants'
import { AmountLessThanFeeError, NoRepresentationFoundError, SdkError } from './sdkError'
import { BridgeDirection, MultiCallItem, OmniPoolConfig } from './types'
import { OctoPoolTrade } from './trade'
import { getPartnerFeeCall } from './feeCall/getPartnerFeeCall'
import { getVolumeFeeCall } from './feeCall/getVolumeFeeCall'

interface CreateOctoPoolTradeParams {
    tokenAmountIn: TokenAmount
    tokenAmountInMin: TokenAmount
    tokenOut: Token
    to: string
}

export interface TransitOutResult {
    trade: OctoPoolTrade
    amountOut: TokenAmount
    amountOutMin: TokenAmount
    volumeFeeCall?: MultiCallItem
    partnerFeeCall?: MultiCallItem
}

class OutNotInitializedError extends Error {
    constructor(msg?: string) {
        super(`Out is not initialized: ${msg}`)
    }
}

type TransitParams = {
    symbiosis: Symbiosis
    amountIn: TokenAmount
    amountInMin: TokenAmount
    tokenOut: Token
    slippage: number
    deadline: number
    omniPoolConfig: OmniPoolConfig
    fee1?: TokenAmount
    fee2?: TokenAmount
    partnerAddress?: string
}

export class Transit {
    public symbiosis: Symbiosis
    public amountIn: TokenAmount
    public amountInMin: TokenAmount
    public tokenOut: Token
    public slippage: number
    public deadline: number
    public omniPoolConfig: OmniPoolConfig
    public fee1?: TokenAmount
    public fee2?: TokenAmount
    public partnerAddress?: string
    public direction: BridgeDirection
    public feeToken1: Token
    public feeToken2: Token | undefined

    protected out?: TransitOutResult

    public constructor({
        symbiosis,
        amountIn,
        amountInMin,
        tokenOut,
        slippage,
        deadline,
        omniPoolConfig,
        fee1,
        fee2,
        partnerAddress,
    }: TransitParams) {
        this.symbiosis = symbiosis
        this.amountIn = amountIn
        this.amountInMin = amountInMin
        this.tokenOut = tokenOut
        this.slippage = slippage
        this.deadline = deadline
        this.omniPoolConfig = omniPoolConfig
        this.fee1 = fee1
        this.fee2 = fee2
        this.partnerAddress = partnerAddress
        this.direction = Transit.getDirection(amountIn.token.chainId, tokenOut.chainId, omniPoolConfig.chainId)

        this.feeToken1 = this.getFeeToken1()
        this.feeToken2 = this.getFeeToken2()

        if (fee1 && !this.feeToken1.equals(fee1.token)) {
            throw new SdkError('Incorrect fee1 token set')
        }
        if (fee2 && this.feeToken2 && !this.feeToken2.equals(fee2.token)) {
            throw new SdkError('Incorrect fee2 token set')
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

    get volumeFeeCall(): MultiCallItem | undefined {
        this.assertOutInitialized('volumeFeeCall')
        return this.out.volumeFeeCall
    }

    get partnerFeeCall(): MultiCallItem | undefined {
        this.assertOutInitialized('partnerFeeCall')
        return this.out.partnerFeeCall
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

        const { amountOut, amountOutMin, volumeFeeCall, partnerFeeCall } = await this.getAmountsOut(trade)

        this.out = {
            amountOut,
            amountOutMin,
            trade,
            volumeFeeCall,
            partnerFeeCall,
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

        if (this.volumeFeeCall) {
            calldatas.push(this.volumeFeeCall.data)
            receiveSides.push(this.volumeFeeCall.to)
            paths.push(this.volumeFeeCall.amountIn.token.address)
            offsets.push(this.volumeFeeCall.offset)
        }

        if (this.partnerFeeCall) {
            calldatas.push(this.partnerFeeCall.data)
            receiveSides.push(this.partnerFeeCall.to)
            paths.push(this.partnerFeeCall.amountIn.token.address)
            offsets.push(this.partnerFeeCall.offset)
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

    public async applyFees(fee1: TokenAmount, fee2?: TokenAmount) {
        this.assertOutInitialized('applyFees')

        if (!fee1.token.equals(this.feeToken1)) {
            throw new SdkError('Incorrect fee1 token')
        }
        this.fee1 = fee1

        if (this.isV2()) {
            if (!fee2) {
                throw new SdkError('fee2 should be passed')
            }
            if (!this.feeToken2) {
                throw new SdkError('feeToken2 should have been initialized')
            }
            if (!fee2.token.equals(this.feeToken2)) {
                throw new SdkError('Incorrect fee2 token')
            }
            this.fee2 = fee2
        }

        const { tradeAmountIn: newAmountIn, tradeAmountInMin: newAmountInMin } = this.getTradeAmountsIn(
            this.amountIn,
            this.amountInMin
        )
        this.trade.applyAmountIn(newAmountIn, newAmountInMin)

        const { amountOut, amountOutMin, volumeFeeCall, partnerFeeCall } = await this.getAmountsOut(this.trade)

        this.out = {
            trade: this.trade,
            volumeFeeCall,
            partnerFeeCall,
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
            throw new NoRepresentationFoundError(
                `Representation of ${tokenIn.chainId}:${tokenIn.symbol} in chain ${sTokenChainId} not found`
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

    private async getAmountsOut(trade: OctoPoolTrade): Promise<{
        amountOut: TokenAmount
        amountOutMin: TokenAmount
        volumeFeeCall: MultiCallItem | undefined
        partnerFeeCall: MultiCallItem | undefined
    }> {
        const { tokenAmountIn: tradeAmountIn, amountOut: tradeAmountOut, amountOutMin: tradeAmountOutMin } = trade
        let volumeFeeCall: MultiCallItem | undefined = undefined

        let amountOut = tradeAmountOut
        let amountOutMin = tradeAmountOutMin

        const involvedChainIds = [tradeAmountIn.token.chainId, tradeAmountOut.token.chainId]
        if (tradeAmountIn.token.chainFromId) {
            involvedChainIds.push(tradeAmountIn.token.chainFromId)
        }
        if (tradeAmountOut.token.chainFromId) {
            involvedChainIds.push(tradeAmountOut.token.chainFromId)
        }
        const volumeFeeCollector = this.symbiosis.getVolumeFeeCollector(tradeAmountIn.token.chainId, involvedChainIds)
        if (volumeFeeCollector && this.omniPoolConfig.coinGeckoId !== 'usd-coin') {
            volumeFeeCall = getVolumeFeeCall({
                feeCollector: volumeFeeCollector,
                amountIn: amountOut,
                amountInMin: amountOutMin,
            })
            amountOut = volumeFeeCall.amountOut
            amountOutMin = volumeFeeCall.amountOutMin
        }

        const partnerFeeCall = await getPartnerFeeCall({
            symbiosis: this.symbiosis,
            amountIn: amountOut,
            amountInMin: amountOutMin,
            partnerAddress: this.partnerAddress,
        })
        if (partnerFeeCall) {
            amountOut = partnerFeeCall.amountOut
            amountOutMin = partnerFeeCall.amountOutMin
        }

        if (this.direction === 'mint') {
            return {
                volumeFeeCall,
                partnerFeeCall,
                amountOut,
                amountOutMin,
            }
        }

        // replace synthetic token by real token
        amountOut = new TokenAmount(this.tokenOut, amountOut.raw)
        amountOutMin = new TokenAmount(this.tokenOut, amountOutMin.raw)

        let fee = this.fee1
        if (this.isV2()) {
            fee = this.fee2
        }
        if (fee) {
            if (amountOutMin.lessThan(fee) || amountOutMin.equalTo(fee)) {
                throw new AmountLessThanFeeError(
                    `Amount ${amountOutMin.toSignificant()} ${
                        amountOutMin.token.symbol
                    } less than fee ${fee.toSignificant()} ${fee.token.symbol}`
                )
            }
            amountOut = amountOut.subtract(fee)
            amountOutMin = amountOutMin.subtract(fee)
        }

        return {
            volumeFeeCall,
            partnerFeeCall,
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
                throw new AmountLessThanFeeError(
                    `Amount ${tradeAmountInMin.toSignificant()} ${
                        tradeAmountInMin.token.symbol
                    } less than fee ${this.fee1.toSignificant()} ${this.fee1.token.symbol}`
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
            throw new NoRepresentationFoundError(
                `Representation of ${this.tokenOut.symbol} in chain ${sTokenChainId} not found`
            )
        }
        return sToken
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
            throw new SdkError(`Chain ${chainIdIn} not found in chains priority`)
        }
        const indexOut = chainsWithHostChain.indexOf(chainIdOut)
        if (indexOut === -1) {
            throw new SdkError(`Chain ${chainIdOut} not found in chains priority`)
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
