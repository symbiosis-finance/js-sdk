import { randomBytes } from 'crypto'
import type { BigNumberish, BytesLike } from 'ethers'

import type { Token, TokenAmount } from '../entities'
import { Percent, wrappedAmount, wrappedToken } from '../entities'
import { BIPS_BASE } from './constants'
import type {
    BranchedUnlocker,
    BtcRefundUnlocker,
    IDepository,
    IRouter,
    SwapUnlocker,
    TimedUnlocker,
} from './contracts'
import { ERC20__factory, IRouter__factory } from './contracts'
import type { DepositoryTypes } from './contracts/IDepository'
import type { SymbiosisTradeOutResult } from './trade/symbiosisTrade'
import type { Address, DepositoryConfig } from './types'

interface DepositoryContext_ {
    cfg: DepositoryConfig
    depository: IDepository
    router: IRouter
    branchedUnlocker: BranchedUnlocker
    swapUnlocker: SwapUnlocker
    timedUnlocker: TimedUnlocker
    btcRefundUnlocker?: BtcRefundUnlocker
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export interface DepositoryContext extends DepositoryContext_ {}

interface CallData {
    target: Address
    targetCalldata: BytesLike
    targetOffset: BigNumberish
}

export interface DepositParameters extends CallData {
    readonly to: Address
    readonly tokenAmountIn: TokenAmount
    readonly amountOut: TokenAmount
    readonly amountOutMin: TokenAmount
    readonly extraBranches: DepositoryTypes.UnlockConditionStruct[]
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class DepositoryContext {
    constructor(c: DepositoryContext_) {
        Object.assign(this, c)
    }

    private erc20TransferCall(token: Token, to: Address): CallData {
        // Calls ERC20.transfer(to)
        return {
            target: token.address,
            targetCalldata: ERC20__factory.createInterface().encodeFunctionData('transfer', [to, 0n]),
            targetOffset: 68n, // 4 (selector) + 32 (to) + 32 (amount)
        }
    }

    private nativeUnwrapCall(tokenOut: Token, to: Address): CallData {
        // Calls Router.transferNative(to)
        return {
            target: this.router.address as Address,
            targetCalldata: IRouter__factory.createInterface().encodeFunctionData('transferNative', [
                wrappedToken(tokenOut).address,
                to,
                0n, // will be patched
            ]),
            targetOffset: 100n, // 4 (selector) + 32 (token) + 32 (to) + 32 (amount)
        }
    }

    private rmConditionMethod(data: string): string {
        return '0x' + data.slice(10)
    }

    makeTargetCall(context: { tokenOut: Token; to: Address }): CallData {
        return context.tokenOut.isNative
            ? this.nativeUnwrapCall(context.tokenOut, context.to)
            : this.erc20TransferCall(context.tokenOut, context.to)
    }

    // Build Depository call.
    async buildDepositCall({
        to,
        tokenAmountIn,
        amountOut,
        amountOutMin,
        target,
        targetCalldata,
        targetOffset,
        extraBranches,
    }: DepositParameters): Promise<SymbiosisTradeOutResult> {
        const fromToken = tokenAmountIn.token
        const toToken = wrappedAmount(amountOut).token

        const branches: DepositoryTypes.UnlockConditionStruct[] = []

        // Normal swap.
        {
            const condData = {
                outToken: toToken.address, // destination token
                outMinAmount: amountOut.toBigInt(),
                target, // target to call after validation
                targetCalldata, // calldata to call on target.
                targetOffset, // offset to patch-in amountTo in targetCalldata
            }
            const swapCondition = this.swapUnlocker.interface.encodeFunctionData('encodeCondition', [condData])
            branches.push({
                unlocker: this.swapUnlocker.address,
                condition: this.rmConditionMethod(swapCondition),
            })
        }

        // Minimal swap - with maximal slippage.
        {
            const condData = {
                outToken: toToken.address, // destination token
                outMinAmount: amountOutMin.toBigInt(),
                target, // target to call after validation
                targetCalldata, // calldata to call on target.
                targetOffset, // offset to patch-in amountTo in targetCalldata
            }
            const swapCondition = this.swapUnlocker.interface.encodeFunctionData('encodeCondition', [condData])
            branches.push(
                this.makeTimed(this.cfg.minAmountDelay, {
                    unlocker: this.swapUnlocker.address,
                    condition: this.rmConditionMethod(swapCondition),
                })
            )
        }

        // Transit token withdraw (i.e. syBTC)
        {
            const withdrawCall = this.erc20TransferCall(tokenAmountIn.token, to)
            const withdrawCondition = this.swapUnlocker.interface.encodeFunctionData('encodeCondition', [
                {
                    outToken: fromToken.address, // destination token
                    outMinAmount: tokenAmountIn.toBigInt(),
                    ...withdrawCall,
                },
            ])
            branches.push(
                this.makeTimed(this.cfg.withdrawDelay, {
                    unlocker: this.swapUnlocker.address,
                    condition: this.rmConditionMethod(withdrawCondition),
                })
            )
        }

        branches.push(...extraBranches)

        // Compose all branches.
        const condition = this.branchedUnlocker.interface.encodeFunctionData('encodeCondition', [{ branches }])
        const nonce = BigInt(`0x${randomBytes(32).toString('hex')}`)
        const deposit = {
            token: fromToken.address, // source token
            amount: tokenAmountIn.toBigInt(), // amount of fromToken
            nonce: nonce, // To be able to create identical deposits
        }
        const unlocker = {
            unlocker: this.branchedUnlocker.address,
            condition: this.rmConditionMethod(condition),
        }
        const lockData = this.depository.interface.encodeFunctionData('lock', [deposit, unlocker])

        return {
            routerAddress: this.depository.address as Address,
            callData: lockData,
            callDataOffset: 4 + 32 + 32, // Offset to `amount` field in DepositoryTypes.Deposit
            minReceivedOffset: 123, // FIXME: calculate correct offset.
            route: [tokenAmountIn.token, amountOut.token],
            value: 0n,
            amountOut: amountOut,
            amountOutMin: amountOutMin,
            priceImpact: new Percent('0', BIPS_BASE),
            // TODO: add functionSelector with deposit(...) for Tron support.
        }
    }

    makeTimed(delay: number, next: DepositoryTypes.UnlockConditionStruct): DepositoryTypes.UnlockConditionStruct {
        if (this.cfg.withdrawDelay === 0) return next
        const timedWithdrawCondition = this.timedUnlocker.interface.encodeFunctionData('encodeCondition', [
            {
                next,
                delay,
            },
        ])
        return {
            unlocker: this.timedUnlocker.address,
            condition: this.rmConditionMethod(timedWithdrawCondition),
        }
    }
}
