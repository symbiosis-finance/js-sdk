import { arrayify, concat, hexlify } from '@ethersproject/bytes'
import { Filter, Log } from '@ethersproject/providers'
import { toUtf8Bytes, toUtf8String } from '@ethersproject/strings'
import { parseUnits } from '@ethersproject/units'
import { HashZero } from '@ethersproject/constants'
import { bech32 } from 'bech32'
import { BigNumber, utils, BytesLike } from 'ethers'
import sha3 from 'js-sha3'
import JSBI from 'jsbi'
import { ChainId } from '../constants'
import { Fraction, Percent, Token, TokenAmount, Trade } from '../entities'
import { BIPS_BASE, ONE_INCH_CHAINS } from './constants'
import type { Symbiosis } from './symbiosis'
import { Field } from './types'

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

export const canOneInch = (chainId: ChainId) => {
    return ONE_INCH_CHAINS.includes(chainId)
}

// Convert terra address to 20 bytes EVM compatible variant
export function encodeTerraAddress(address: string): string {
    const { words } = bech32.decode(address)

    const addressBytes = bech32.fromWords(words)

    return hexlify(addressBytes)
}

export function decodeTerraAddress(address: string): string {
    const addressBytes = arrayify(address)

    const words = bech32.toWords(addressBytes)

    return bech32.encode('terra', words)
}

export function getInternalId({ contractAddress, requestCount, chainId }: GetInternalIdParams): string {
    return utils.solidityKeccak256(['address', 'uint256', 'uint256'], [contractAddress, requestCount, chainId])
}

export function getTerraInternalId({ contractAddress, requestCount, chainId }: GetInternalIdParams): string {
    const hash = sha3.keccak_256.create()

    // 20 bytes address
    const encodedAddress = arrayify(encodeTerraAddress(contractAddress))
    hash.update(encodedAddress)

    // uint128 - 16 bytes
    const requestIdEncoded = utils.zeroPad(BigNumber.from(requestCount).toHexString(), 16)
    hash.update(requestIdEncoded)

    // uint256 - 32 bytes
    const chainIdEncoded = utils.zeroPad(BigNumber.from(chainId).toHexString(), 32)
    hash.update(chainIdEncoded)

    return `0x${hash.hex()}`
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

export function getTerraExternalId({
    internalId,
    contractAddress,
    revertableAddress,
    chainId,
}: GetExternalIdParams): string {
    const hash = sha3.keccak_256.create()

    hash.update(arrayify(internalId))
    hash.update(arrayify(contractAddress))
    hash.update(arrayify(revertableAddress))

    // uint256 - 32 bytes
    const chainIdEncoded = utils.zeroPad(BigNumber.from(chainId).toHexString(), 32)
    hash.update(chainIdEncoded)

    return `0x${hash.hex()}`
}

export function formatBytesTerraAddressString(text: string): string {
    // Get the bytes
    const bytes = toUtf8Bytes(text)

    // Check we have room for null-termination
    if (bytes.length > 19) {
        throw new Error('Address string must be less than 20 bytes')
    }

    // Zero-pad (implicitly null-terminates)
    return hexlify(concat([bytes, HashZero]).slice(0, 20))
}

const COIN_DENOM_MAX_LENGTH = 4

export function parseBytesTerraAddressString(bytes: BytesLike): string {
    const data = arrayify(bytes)

    // Must be 20 bytes
    if (data.length !== 20) {
        throw new Error('invalid address - not 20 bytes long')
    }

    // Find the null termination
    let length = 19
    while (data[length - 1] === 0) {
        length--
    }

    if (length > COIN_DENOM_MAX_LENGTH) {
        return hexlify(data)
    }

    // Determine the string value
    return toUtf8String(data.slice(0, length))
}

export function encodeTerraAddressToEvmAddress(token: Token): string {
    if (!token.isFromTerra()) {
        throw new Error("Token isn't from Terra network")
    }

    if (token.isNative) {
        return formatBytesTerraAddressString(token.address)
    }

    return encodeTerraAddress(token.address)
}

export function calculateGasMargin(value: BigNumber): BigNumber {
    return value.mul(BigNumber.from(10000).add(BigNumber.from(1000))).div(BigNumber.from(10000))
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
        ? new Percent(priceImpactWithoutFeeFraction?.numerator, priceImpactWithoutFeeFraction?.denominator)
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
        throw new Error('Cannot parse amountOut with decimals')
    }
    const amountIn = tokenAmountIn.raw
    const amountOut = JSBI.BigInt(typedValueParsed)

    const diff = JSBI.subtract(amountIn, amountOut)
    const value = JSBI.divide(JSBI.multiply(diff, BIPS_BASE), amountIn)
    return new Percent(value, BIPS_BASE)
}

export class GetLogTimeoutExceededError extends Error {
    constructor(public readonly filter: Filter) {
        super(`Timed out waiting for logs matching filter: ${JSON.stringify(filter)}`)
    }
}

const DEFAULT_EXCEED_DELAY = 1000 * 60 * 20 // 20 minutes

interface GetLogsWithTimeoutParams {
    symbiosis: Symbiosis
    chainId: ChainId
    filter: Filter
    exceedDelay?: number
}

export async function getLogWithTimeout({
    symbiosis,
    chainId,
    filter,
    exceedDelay: exceedTimeout = DEFAULT_EXCEED_DELAY,
}: GetLogsWithTimeoutParams): Promise<Log> {
    const provider = symbiosis.getProvider(chainId)

    let activeFilter = filter
    if (!activeFilter.fromBlock) {
        const fromBlock = await symbiosis.getFromBlockWithOffset(chainId)

        activeFilter = { ...filter, fromBlock }
    }

    return new Promise((resolve, reject) => {
        const period = 1000 * 60
        let pastTime = 0

        const interval = setInterval(() => {
            pastTime += period
            if (pastTime > exceedTimeout) {
                clearInterval(interval)
                provider.off(activeFilter, listener)
                reject(new GetLogTimeoutExceededError(activeFilter))
                return
            }
            provider
                .getLogs(activeFilter)
                .then((logs) => {
                    if (logs.length > 0) {
                        resolve(logs[0])
                        clearInterval(interval)
                        provider.off(activeFilter, listener)
                    }
                })
                .catch((error) => {
                    reject(error)
                })
        }, period)

        const listener = (log: Log) => {
            clearInterval(interval)
            resolve(log)
        }

        provider.once(activeFilter, listener)
    })
}
