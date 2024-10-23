import { AddressZero } from '@ethersproject/constants'
import { Token, TokenAmount } from '../entities'
import { buildMetaSynthesize, tronAddressToEvm } from './chainUtils'
import { TonTransactionData } from './types'
import { BaseSwapping } from './baseSwapping'
import { parseUnits } from '@ethersproject/units'

export class SwappingFromTon extends BaseSwapping {
    protected async getTonTransactionRequest(
        fee: TokenAmount,
        feeV2: TokenAmount | undefined
    ): Promise<TonTransactionData> {
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
            to: this.to,
            revertableAddress: this.getRevertableAddress('AB'),
            chainIdOut: this.omniPoolConfig.chainId,
            validUntil: this.deadline,
            finalReceiveSide: tronAddressToEvm(this.transit.isV2() ? this.finalReceiveSideV2() : AddressZero),
            finalCallData: this.transit.isV2() ? this.finalCalldataV2(feeV2) : '',
            finalOffset: this.transit.isV2() ? this.finalOffsetV2() : 0,
        })
    }

    // TODO rm after advisor is ready
    protected async getFee(feeToken: Token): Promise<{ fee: TokenAmount; save: TokenAmount }> {
        return {
            fee: new TokenAmount(feeToken, parseUnits('0.1', feeToken.decimals).toString()),
            save: new TokenAmount(feeToken, '0'),
        }
    }
}
