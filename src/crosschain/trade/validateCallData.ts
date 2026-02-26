import type { StaticJsonRpcProvider } from '@ethersproject/providers'
import { utils } from 'ethers'

import type { TokenAmount } from '../../entities'

const MAX_UINT256 = '0x' + 'ff'.repeat(32)

export async function validateCallData(
    provider: StaticJsonRpcProvider,
    from: string,
    routerAddress: string,
    callData: string,
    tokenAmountIn: TokenAmount
): Promise<void> {
    if (tokenAmountIn.token.isNative) {
        // Native token: override caller's ETH balance — full simulation of the swap.
        const hexValue = '0x' + BigInt(tokenAmountIn.raw.toString()).toString(16)
        try {
            await provider.send('eth_call', [
                { from, to: routerAddress, value: hexValue, data: callData },
                'latest',
                { [from]: { balance: MAX_UINT256 } },
            ])
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : String(e)
            throw new Error(`Calldata validation failed: ${message}`)
        }
    } else {
        // ERC20: override balance and allowance using standard OpenZeppelin storage layout
        // (slot 0 = _balances, slot 1 = _allowances). Works for most tokens; non-standard
        // tokens (USDC, USDT, proxies) use different slots — for those we fall back to
        // filtering allowance-related errors instead of throwing.
        // NOTE: confirmed issue - does not work with USDT on Ethereum

        const balanceSlot = utils.keccak256(utils.defaultAbiCoder.encode(['address', 'uint256'], [from, 0]))
        const ownerAllowanceSlot = utils.keccak256(utils.defaultAbiCoder.encode(['address', 'uint256'], [from, 1]))
        const allowanceSlot = utils.keccak256(
            utils.defaultAbiCoder.encode(['address', 'bytes32'], [routerAddress, ownerAllowanceSlot])
        )
        try {
            await provider.send('eth_call', [
                { from, to: routerAddress, data: callData },
                'latest',
                {
                    [tokenAmountIn.token.address]: {
                        stateDiff: {
                            [balanceSlot]: MAX_UINT256,
                            [allowanceSlot]: MAX_UINT256,
                        },
                    },
                },
            ])
        } catch (e: unknown) {
            const message = (e instanceof Error ? e.message : String(e)).toLowerCase()
            const isExpectedApprovalError = message.includes('allowance') || message.includes('transfer amount')
            if (!isExpectedApprovalError) {
                throw new Error(`Calldata validation failed: ${message}`)
            }
        }
    }
}
