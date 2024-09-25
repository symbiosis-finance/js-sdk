import { BaseSwapping } from './baseSwapping'
import { Token, TokenAmount } from '../entities'
import { ChainId } from '../constants'
import { Error } from './error'
import { CROSS_CHAIN_ID } from './constants'
import { ADDRESS_ZERO } from '@uniswap/v3-sdk'
import { formatBytes32String } from 'ethers/lib/utils'
import { SwapExactInParams, SwapExactInResult } from './types'

export const TON_TOKEN_DECIMALS = 9

export type Option = { chainId: ChainId; bridge: string; wTon: Token }

export class SwappingToTon extends BaseSwapping {
    public async exactIn(params: SwapExactInParams): Promise<SwapExactInResult> {
        return this.doExactIn(params)
    }

    protected metaBurnSyntheticToken(fee: TokenAmount): [string, string] {
        if (!this.tokenAmountIn || !this.tokenOut) {
            throw new Error('Tokens are not set')
        }

        const synthesis = this.symbiosis.synthesis(this.tokenAmountIn.token.chainId)

        const amount = this.transit.getBridgeAmountIn()

        console.log('transit', this.transit)

        const tonAddress = {
            workchain: ChainId.TON_TESTNET, // TODO: change to mainnet
            address_hash: formatBytes32String(this.to),
        }

        return [
            synthesis.address,
            synthesis.interface.encodeFunctionData('burnSyntheticTokenTON', [
                fee ? fee?.raw.toString() : '0', // uint256 stableBridgingFee;
                CROSS_CHAIN_ID,
                this.transit.amountOut.token.address,
                amount.raw.toString(),
                tonAddress,
                '0x0000000000000000000000000000000000000001',
                '0x0000000000000000000000000000000000000001',
                ADDRESS_ZERO, // this.getRevertableAddress('BC'),
                this.tokenOut.chainId,
                this.symbiosis.clientId,
            ]),
        ]
    }

    protected finalCalldataV2(feeV2?: TokenAmount | undefined): string {
        const tonAddress = {
            workchain: ChainId.TON_TESTNET, // TODO: change to mainnet
            address_hash: formatBytes32String(this.to),
        }

        console.log('revertableAddresses', this.revertableAddresses)

        return this.synthesisV2.interface.encodeFunctionData('burnSyntheticTokenTON', [
            feeV2 ? feeV2?.raw.toString() : '0', // uint256 stableBridgingFee;
            CROSS_CHAIN_ID,
            this.transit.amountOut.token.address,
            this.transit.amountOut.raw.toString(),
            tonAddress,
            '0x0000000000000000000000000000000000000001',
            '0x0000000000000000000000000000000000000001',
            ADDRESS_ZERO, // this.getRevertableAddress('BC'),
            this.tokenOut.chainId,
            this.symbiosis.clientId,
        ])
    }
}
