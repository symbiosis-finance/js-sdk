import { AddressZero } from '@ethersproject/constants'
import { Token, TokenAmount } from '../entities'
import { Error } from './error'
import { tronAddressToEvm } from './chainUtils'
import { TonTransactionData } from './types'
import { buildMetaSynthesize } from './swapExactIn/fromTonSwap'
import { BaseSwapping } from './baseSwapping'

export class SwappingFromTon extends BaseSwapping {
    protected getTonTransactionRequest(fee: TokenAmount, feeV2: TokenAmount | undefined): TonTransactionData {
        if (!this.tokenAmountIn || !this.tokenOut) {
            throw new Error('Tokens are not set')
        }

        let secondSwapCallData = this.secondSwapCalldata()
        if (secondSwapCallData.length === 0) {
            secondSwapCallData = ''
        }
        return buildMetaSynthesize({
            symbiosis: this.symbiosis,
            fee,
            amountIn: this.transit.getBridgeAmountIn(),
            secondDexRouter: this.secondDexRouter(),
            secondSwapCallData: secondSwapCallData as string,
            swapTokens: this.swapTokens().map(tronAddressToEvm),
            from: this.from,
            evmAddress: this.to,
            poolChainId: this.omniPoolConfig.chainId,
            validUntil: this.deadline,
            finalReceiveSide: tronAddressToEvm(this.transit.isV2() ? this.finalReceiveSideV2() : AddressZero),
            finalCallData: this.transit.isV2() ? this.finalCalldataV2(feeV2) : '',
            finalOffset: this.transit.isV2() ? this.finalOffsetV2() : 0,
        })
    }

    // TODO rm after advisor is ready
    protected async getFee(feeToken: Token): Promise<{ fee: TokenAmount; save: TokenAmount }> {
        return {
            fee: new TokenAmount(feeToken, '0'),
            save: new TokenAmount(feeToken, '0'),
        }
    }
}
