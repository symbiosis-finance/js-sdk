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

    export interface TransactionInfo {
        id: string
        fee: number
        blockNumber: number
        blockTimeStamp: number
        contractResult: string[]
        contract_address: string
        receipt: Receipt
        log: Log[]
        internal_transactions: InternalTransaction[]
    }

    export interface InternalTransaction {
        hash: string
        caller_address: string
        transferTo_address: string
        callValueInfo: unknown[]
        note: string
    }

    export interface Log {
        address: string
        topics: string[]
        data: string
    }

    export interface Receipt {
        energy_fee: number
        energy_usage_total: number
        net_usage: number
        result: string
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
        fullNode: {
            request(url: string, params: Record<string, unknown>, method: string): Promise<any>
        }
        feeLimit: number
        trx: {
            sign(transaction: Transaction, privateKey?: string): Promise<SignedTransaction>
            sign(message: string, privateKey?: string): Promise<string>
            multiSign(...args: any[]): Promise<any>
            signMessageV2(message: string, privateKey?: string): Promise<string>
            getTransactionInfo(transactionId: string): Promise<TransactionInfo>
        }
        transactionBuilder: {
            triggerSmartContract(
                contractAddress: string,
                functionSelector: string,
                options: {
                    callValue?: number | string
                    feeLimit?: number
                    rawParameter?: string
                },
                parameter: any[],
                address?: string
            ): Promise<TriggerSmartContractResult>
        }
        utils: {
            abi: {
                encodeParamsV2ByABI(abi: any, parameter: any[]): string
            }
        }
        defaultAddress?: {
            base58: string
            hex: string
            name: string
            type: number
        }
    }
}
