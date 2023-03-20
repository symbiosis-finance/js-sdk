declare module 'toformat'

declare module 'tronweb' {
    export interface Contract {
        parameter: {
            type_url: string
            value: Record<string, unknown>
        }
        type: string
    }

    export interface TriggerSmartContractResult {
        result: { result: boolean }
        transaction: Transaction
        [key: string]: unknown
    }

    export interface Transaction {
        visible: boolean
        txID: string
        raw_data: {
            contract: Contract[]
            ref_block_bytes: string
            ref_block_hash: string
            expiration: number
            fee_limit: number
            timestamp: number
        }
        raw_data_hex: string
        signature?: string[]
        [key: string]: unknown
    }

    export interface SignedTransaction extends Transaction {
        signature: string[]
    }

    export default class TronWeb {
        constructor(config: any)
        contract(): any

        static address: {
            toHex(address: string): string
            fromHex(address: string): string
        }

        ready: boolean
        toHex(m: string): string
        feeLimit: number
        trx: {
            sign(transaction: Transaction, privateKey?: string): Promise<SignedTransaction>
            sign(message: string, privateKey?: string): Promise<string>
            multiSign(...args: any[]): Promise<any>
            signMessageV2(message: string, privateKey?: string): Promise<string>
        }
        transactionBuilder: {
            triggerSmartContract(
                contractAddress: string,
                functionSelector: string,
                options: {
                    call_value?: number | string
                    feeLimit?: number
                },
                parameter: any[],
                address?: string
            ): Promise<TriggerSmartContractResult>
        }
        defaultAddress?: {
            base58: string
            hex: string
            name: string
            type: number
        }
    }
}
