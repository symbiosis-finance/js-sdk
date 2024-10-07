import { Address } from '@ton/core'
import { BaseSwapping } from './baseSwapping'
import { Token, TokenAmount } from '../entities'
import { ChainId } from '../constants'
import { SwapExactInParams, SwapExactInResult } from './types'
import { CROSS_CHAIN_ID } from './constants'

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

    protected metaSynthesize(fee: TokenAmount, feeV2: TokenAmount | undefined): [string, string] {
        // call ton calldata
    }
}
