import type { Filter, Log } from '@ethersproject/providers'
import { parseUnits } from '@ethersproject/units'
import { BigNumber, utils } from 'ethers'
import JSBI from 'jsbi'
import flatMap from 'lodash.flatmap'

import type { BigintIsh, ChainId } from '../../constants'
import { ONE } from '../../constants'
import type { Token, Trade } from '../../entities'
import { Fraction, Percent, TokenAmount, wrappedToken } from '../../entities'
import { BASES_TO_CHECK_TRADES_AGAINST, BIPS_BASE, CUSTOM_BASES } from '../constants'
import { SdkError } from '../sdkError'
import type { Symbiosis } from '../symbiosis'
import { Field } from '../types'
import { isBtcChainId } from './btc'
import { isSolanaChainId } from './solana'
import { isTonChainId } from './ton'
import { isTronChainId } from './tron'

interface GetInternalIdParams {
    contractAddress: string
    requestCount: BigNumber
    chainId: ChainId
}

interface GetExternalIdParams {
    internalId: string
    contractAddress: string
    revertableAddress: string
    chainId: ChainId
}

export function isEvmChainId(chainId: ChainId | undefined) {
    if (!chainId) return false
    return !isBtcChainId(chainId) && !isTronChainId(chainId) && !isTonChainId(chainId) && !isSolanaChainId(chainId)
}

export function getInternalId({ contractAddress, requestCount, chainId }: GetInternalIdParams): string {
    return utils.solidityKeccak256(['address', 'uint256', 'uint256'], [contractAddress, requestCount, chainId])
}

export function getExternalId({
    internalId,
    contractAddress,
    revertableAddress,
    chainId,
}: GetExternalIdParams): string {
    return utils.solidityKeccak256(
        ['bytes32', 'address', 'address', 'uint256'],
        [internalId, contractAddress, revertableAddress, chainId]
    )
}

export function calculateGasMargin(value: BigNumber): BigNumber {
    return value.mul(BigNumber.from(10000).add(BigNumber.from(5000))).div(BigNumber.from(10000))
}

// computes price breakdown for the trade
export function computeTradePriceBreakdown(
    trade?: Trade,
    dexFee?: number
): {
    priceImpactWithoutFee?: Percent
    realizedLPFee?: TokenAmount
} {
    const BASE_FEE = new Percent(JSBI.BigInt(dexFee || 30), JSBI.BigInt(10000))
    const ONE_HUNDRED_PERCENT = new Percent(JSBI.BigInt(10000), JSBI.BigInt(10000))
    const INPUT_FRACTION_AFTER_FEE = ONE_HUNDRED_PERCENT.subtract(BASE_FEE)

    // for each hop in our trade, take away the x*y=k price impact from 0.3% fees
    // e.g. for 3 tokens/2 hops: 1 - ((1 - .03) * (1-.03))
    const realizedLPFee = !trade
        ? undefined
        : ONE_HUNDRED_PERCENT.subtract(
              trade.route.pairs.reduce<Fraction>(
                  (currentFee: Fraction): Fraction => currentFee.multiply(INPUT_FRACTION_AFTER_FEE),
                  ONE_HUNDRED_PERCENT
              )
          )

    // remove lp fees from price impact
    const priceImpactWithoutFeeFraction = trade && realizedLPFee ? trade.priceImpact.subtract(realizedLPFee) : undefined

    // the x*y=k impact
    const priceImpactWithoutFeePercent = priceImpactWithoutFeeFraction
        ? new Percent(
              JSBI.multiply(priceImpactWithoutFeeFraction?.numerator, JSBI.BigInt('-1')),
              priceImpactWithoutFeeFraction?.denominator
          )
        : undefined

    // the amount of the input that accrues to LPs
    const realizedLPFeeAmount =
        realizedLPFee &&
        trade &&
        new TokenAmount(trade.inputAmount.token, realizedLPFee.multiply(trade.inputAmount.raw).quotient)
    return {
        priceImpactWithoutFee: priceImpactWithoutFeePercent,
        realizedLPFee: realizedLPFeeAmount,
    }
}

// converts a basis points value to a sdk percent
export function basisPointsToPercent(num: number): Percent {
    return new Percent(JSBI.BigInt(Math.floor(num)), JSBI.BigInt(10000))
}

export function getMinAmount(slippage: number, amount: BigintIsh): JSBI {
    const slippageTolerance = basisPointsToPercent(slippage)
    return new Fraction(ONE).subtract(slippageTolerance).multiply(amount).quotient
}

// computes the minimum amount out and maximum amount in for a trade given a user specified allowed slippage in bips
export function computeSlippageAdjustedAmounts(
    trade: Trade | undefined,
    allowedSlippage: number
): { [field in Field]?: TokenAmount } {
    const pct = basisPointsToPercent(allowedSlippage)
    return {
        [Field.INPUT]: trade?.maximumAmountIn(pct),
        [Field.OUTPUT]: trade?.minimumAmountOut(pct),
    }
}

export function calculatePriceImpact(tokenAmountIn: TokenAmount, tokenAmountOut: TokenAmount): Percent {
    const typedValueParsed = parseUnits(
        tokenAmountOut.toExact(tokenAmountIn.token.decimals),
        tokenAmountIn.token.decimals
    ).toString()
    if (typedValueParsed === '0') {
        throw new SdkError('Cannot parse amountOut with decimals')
    }
    const amountIn = tokenAmountIn.raw
    const amountOut = JSBI.BigInt(typedValueParsed)

    const diff = JSBI.subtract(amountOut, amountIn)
    const value = JSBI.divide(JSBI.multiply(diff, BIPS_BASE), amountIn)
    return new Percent(value, BIPS_BASE)
}

export class GetLogTimeoutExceededError extends Error {
    constructor(public readonly filter: Filter) {
        super(`Timed out waiting for logs matching filter: ${JSON.stringify(filter)}`)
    }
}

export const DEFAULT_EXCEED_DELAY = 1000 * 60 * 20 // 20 minutes

interface GetLogsWithTimeoutParams {
    symbiosis: Symbiosis
    chainId: ChainId
    filter: Filter
    exceedDelay?: number
}

function _promiseRaceResolved<T>(promises: Promise<T>[]): Promise<T> {
    let rejectCounter = 0
    const totalPromises = promises.length

    return new Promise((resolve, reject) => {
        const onReject = () => {
            rejectCounter++
            if (rejectCounter === totalPromises) {
                reject(new SdkError('All promises were rejected.'))
            }
        }

        promises.forEach((promise) => {
            // Promise.resolve to "promisify" any value
            Promise.resolve(promise).then(resolve).catch(onReject)
        })
    })
}

export async function getLogWithTimeout({
    symbiosis,
    chainId,
    filter,
    exceedDelay: exceedTimeout = DEFAULT_EXCEED_DELAY,
}: GetLogsWithTimeoutParams): Promise<Log> {
    const spareRpcs = symbiosis.config.chains.find((chain) => chain.id === chainId)?.spareRpcs ?? []
    const spareProviders = spareRpcs.map((rpc) => symbiosis.getProvider(chainId, rpc))

    const provider = symbiosis.getProvider(chainId)

    let activeFilter = filter
    if (!activeFilter.fromBlock) {
        const fromBlock = await symbiosis.getFromBlockWithOffset(chainId)

        activeFilter = { ...filter, fromBlock }
    }

    return new Promise((resolve, reject) => {
        const period = 1000 * 10 // 10 seconds
        let pastTime = 0
        let logs: Log[] = []

        const getLogs = async () => {
            pastTime += period
            if (pastTime > exceedTimeout) {
                clearInterval(interval)
                reject(new GetLogTimeoutExceededError(activeFilter))
                return
            }

            try {
                logs = await provider.getLogs(activeFilter)
            } catch (error) {
                logs = await _promiseRaceResolved(
                    spareProviders.map((spareProvider) => spareProvider.getLogs(activeFilter))
                )
            } finally {
                if (logs.length > 0) {
                    resolve(logs[0])
                    clearInterval(interval)
                }
            }
        }

        const interval = setInterval(getLogs, period)
        getLogs()
    })
}

export function getAllPairCombinations(tokenIn: Token, tokenOut: Token): [Token, Token][] {
    const chainId = tokenIn.chainId

    // Base tokens for building intermediary trading routes
    const bases = BASES_TO_CHECK_TRADES_AGAINST[chainId] || []

    // All pairs from base tokens
    const basePairs: [Token, Token][] = flatMap(bases, (base: Token): [Token, Token][] =>
        bases.map((otherBase) => [base, otherBase])
    ).filter(([t0, t1]) => t0.address !== t1.address)

    const [tokenA, tokenB] = [wrappedToken(tokenIn), wrappedToken(tokenOut)]
    if (!tokenA || !tokenB) {
        return []
    }

    return (
        [
            // the direct pair
            [tokenA, tokenB],
            // token A against all bases
            ...bases.map((base): [Token, Token] => [tokenA, base]),
            // token B against all bases
            ...bases.map((base): [Token, Token] => [tokenB, base]),
            // each base against all bases
            ...basePairs,
        ]
            .filter((tokens): tokens is [Token, Token] => Boolean(tokens[0] && tokens[1]))
            .filter(([t0, t1]) => t0.address !== t1.address)
            // This filter will remove all the pairs that are not supported by the CUSTOM_BASES settings
            // This option is currently not used on Pancake swap
            .filter(([t0, t1]) => {
                if (!chainId) return true
                const customBases = CUSTOM_BASES[chainId]
                if (!customBases) return true

                const customBasesA: Token[] | undefined = customBases[t0.address]
                const customBasesB: Token[] | undefined = customBases[t1.address]

                if (!customBasesA && !customBasesB) return true
                if (customBasesA && !customBasesA.find((base) => t1.equals(base))) return false
                if (customBasesB && !customBasesB.find((base) => t0.equals(base))) return false

                return true
            })
    )
}

export interface DetailedSlippage {
    A: number
    B: number
    C: number
}

export function splitSlippage(totalSlippage: number, hasTradeA: boolean, hasTradeC: boolean): DetailedSlippage {
    const minSlippage = 20 // 0.2%
    if (totalSlippage < minSlippage) {
        throw new SdkError(`Slippage cannot be less than ${(minSlippage / 100).toString()}%`)
    }

    let extraSwapsCount = 0
    if (hasTradeA) {
        extraSwapsCount += 1
    }
    if (hasTradeC) {
        extraSwapsCount += 1
    }
    const swapsCount = extraSwapsCount + 1

    const avg = totalSlippage / swapsCount

    let addition = 0
    let symbiosisPoolSlippage = avg
    const symbiosisPoolMaxSlippage = 20 // 0.2%
    if (avg > symbiosisPoolMaxSlippage) {
        const rest = avg - symbiosisPoolMaxSlippage
        symbiosisPoolSlippage = symbiosisPoolMaxSlippage
        addition = extraSwapsCount > 0 ? rest / extraSwapsCount : 0
    }

    return {
        A: hasTradeA ? Math.floor((avg + addition) * 100) / 100 : 0,
        B: Math.floor(symbiosisPoolSlippage * 100) / 100,
        C: hasTradeC ? Math.floor((avg + addition + symbiosisPoolSlippage) * 100) / 100 : 0,
    }
}
