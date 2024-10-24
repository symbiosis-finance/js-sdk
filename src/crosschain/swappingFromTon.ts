import { AddressZero } from '@ethersproject/constants'
import { TokenAmount } from '../entities'
import { buildMetaSynthesize, tronAddressToEvm } from './chainUtils'
import { TonTransactionData } from './types'
import { BaseSwapping } from './baseSwapping'

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
}
