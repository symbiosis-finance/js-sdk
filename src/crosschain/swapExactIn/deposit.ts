import { AddressZero } from '@ethersproject/constants'

import { Percent, TokenAmount } from '../../entities'
import { BIPS_BASE } from '../constants'
import type { SwapLabel } from '../labels'
import type { DepositTransactionRequest, FeeItem, RouteItem, SwapExactInResult } from '../types'

export type BuildDepositResultArgs = {
    transactionRequest: DepositTransactionRequest
    tokenAmountOut: TokenAmount
    routes: RouteItem[]
    fees: FeeItem[]
    tokenAmountOutMin?: TokenAmount
    priceImpact?: Percent
    approveTo?: string
    labels?: readonly SwapLabel[]
}

const ZERO_PRICE_IMPACT = new Percent('0', BIPS_BASE)

export function buildDepositResult(args: BuildDepositResultArgs): SwapExactInResult {
    return {
        operationType: 'deposit',
        transactionType: 'deposit',
        transactionRequest: args.transactionRequest,
        tokenAmountOut: args.tokenAmountOut,
        tokenAmountOutMin: args.tokenAmountOutMin ?? args.tokenAmountOut,
        priceImpact: args.priceImpact ?? ZERO_PRICE_IMPACT,
        approveTo: args.approveTo ?? AddressZero,
        routes: args.routes,
        fees: args.fees,
        labels: [...(args.labels ?? ['partner-swap'])],
    }
}
