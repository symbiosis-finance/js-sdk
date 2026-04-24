import type { ChainId } from '../../../constants'
import type { TokenAmount } from '../../../entities'
import { DepositorySrc__factory } from '../../contracts'
import type { DepositoryTypes } from '../../contracts/intents/DepositorySrc'
import type { EvmAddress } from '../../types'

export interface DepositCallParams {
    tokenAmountIn: TokenAmount
    from: EvmAddress // depositor — must match msg.sender on-chain
    quoteTTL: number // unix-timestamp by which the solver must fill the intent
    fillUnlockerAddress: EvmAddress
    fillUnlockerCondition: string
    settlementUnlockerAddress: EvmAddress
    srcChainId: ChainId
}

/**
 * Build data for DepositorySrc.deposit(depositParams, fillCondition).
 */
export function buildDepositData({
    tokenAmountIn,
    from,
    quoteTTL,
    fillUnlockerAddress,
    fillUnlockerCondition,
    settlementUnlockerAddress,
    srcChainId,
}: DepositCallParams): string {
    const depositParams: DepositoryTypes.DepositParamsStruct = {
        token: tokenAmountIn.token.address,
        amount: tokenAmountIn.toBigInt(),
        depositor: from,
        quoteTTL: BigInt(quoteTTL),
        srcChainId: BigInt(srcChainId),
    }

    const fillCondition: DepositoryTypes.FillConditionStruct = {
        fillUnlocker: fillUnlockerAddress,
        settlementUnlocker: settlementUnlockerAddress,
        condition: fillUnlockerCondition,
    }

    return DepositorySrc__factory.createInterface().encodeFunctionData('deposit', [depositParams, fillCondition])
}
