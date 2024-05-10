import { ChainId } from '../../constants'
import { Symbiosis } from '../symbiosis'
import { waitBridgeForComplete } from './waitBridgeForComplete'
import { waitBurnSyntheticBtcEvm } from './waitBurnSyntheticBtcEvm'
import { waitSynthBtcEvmTxComplete } from './waitSynthBtcEvmTxComplete'
import { waitUnwrapBtcTxComplete } from './waitUnwrapBtcTxComplete'
import { waitWrapBtcTxToComplete } from './waitWrapBtcTxToComplete'

export enum WaitOperation {
    BRIDGE = 'wait-bridge',
    BURN_SYNTH_BTC = 'wait-burn-synth-btc',
    CREATE_SYNTH_BTC = 'wait-create-synth-btc',
    WRAP_BTC = 'wait-wrap-btc',
    UNWRAP_BTC = 'wait-unwrap-btc',
}

export interface StatelessWaitForCompleteParams {
    symbiosis: Symbiosis
    chainId?: ChainId
    txId?: string
    operation?: WaitOperation
    btcAddress?: string
    btcId?: string
}

export async function statelessWaitForComplete<T>({
    symbiosis,
    chainId,
    txId,
    btcAddress,
    btcId,
    operation = WaitOperation.BRIDGE,
}: StatelessWaitForCompleteParams): Promise<T | undefined> {
    let result: Promise<T | undefined> = Promise.resolve(undefined)

    switch (operation) {
        case WaitOperation.BRIDGE:
            if (txId && chainId) {
                result = waitBridgeForComplete(symbiosis, chainId, txId) as Promise<T>
            }
            break
        case WaitOperation.WRAP_BTC:
            if (btcAddress) {
                result = waitWrapBtcTxToComplete(btcAddress) as Promise<T>
            }
            break
        case WaitOperation.CREATE_SYNTH_BTC:
            if (txId && chainId) {
                result = waitSynthBtcEvmTxComplete({ symbiosis, chainId, btcTx: txId }) as Promise<T>
            }
            break
        case WaitOperation.BURN_SYNTH_BTC:
            if (txId && chainId) {
                result = waitBurnSyntheticBtcEvm(symbiosis, chainId, txId) as Promise<T>
            }
            break
        case WaitOperation.UNWRAP_BTC:
            if (btcId) {
                result = waitUnwrapBtcTxComplete(btcId) as Promise<T>
            }
            break
    }

    return result
}
