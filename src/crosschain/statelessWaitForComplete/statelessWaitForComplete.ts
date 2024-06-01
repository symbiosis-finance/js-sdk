import { ChainId } from '../../constants'
import { Symbiosis } from '../symbiosis'
import { waitBridgeForComplete } from './waitBridgeForComplete'

export interface StatelessWaitForCompleteParams {
    symbiosis: Symbiosis
    chainId: ChainId
    txId: string
}

export async function statelessWaitForComplete({
    symbiosis,
    chainId,
    txId,
}: StatelessWaitForCompleteParams): Promise<string | undefined> {
    return waitBridgeForComplete(symbiosis, chainId, txId)
}
