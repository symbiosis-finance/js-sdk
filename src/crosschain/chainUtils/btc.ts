import { address, Network, networks } from 'bitcoinjs-lib'
import { BigNumber } from 'ethers'

import { TokenAmount } from '../../entities'
import { Cache } from '../cache'
import { getFastestFee } from '../mempool'
import { Synthesis } from '../contracts'
import { ChainId } from '../../constants'

export const getThreshold = async (syBtcAmount: TokenAmount, synthesis: Synthesis, cache: Cache) => {
    const syBtc = syBtcAmount.token

    const threshold = await cache.get(
        ['tokenThreshold', synthesis.address, syBtc.address],
        async () => {
            return synthesis.tokenThreshold(syBtc.address)
        },
        24 * 60 * 60 // 24 hours
    )
    return new TokenAmount(syBtc, threshold.toString())
}

export const getToBtcFee = async (syBtcAmount: TokenAmount, synthesis: Synthesis, cache: Cache) => {
    const syBtc = syBtcAmount.token
    let fee = await cache.get(
        ['syntToMinFeeBTC', synthesis.address, syBtc.address],
        async () => {
            return synthesis.syntToMinFeeBTC(syBtc.address)
        },
        600 // 10 minutes
    )

    try {
        const fastestFee = await cache.get(['getFastestFee'], getFastestFee, 60) // 1 minute
        const recommendedFee = BigNumber.from(fastestFee * 300) // 300 vByte
        if (recommendedFee.gt(fee)) {
            fee = recommendedFee
        }
    } catch {
        /* nothing */
    }

    return new TokenAmount(syBtc, fee.toString())
}

export function isBtcChainId(chainId: ChainId | undefined) {
    if (!chainId) return false
    return [ChainId.BTC_MAINNET, ChainId.BTC_MUTINY, ChainId.BTC_TESTNET4].includes(chainId)
}

export const BTC_NETWORKS: Partial<Record<ChainId, Network>> = {
    [ChainId.BTC_MAINNET]: networks.bitcoin,
    [ChainId.BTC_MUTINY]: networks.testnet,
    [ChainId.BTC_TESTNET4]: networks.testnet,
}

export function getPkScriptForChain(addr: string, btcChain: Network): Buffer {
    return address.toOutputScript(addr, btcChain)
}

export function getPkScript(addr: string, btcChainId: ChainId): Buffer {
    const network = BTC_NETWORKS[btcChainId]
    if (!network) {
        throw new Error(`Unknown BTC network ${btcChainId}`)
    }
    return getPkScriptForChain(addr, network)
}

export function getAddress(pkScript: string, btcChain: Network): string {
    return address.fromOutputScript(Buffer.from(pkScript.substring(2), 'hex'), btcChain)
}
