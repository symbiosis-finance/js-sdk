import type { ChainId } from '../constants'
import type { TokenAmount } from '../entities'
import { wrappedToken } from '../entities'
import { DepositoryV3__factory, DirectUnlocker__factory } from './contracts'
import type { DepositoryV3Types } from './contracts/v3/DepositoryV3'
import type { EvmAddress } from './types'

export interface DepositV3CallParams {
    tokenAmountIn: TokenAmount
    amountOut: TokenAmount
    from: EvmAddress // depositor — must match msg.sender on-chain
    to: EvmAddress // recipient of tokenOut on the destination chain
    quoteTTL: number // unix timestamp by which the solver must fill the intent
    directUnlockerAddress: EvmAddress
    settlementUnlockerAddress: EvmAddress
    srcChainId: ChainId
    dstChainId: ChainId
}

/**
 * Build data for DepositoryV3.deposit(depositParams, fillCondition).
 */
export function buildDepositV3Data({
    tokenAmountIn,
    amountOut,
    from,
    to,
    quoteTTL,
    directUnlockerAddress,
    settlementUnlockerAddress,
    srcChainId,
    dstChainId,
}: DepositV3CallParams): string {
    const tokenOut = amountOut.token

    const condition = DirectUnlocker__factory.createInterface().encodeFunctionData('encodeCondition', [
        {
            recipient: to,
            dstToken: wrappedToken(tokenOut).address,
            amount: amountOut.toBigInt(),
            dstChainId,
        },
    ])

    const depositParams: DepositoryV3Types.DepositParamsStruct = {
        token: tokenAmountIn.token.address,
        amount: tokenAmountIn.toBigInt(),
        depositor: from,
        quoteTTL: BigInt(quoteTTL),
        srcChainId: BigInt(srcChainId),
    }

    const fillCondition: DepositoryV3Types.FillConditionStruct = {
        fillUnlocker: directUnlockerAddress,
        settlementUnlocker: settlementUnlockerAddress,
        condition,
    }

    return DepositoryV3__factory.createInterface().encodeFunctionData('deposit', [depositParams, fillCondition])
}
