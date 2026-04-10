import type { ChainId } from '../constants'
import type { TokenAmount } from '../entities'
import { wrappedToken } from '../entities'
import { DepositorySrc__factory, DirectUnlocker__factory } from './contracts'
import type { DepositoryTypes } from './contracts/intents/DepositorySrc'
import type { EvmAddress } from './types'

export interface DepositCallParams {
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
 * Build data for DepositorySrc.deposit(depositParams, fillCondition).
 */
export function buildDepositData({
    tokenAmountIn,
    amountOut,
    from,
    to,
    quoteTTL,
    directUnlockerAddress,
    settlementUnlockerAddress,
    srcChainId,
    dstChainId,
}: DepositCallParams): string {
    const tokenOut = amountOut.token

    const condition = DirectUnlocker__factory.createInterface().encodeFunctionData('encodeCondition', [
        {
            recipient: to,
            dstToken: wrappedToken(tokenOut).address,
            amount: amountOut.toBigInt(),
            dstChainId,
        },
    ])

    const depositParams: DepositoryTypes.DepositParamsStruct = {
        token: tokenAmountIn.token.address, // TODO wrap gastokens?
        amount: tokenAmountIn.toBigInt(),
        depositor: from,
        quoteTTL: BigInt(quoteTTL),
        srcChainId: BigInt(srcChainId),
    }

    const fillCondition: DepositoryTypes.FillConditionStruct = {
        fillUnlocker: directUnlockerAddress,
        settlementUnlocker: settlementUnlockerAddress,
        condition,
    }

    return DepositorySrc__factory.createInterface().encodeFunctionData('deposit', [depositParams, fillCondition])
}
