import { ChainId } from '../../constants'
import { BtcConfig } from '../chainUtils/btc'

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
