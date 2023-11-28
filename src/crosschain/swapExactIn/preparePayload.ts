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
    functionSelector?: string
}

// Prepare payload for evm or tron transaction
export function preparePayload({
    chainId,
    fromAddress,
    toAddress,
    callData,
    value = '0',
    functionSelector,
}: PreparePayloadParams): SwapExactInTransactionPayload {
    if (isTronChainId(chainId)) {
        if (!functionSelector) {
            throw new Error('This method is not supported for tron chain')
        }

        const rawParameter = callData.replace(/^(0x)/, '').slice(8)

        return {
            transactionType: 'tron',
            transactionRequest: {
                function_selector: functionSelector,
                call_value: value,
                chain_id: chainId,
                contract_address: TronWeb.address.fromHex(toAddress),
                owner_address: TronWeb.address.fromHex(fromAddress),
                raw_parameter: rawParameter,
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
