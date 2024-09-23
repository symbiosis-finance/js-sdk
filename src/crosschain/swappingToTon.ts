import { BaseSwapping } from './baseSwapping'
import { Token, TokenAmount } from '../entities'
import { ChainId } from '../constants'
import { Error } from './error'
import { tronAddressToEvm } from './tron'
import { CROSS_CHAIN_ID } from './constants'

export const TON_TOKEN_DECIMALS = 9

export type Option = { chainId: ChainId; bridge: string; wTon: Token }

export class SwappingToTon extends BaseSwapping {
    protected metaBurnSyntheticToken(fee: TokenAmount): [string, string] {
        if (!this.tokenAmountIn || !this.tokenOut) {
            throw new Error('Tokens are not set')
        }

        const synthesis = this.symbiosis.synthesis(this.tokenAmountIn.token.chainId)

        const amount = this.transit.getBridgeAmountIn()

        return [
            synthesis.address,
            synthesis.interface.encodeFunctionData('burnSyntheticTokenTON', [
                {
                    _stableBridgingFee: fee ? fee?.raw.toString() : '0', // uint256 stableBridgingFee;
                    _crossChainID: CROSS_CHAIN_ID,
                    _stoken: tronAddressToEvm(this.transit.amountOut.token.address),
                    _amount: amount,
                    _chain2address: tronAddressToEvm(this.to),
                    _receiveSide: tronAddressToEvm(this.symbiosis.portal(this.tokenOut.chainId).address),
                    _oppositeBridge: tronAddressToEvm(this.symbiosis.bridge(this.tokenOut.chainId).address),
                    _revertableAddress: this.getRevertableAddress('BC'),
                    _chainID: this.tokenOut.chainId,
                    _clientID: this.symbiosis.clientId,
                },
            ]),
        ]
    }

    protected finalCalldataV2(feeV2?: TokenAmount | undefined): string {
        return this.synthesisV2.interface.encodeFunctionData('burnSyntheticTokenTON', [
            {
                _stableBridgingFee: feeV2 ? feeV2?.raw.toString() : '0', // uint256 stableBridgingFee;
                _crossChainID: '', ///?
                _stoken: tronAddressToEvm(this.transit.amountOut.token.address),
                _amount: this.transit.amountOut.raw.toString(),
                _chain2address: tronAddressToEvm(this.to),
                _receiveSide: tronAddressToEvm(this.symbiosis.portal(this.tokenOut.chainId).address),
                _oppositeBridge: tronAddressToEvm(this.symbiosis.bridge(this.tokenOut.chainId).address),
                _revertableAddress: this.getRevertableAddress('BC'),
                _chainID: this.tokenOut.chainId,
                _clientID: this.symbiosis.clientId,
            },
        ])
    }
}
