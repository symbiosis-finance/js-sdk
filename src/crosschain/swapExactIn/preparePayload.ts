import TronWeb from 'tronweb'
import { ChainId } from '../../constants'
import { isTronChainId } from '../chainUtils/tron'
import { SwapExactInTransactionPayload } from '../types'

interface PreparePayloadParams {
    chainId: ChainId
    from: string
    to: string
    value?: string
    callData: string
    functionSelector?: string
}

// Prepare payload for evm or tron transaction
export function preparePayload({
    chainId,
    from,
    to,
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
                contract_address: TronWeb.address.fromHex(to),
                owner_address: TronWeb.address.fromHex(from),
                raw_parameter: rawParameter,
                fee_limit: 150000000, // Default fee limit - 150 TRX
            },
        }
    }

    return {
        transactionType: 'evm',
        transactionRequest: {
            chainId,
            from,
            to,
            value,
            data: callData,
        },
    }
}
