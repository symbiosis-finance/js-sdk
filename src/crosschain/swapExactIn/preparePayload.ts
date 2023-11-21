import TronWeb from 'tronweb'
import { ChainId } from '../../constants'
import { isTronChainId } from '../tron'
import { SwapExactInTransactionPayload } from './types'

interface PreparePayloadParams {
    chainId: ChainId
    fromAddress: string
    toAddress: string
    value?: string
    callData: string
}

// Prepare payload for evm or tron transaction
export function preparePayload({
    chainId,
    fromAddress,
    toAddress,
    callData,
    value = '0',
}: PreparePayloadParams): SwapExactInTransactionPayload {
    if (isTronChainId(chainId)) {
        return {
            transactionType: 'tron',
            transactionRequest: {
                call_value: value,
                chain_id: chainId,
                contract_address: TronWeb.address.fromHex(toAddress),
                owner_address: TronWeb.address.fromHex(fromAddress),
                raw_parameter: callData,
                fee_limit: 150000000, // Default fee limit - 150 TRX
            },
        }
    }

    return {
        transactionType: 'evm',
        transactionRequest: {
            chainId,
            from: fromAddress,
            to: toAddress,
            value,
            data: callData,
        },
    }
}
