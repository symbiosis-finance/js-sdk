import { SwapExactInParams, SwapExactInResult, SwapExactInTransactionPayload } from './types'
import { CrosschainSwapExactInResult } from '../baseSwappingImplementation'
import { Error, ErrorCode } from '../error'
import { ChainId } from '../../constants'
import { Token } from '../../entities'
import { Option, TON_TOKEN_DECIMALS } from '../zappingTon'

const wTonAttributes = {
    decimals: TON_TOKEN_DECIMALS,
    name: 'Wrapped Toncoin',
    symbol: 'WTON',
    icons: {
        small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/11419.png',
        large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/11419.png',
    },
}

const OPTIONS: Option[] = [
    {
        chainId: ChainId.SEPOLIA_TESTNET,
        bridge: '0x3A1e6dA810637fb1c99fa0899b4F402A60E131D2',
        wTon: new Token({
            chainId: ChainId.SEPOLIA_TESTNET,
            address: '0x331f40cc27aC106e1d5242CE633dc6436626a6F8',
            ...wTonAttributes,
        }),
    },
    {
        chainId: ChainId.BSC_MAINNET,
        bridge: '0x35D39bB2cbc51ce6c03f0306d0D8d56948b1f990',
        wTon: new Token({
            chainId: ChainId.BSC_MAINNET,
            address: '0x76A797A59Ba2C17726896976B7B3747BfD1d220f',
            ...wTonAttributes,
        }),
    },
    {
        chainId: ChainId.ETH_MAINNET,
        bridge: '0x195A07D222a82b50DB84e8f47B71504D1E8C5fa2',
        wTon: new Token({
            chainId: ChainId.ETH_MAINNET,
            address: '0x582d872A1B094FC48F5DE31D3B73F2D9bE47def1',
            ...wTonAttributes,
        }),
    },
]

export async function tonSwap(context: SwapExactInParams): Promise<SwapExactInResult> {
    const { inTokenAmount, symbiosis } = context

    // find suitable option for current env
    const options = OPTIONS.filter((i) => {
        return symbiosis.config.chains.map((chain) => chain.id).find((chainId) => chainId === i.chainId)
    })
    if (options.length === 0) {
        throw new Error(`There are no suitable option options`)
    }

    const promises: Promise<CrosschainSwapExactInResult>[] = []
    symbiosis.config.omniPools
        .filter((pool) => pool.generalPurpose)
        .forEach((pool) => {
            options.forEach((option) => {
                const zappingTon = symbiosis.newZappingTon(pool)
                const promise = zappingTon.exactIn({
                    tokenAmountIn: inTokenAmount,
                    option,
                    from: context.fromAddress,
                    to: context.toAddress,
                    slippage: context.slippage,
                    deadline: context.deadline,
                })
                promises.push(promise)
            })
        })

    const results = await Promise.allSettled(promises)

    let bestResult: CrosschainSwapExactInResult | undefined
    const errors: Error[] = []

    for (const item of results) {
        if (item.status !== 'fulfilled') {
            errors.push(item.reason)
            continue
        }

        const { value: result } = item

        if (bestResult && bestResult.tokenAmountOut.greaterThanOrEqual(result.tokenAmountOut.raw)) {
            continue
        }

        bestResult = result
    }

    // TODO remove duplicate code
    if (!bestResult) {
        const uniqueCodes = errors
            .map((i) => i.code)
            .reduce((acc, i) => {
                if (!acc.includes(i)) {
                    acc.push(i)
                }
                return acc
            }, [] as ErrorCode[])

        // if all errors are same return first of them
        if (uniqueCodes.length === 1) {
            throw errors[0]
        }
        // skip no transit token error (no chains pair)
        const otherErrors = errors.filter((e) => {
            return e.code !== ErrorCode.NO_TRANSIT_TOKEN
        })

        if (otherErrors.length > 0) {
            throw otherErrors[0]
        }
        throw errors[0]
    }

    const payload = {
        transactionType: bestResult.type,
        transactionRequest: bestResult.transactionRequest,
    } as SwapExactInTransactionPayload

    return {
        kind: 'crosschain-swap',
        ...bestResult,
        ...payload,
        zapType: 'ton-bridge',
    }
}
