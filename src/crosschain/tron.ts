import { AbiCoder } from '@ethersproject/abi'
import type { Abi, AbiParametersToPrimitiveTypes, ExtractAbiFunction, ExtractAbiFunctionNames } from 'abitype'
import BigNumber from 'bignumber.js'
import TronWeb, { TransactionInfo } from 'tronweb'
import { ChainId } from '../constants'
import { Chain, Token } from '../entities'

declare module 'abitype' {
    export interface Config {
        BigIntType: string
        AddressType: string
        BytesType: {
            inputs: `0x${string}` | Uint8Array | string
            outputs: `0x${string}`
        }
    }
}

export interface TronTransactionData {
    call_value: number | string
    contract_address: string
    fee_limit: number
    function_selector: string
    owner_address: string
    parameter: string
    raw_parameter: {
        type: string
        value: unknown
    }[]
}

type ExtractPayableFunctionNames<TAbi extends Abi> = ExtractAbiFunctionNames<TAbi, 'payable' | 'nonpayable'>

// Based on TronWeb internal encoding from tronWeb.transactionBuilder.triggerSmartContract
function encodeParams<TAbi extends Abi, TFunctionName extends ExtractPayableFunctionNames<TAbi>>(
    functionAbi: ExtractAbiFunction<TAbi, TFunctionName>,
    params: AbiParametersToPrimitiveTypes<ExtractAbiFunction<TAbi, TFunctionName>['inputs'], 'inputs'>
): string {
    if (!params.length) {
        return ''
    }

    const types = []
    const values = []

    const abiCoder = new AbiCoder()

    for (let i = 0; i < params.length; i++) {
        const type = functionAbi.inputs[i].type
        let value = params[i] as string | string[]

        if (!type || !type.length) {
            throw new Error('Invalid parameter type provided: ' + type)
        }

        if (type === 'address' && typeof value === 'string') {
            value = tronAddressToEvm(value)
        } else if (Array.isArray(value) && type.match(/^([^\x5b]*)(\x5b|$)/)?.[0] === 'address[') {
            value = value.map((address) => tronAddressToEvm(address))
        }

        types.push(type)
        values.push(value)
    }

    return abiCoder.encode(types, values).replace(/^(0x)/, '')
}

interface Params<TAbi extends Abi, TFunctionName extends ExtractPayableFunctionNames<TAbi>> {
    tronWeb: TronWeb
    abi: TAbi
    contractAddress: string
    functionName: TFunctionName
    params: AbiParametersToPrimitiveTypes<ExtractAbiFunction<TAbi, TFunctionName>['inputs'], 'inputs'>
    ownerAddress: string
    value?: string | number | BigNumber
}

export function prepareTronTransaction<TAbi extends Abi, TFunctionName extends ExtractPayableFunctionNames<TAbi>>({
    tronWeb,
    abi,
    contractAddress,
    functionName,
    params,
    value,
    ownerAddress,
}: Params<TAbi, TFunctionName>): TronTransactionData {
    const functionFragment = abi.find(
        (item) => item.type === 'function' && item.name === functionName
    ) as ExtractAbiFunction<TAbi, TFunctionName>

    if (!functionFragment) {
        throw new Error('Method not found in ABI')
    }

    const functionSelector = `${functionFragment.name}(${functionFragment.inputs.map((input) => input.type).join(',')})`

    const raw_parameter = functionFragment.inputs.map((input, index) => ({
        type: input.type,
        value: params[index],
    }))

    const parameter = encodeParams(functionFragment, params)

    return {
        call_value: value?.toString() ?? 0,
        contract_address: TronWeb.address.toHex(contractAddress),
        fee_limit: tronWeb.feeLimit,
        function_selector: functionSelector,
        owner_address: TronWeb.address.toHex(ownerAddress),
        parameter,
        raw_parameter,
    }
}

const ADDRESS_PREFIX_REGEX = /^(41)/

export function tronAddressToEvm(address: string) {
    return TronWeb.address.toHex(address).replace(ADDRESS_PREFIX_REGEX, '0x')
}

export function isTronChainId(chainId: ChainId): boolean {
    return [ChainId.TRON_MAINNET, ChainId.TRON_TESTNET].includes(chainId)
}

export function isTronChain(chain: Chain): boolean {
    return isTronChainId(chain.id)
}

export function isTronToken(token: Token): boolean {
    return isTronChainId(token.chainId)
}

export async function getTransactionInfoById(tronWeb: TronWeb, txId: string): Promise<TransactionInfo | null> {
    const result = await tronWeb.fullNode.request('wallet/gettransactioninfobyid', { value: txId }, 'post')

    if (result && Object.keys(result).length > 0) {
        return result
    }

    return null
}
