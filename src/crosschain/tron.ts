import { JsonFragment } from '@ethersproject/abi'
import { getAddress } from '@ethersproject/address'
import { BytesLike, concat, hexDataSlice } from '@ethersproject/bytes'
import { keccak256 as kekKeccak256 } from '@ethersproject/keccak256'
import BigNumber from 'bignumber.js'
import { utils } from 'ethers'
import TronWeb, { TransactionInfo } from 'tronweb'
import { ChainId } from '../constants'
import { Chain, Token } from '../entities'

export interface TronTransactionData {
    chain_id: number
    call_value: number | string
    contract_address: string
    fee_limit: number
    function_selector: string
    owner_address: string
    raw_parameter: string
}

interface Params {
    chainId: ChainId
    tronWeb: TronWeb
    abi: ReadonlyArray<JsonFragment>
    contractAddress: string
    functionName: string
    params: any[]
    ownerAddress: string
    value?: string | number | BigNumber
}

export function getFunctionSelector(abi: any): string {
    abi.stateMutability = abi.stateMutability ? abi.stateMutability.toLowerCase() : 'nonpayable'
    abi.type = abi.type ? abi.type.toLowerCase() : ''
    if (abi.type === 'fallback' || abi.type === 'receive') return '0x'
    const iface = new utils.Interface([abi])
    if (abi.type === 'event') {
        return iface.getEvent(abi.name).format(utils.FormatTypes.sighash)
    }
    return iface.getFunction(abi.name).format(utils.FormatTypes.sighash)
}

export function prepareTronTransaction({
    chainId,
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

    const rawParameter = tronWeb.utils.abi.encodeParamsV2ByABI(functionFragment, params)
    return {
        chain_id: chainId,
        call_value: value?.toString() ?? 0,
        contract_address: TronWeb.address.fromHex(contractAddress),
        fee_limit: 200000000, // 200 TRX
        function_selector: functionSelector,
        owner_address: TronWeb.address.fromHex(ownerAddress),
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

// Tron uses 0x41 as the prefix for contract addresses created by CREATE2, unlike EVM 0xff.
export function getTronCreate2Address(from: string, salt: BytesLike, initCodeHash: BytesLike): string {
    return getAddress(hexDataSlice(kekKeccak256(concat(['0x41', getAddress(from), salt, initCodeHash])), 12))
}
