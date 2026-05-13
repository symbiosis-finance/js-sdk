import type { ChainId } from '../../constants'
import type { BtcConfig } from '../types'
import type { TradeProvider } from '../trade'

export type BridgeRequestType =
    | 'SynthesizeRequest'
    | 'BurnRequest'
    | 'RevertSynthesizeRequest'
    | 'RevertSynthesizeCompleted'
    | 'RevertBurnCompleted'

export interface BridgeTxInfo {
    internalId: string
    externalId: string
    externalChainId: ChainId
    requestType: BridgeRequestType
}

export interface BtcDepositAcceptedResult {
    commitTx: string
    btcConfig: BtcConfig
}

export interface ExtraStepResult {
    provider: TradeProvider
    txHash: string
    chainId: ChainId
}
