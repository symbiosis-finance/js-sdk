import { JsonFragment } from '@ethersproject/abi'
import BigNumber from 'bignumber.js'
import TronWeb, { TransactionInfo } from 'tronweb'
import { ChainId } from '../constants'
import { Chain, Token } from '../entities'
import { encodeParamsV2ByABI, getFunctionSelector } from './tronWeb'

export interface TronTransactionData {
    call_value: number | string
    contract_address: string
    fee_limit: number
    function_selector: string
    owner_address: string
    raw_parameter: string
}

interface Params {
    tronWeb: TronWeb
    abi: ReadonlyArray<JsonFragment>
    contractAddress: string
    functionName: string
    params: any[]
    ownerAddress: string
    value?: string | number | BigNumber
}

export function prepareTronTransaction({
    tronWeb,
    abi,
    contractAddress,
    functionName,
    params,
    value,
    ownerAddress,
}: Params): TronTransactionData {
    const functionFragment = abi.find((item) => item.type === 'function' && item.name === functionName)

    if (!functionFragment) {
        throw new Error('Method not found in ABI')
    }

    const functionSelector = getFunctionSelector(functionFragment)

    const rawParameter = encodeParamsV2ByABI(functionFragment, params)

    return {
        call_value: value?.toString() ?? 0,
        contract_address: TronWeb.address.toHex(contractAddress),
        fee_limit: tronWeb.feeLimit,
        function_selector: functionSelector,
        owner_address: TronWeb.address.toHex(ownerAddress),
        raw_parameter: rawParameter,
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
