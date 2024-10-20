import { Address } from '@ton/core'
import { BaseSwapping } from './baseSwapping'
import { Token, TokenAmount } from '../entities'
import { ChainId } from '../constants'
import { SwapExactInParams, SwapExactInResult } from './types'
import { CROSS_CHAIN_ID } from './constants'
import { AddressZero } from '@ethersproject/constants'
import { parseUnits } from '@ethersproject/units'

export const TON_TOKEN_DECIMALS = 9

export type Option = { chainId: ChainId; bridge: string; wTon: Token }

export class SwappingToTon extends BaseSwapping {
    protected userAddress!: string

    public async exactIn(params: Omit<SwapExactInParams, 'symbiosis'>): Promise<SwapExactInResult> {
        this.userAddress = params.to

        return this.doExactIn({
            ...params,
            to: params.from,
        })
    }

    // TODO: remove when advisor is ready
    protected async getFeeV2(): Promise<{ fee: TokenAmount; save: TokenAmount }> {
        const feeToken = this.transitTokenOut

        return {
            fee: new TokenAmount(feeToken, parseUnits('0.1', feeToken.decimals).toString()),
            save: new TokenAmount(feeToken, '0'),
        }
    }

    protected metaBurnSyntheticToken(fee: TokenAmount): [string, string] {
        if (!this.tokenAmountIn || !this.tokenOut) {
            throw new Error('Tokens are not set')
        }

        const synthesis = this.symbiosis.synthesis(this.tokenAmountIn.token.chainId)

        const amount = this.transit.getBridgeAmountIn()

        const { workChain, hash } = Address.parse(this.userAddress)

        const tonAddress = {
            workchain: workChain,
            address_hash: `0x${hash.toString('hex')}`,
        }

        return [
            synthesis.address,
            synthesis.interface.encodeFunctionData('burnSyntheticTokenTON', [
                fee.raw.toString(),
                amount.token.address,
                amount.raw.toString(),
                CROSS_CHAIN_ID,
                tonAddress,
                AddressZero, // any arbtitary data, this addresses passed from relayer
                AddressZero, // any arbtitary data, this addresses passed from relayer
                this.from,
                this.tokenOut.chainId,
                this.symbiosis.clientId,
            ]),
        ]
    }

    protected finalOffsetV2(): number {
        return 100
    }

    protected finalCalldataV2(feeV2?: TokenAmount | undefined): string {
        const { workChain, hash } = Address.parse(this.userAddress)

        const tonAddress = {
            workchain: workChain,
            address_hash: `0x${hash.toString('hex')}`,
        }

        return this.synthesisV2.interface.encodeFunctionData('burnSyntheticTokenTON', [
            feeV2 ? feeV2?.raw.toString() : '0', // uint256 stableBridgingFee;
            this.transit.amountOut.token.address,
            this.transit.amountOut.raw.toString(),
            CROSS_CHAIN_ID,
            tonAddress,
            AddressZero,
            AddressZero,
            this.from,
            this.tokenOut.chainId,
            this.symbiosis.clientId,
        ])
    }
}
