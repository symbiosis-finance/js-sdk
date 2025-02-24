import { address, Network, networks } from 'bitcoinjs-lib'
import { BigNumber } from 'ethers'

import { Token, TokenAmount } from '../../entities'
import { Cache } from '../cache'
import { getFastestFee } from '../mempool'
import { Synthesis } from '../contracts'
import { ChainId } from '../../constants'

export type BtcConfig = {
    btc: Token
    symBtc: {
        address: string
        chainId: ChainId
    }
    forwarderUrl: string
}

export const BTC_CONFIGS: BtcConfig[] = [
    {
        btc: new Token({
            deprecated: true,
            name: 'Bitcoin',
            symbol: 'BTC',
            address: '0xc102C66D4a1e1865Ee962084626Cf4c27D5BFc74',
            chainId: ChainId.BTC_MAINNET,
            decimals: 8,
            icons: {
                large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1.png',
                small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1.png',
            },
        }),
        symBtc: {
            address: '0x49731d3c7234619a74B4c095838AfbC19cC44f28',
            chainId: ChainId.ZKSYNC_MAINNET,
        },
        forwarderUrl: 'https://btc-forwarder.symbiosis.finance/zksync/forwarder/api/v1',
    },
    {
        btc: new Token({
            name: 'Bitcoin',
            symbol: 'BTC',
            address: '0x1dfc1e32d75b3f4cb2f2b1bcecad984e99eeba05',
            chainId: ChainId.BTC_MAINNET,
            decimals: 8,
            icons: {
                large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1.png',
                small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1.png',
            },
        }),
        symBtc: {
            address: '0xa1262496e84a9663b7AB64ed96C152A23d0B7214',
            chainId: ChainId.BSC_MAINNET,
        },
        forwarderUrl: 'https://btc-forwarder.symbiosis.finance/bsc/forwarder/api/v1',
    },
]

export const getBtcConfig = (btc: Token): BtcConfig => {
    const config = BTC_CONFIGS.find((i) => i.btc.equals(btc))
    if (!config) {
        throw new Error('BTC config not found')
    }
    return config
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

export function getPkScript(addr: string, btcChain: Network): Buffer {
    return address.toOutputScript(addr, btcChain)
}

export function getAddress(pkScript: string, btcChain: Network): string {
    return address.fromOutputScript(Buffer.from(pkScript.substring(2), 'hex'), btcChain)
}
