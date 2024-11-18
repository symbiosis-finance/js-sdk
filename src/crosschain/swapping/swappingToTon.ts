import { Address } from '@ton/core'
import { AddressZero } from '@ethersproject/constants'

import { BaseSwapping } from './baseSwapping'
import { TokenAmount } from '../../entities'
import { CROSS_CHAIN_ID } from '../constants'

import { SwapExactInParams, SwapExactInResult } from '../types'
import { tonAdvisorMock } from '../chainUtils'

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
    protected async getFee(): Promise<{ fee: TokenAmount; save: TokenAmount }> {
        return tonAdvisorMock(this.transitTokenOut)
    }

    // TODO: remove when advisor is ready
    protected async getFeeV2(): Promise<{ fee: TokenAmount; save: TokenAmount }> {
        return tonAdvisorMock(this.transitTokenOut)
    }

    protected metaBurnSyntheticToken(fee: TokenAmount): [string, string] {
        const synthesis = this.symbiosis.synthesis(this.tokenAmountIn.token.chainId)
        const amount = this.transit.trade.amountOut
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
        const amount = this.transit.trade.amountOut
        const { workChain, hash } = Address.parse(this.userAddress)
        const tonAddress = {
            workchain: workChain,
            address_hash: `0x${hash.toString('hex')}`,
        }

        return this.synthesisV2.interface.encodeFunctionData('burnSyntheticTokenTON', [
            feeV2 ? feeV2?.raw.toString() : '0', // uint256 stableBridgingFee;
            amount.token.address,
            amount.raw.toString(),
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
