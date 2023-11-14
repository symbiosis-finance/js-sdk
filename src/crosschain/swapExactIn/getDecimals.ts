import { Contract, utils } from 'ethers'
import { ChainId, NATIVE_TOKEN_ADDRESS } from '../../constants'
import { GAS_TOKEN } from '../../entities'
import ERC20 from '../../abis/ERC20.json'
import { getMulticall } from '../multicall'
import { Symbiosis } from '../symbiosis'

const DECIMALS_CACHE = new Map<string, number>()

interface RawToken {
    address: string
    chainId: number
}

function getRawTokenKey(rawToken: RawToken) {
    return `${rawToken.chainId}-${rawToken.address.toLowerCase()}`
}

function getTokenDecimalsFromCache(token: RawToken): number | undefined {
    if (token.address.toLowerCase() === NATIVE_TOKEN_ADDRESS.toLowerCase()) {
        const gasToken = GAS_TOKEN[token.chainId as ChainId]
        if (!gasToken) {
            throw undefined
        }

        return gasToken.decimals
    }

    return DECIMALS_CACHE.get(getRawTokenKey(token))
}

export async function getDecimals(
    symbiosis: Symbiosis,
    tokenA: RawToken,
    tokenB: RawToken
): Promise<[number | undefined, number | undefined]> {
    const toFetch = [tokenA, tokenB].filter((token) => getTokenDecimalsFromCache(token) === undefined)

    let decimals: number[] = []
    if (toFetch.length === 2 && toFetch[0].chainId === toFetch[1].chainId) {
        const chainId = toFetch[0].chainId

        const provider = symbiosis.getProvider(chainId)
        const multicall = await getMulticall(provider)

        const tokenAddresses = toFetch.map((token) => token.address)

        const erc20Interface = new utils.Interface(ERC20)

        const aggregated = await multicall.callStatic.tryAggregate(
            false,
            tokenAddresses.map((tokenAddress) => ({
                target: tokenAddress,
                callData: erc20Interface.encodeFunctionData('decimals'),
            }))
        )

        decimals = aggregated.map(([success, result]) => {
            if (!success) {
                return undefined
            }

            const decoded = erc20Interface.decodeFunctionResult('decimals', result)
            return decoded[0]
        })
    } else if (toFetch.length) {
        decimals = await Promise.all(
            toFetch.map(async (token) => {
                const provider = symbiosis.getProvider(token.chainId)
                const contract = new Contract(token.address, ERC20, provider)

                try {
                    const decimals = await contract.decimals()

                    return decimals
                } catch (e) {
                    return undefined
                }
            })
        )
    }

    for (let i = 0; i < toFetch.length; i++) {
        if (decimals[i] === undefined) {
            continue
        }
        DECIMALS_CACHE.set(getRawTokenKey(toFetch[i]), decimals[i])
    }

    return [getTokenDecimalsFromCache(tokenA), getTokenDecimalsFromCache(tokenB)]
}
