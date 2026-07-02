import { AddressZero } from '@ethersproject/constants'
import { BigNumber } from 'ethers'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { ChainId } from '../../../src/constants'
import { FeeCollector__factory, ThorRouter__factory } from '../../../src/crosschain/contracts'
import {
    BSC_USDT,
    ETH_USDC,
    getCrossChainThorTokens,
    getOnChainThorTokens,
    getThorVault,
    THOR_TOKENS_IN,
} from '../../../src/crosschain/swapExactIn/thorChainSwap/utils'
import { zappingOnChainThor } from '../../../src/crosschain/swapExactIn/thorChainSwap/zappingOnChainThor'
import { GAS_TOKEN, Token } from '../../../src/entities'
import { TokenAmount } from '../../../src/entities/fractions/tokenAmount'

vi.mock('../../../src/crosschain/api/thorchain', () => ({
    thorchainApi: {
        thorchain: {
            quoteswap: vi.fn(),
            pools: vi.fn(),
            inboundAddresses: vi.fn(),
        },
    },
}))

vi.mock('../../../src/crosschain/trade', () => ({
    TradeProvider: {
        THORCHAIN_BRIDGE: 'thorchain-bridge',
    },
}))

import { thorchainApi } from '../../../src/crosschain/api/thorchain'

const ETH_USDT = new Token({
    name: 'Tether USD',
    symbol: 'USDT',
    address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    chainId: ChainId.ETH_MAINNET,
    decimals: 6,
})

const FROM = '0x93F68892E5BFB763B0E9aa101b694dFc708c2ca0'
const THOR_ROUTER = '0x1111111111111111111111111111111111111111'
const THOR_VAULT = '0x2222222222222222222222222222222222222222'
const APPROVE_ADDRESS = '0x3333333333333333333333333333333333333333'
const BTC_ADDRESS = '1BoatSLRHtKNngkdXEeobR76b53LETtpyT'

beforeEach(() => {
    vi.restoreAllMocks()
    vi.mocked(thorchainApi.thorchain.quoteswap).mockResolvedValue({
        memo: `=:BTC.BTC:${BTC_ADDRESS}:777/1/0`,
        router: THOR_ROUTER,
        fees: { total: '1000' },
        expected_amount_out: '1234',
    } as any)
})

function thorCache(asset: string, chain: string) {
    return {
        get: async (key: string[]) => {
            if (key[1] === 'pools') {
                return [{ asset, status: 'Available' }]
            }
            return [{ chain, address: THOR_VAULT, halted: false }]
        },
    }
}

describe('THORChain input tokens', () => {
    test('includes native gas tokens and USDT for supported EVM chains', () => {
        expect(THOR_TOKENS_IN.some((token) => token.equals(GAS_TOKEN[ChainId.ETH_MAINNET]))).toBe(true)
        expect(THOR_TOKENS_IN.some((token) => token.equals(GAS_TOKEN[ChainId.AVAX_MAINNET]))).toBe(true)
        expect(THOR_TOKENS_IN.some((token) => token.equals(GAS_TOKEN[ChainId.BSC_MAINNET]))).toBe(true)
        expect(THOR_TOKENS_IN.some((token) => token.equals(ETH_USDT))).toBe(true)
    })

    test('uses only the direct THORChain token when the source is supported', () => {
        const tokens = getOnChainThorTokens(ETH_USDT)

        expect(tokens).toHaveLength(1)
        expect(tokens[0].equals(ETH_USDT)).toBe(true)
    })

    test('uses only the direct native THORChain token when the source is supported', () => {
        const tokens = getOnChainThorTokens(GAS_TOKEN[ChainId.ETH_MAINNET])

        expect(tokens).toHaveLength(1)
        expect(tokens[0].equals(GAS_TOKEN[ChainId.ETH_MAINNET])).toBe(true)
    })

    test('keeps native gas tokens out of cross-chain THORChain candidates', () => {
        const tokens = getCrossChainThorTokens()

        expect(tokens.length).toBeGreaterThan(0)
        expect(tokens.every((token) => !token.isNative)).toBe(true)
    })

    test('formats native gas tokens as native THORChain assets', async () => {
        await expect(getThorVault(thorCache('ETH.ETH', 'ETH') as any, GAS_TOKEN[ChainId.ETH_MAINNET])).resolves.toBe(
            THOR_VAULT
        )
        await expect(
            getThorVault(thorCache('AVAX.AVAX', 'AVAX') as any, GAS_TOKEN[ChainId.AVAX_MAINNET])
        ).resolves.toBe(THOR_VAULT)
        await expect(getThorVault(thorCache('BSC.BNB', 'BSC') as any, GAS_TOKEN[ChainId.BSC_MAINNET])).resolves.toBe(
            THOR_VAULT
        )
    })

    test('formats ERC-20s as THORChain token assets with addresses', async () => {
        await expect(
            getThorVault(thorCache('ETH.USDC-0XA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48', 'ETH') as any, ETH_USDC)
        ).resolves.toBe(THOR_VAULT)
        await expect(
            getThorVault(thorCache('BSC.USDT-0X55D398326F99059FF775485246999027B3197955', 'BSC') as any, BSC_USDT)
        ).resolves.toBe(THOR_VAULT)
    })

    test('builds direct native deposit calldata with no ERC-20 approval', async () => {
        const fee = BigNumber.from('1000000000000000')
        const amountIn = BigNumber.from('1000000000000000000')
        const depositAmount = amountIn.sub(fee)
        const feeCollectorInterface = FeeCollector__factory.createInterface()

        vi.spyOn(FeeCollector__factory, 'connect').mockReturnValue({
            callStatic: {
                fee: vi.fn().mockResolvedValue(fee),
                onchainGateway: vi.fn().mockResolvedValue(APPROVE_ADDRESS),
            },
            interface: feeCollectorInterface,
        } as any)

        const cache = {
            get: async (key: string[], factory: () => Promise<unknown>) => {
                if (key[1] === 'pools') {
                    return [{ asset: 'ETH.ETH', status: 'Available' }]
                }
                if (key[1] === 'inbound_addresses') {
                    return [{ chain: 'ETH', address: THOR_VAULT, halted: false }]
                }
                return factory()
            },
        }

        const result = await zappingOnChainThor(
            {
                symbiosis: {
                    cache,
                    getProvider: vi.fn().mockReturnValue({}),
                    config: { fallbackReceiver: FROM },
                } as any,
                from: FROM,
                to: BTC_ADDRESS,
                tokenAmountIn: new TokenAmount(GAS_TOKEN[ChainId.ETH_MAINNET], amountIn.toString()),
                tokenOut: GAS_TOKEN[ChainId.BTC_MAINNET],
                slippage: 20,
                deadline: 0,
            },
            GAS_TOKEN[ChainId.ETH_MAINNET],
            'BTC.BTC'
        )

        expect(result.approveTo).toBe(AddressZero)
        expect(result.transactionType).toBe('evm')
        if (result.transactionType !== 'evm') {
            throw new Error('Expected EVM transaction')
        }
        expect(result.transactionRequest.value).toBe(amountIn.toString())

        const onswap = feeCollectorInterface.decodeFunctionData('onswap', result.transactionRequest.data!)
        expect(onswap[0]).toBe(AddressZero)
        expect(onswap[1].toString()).toBe(depositAmount.toString())
        expect(onswap[2]).toBe(THOR_ROUTER)

        const deposit = ThorRouter__factory.createInterface().decodeFunctionData('depositWithExpiry', onswap[4])
        expect(deposit[0]).toBe(THOR_VAULT)
        expect(deposit[1]).toBe(AddressZero)
        expect(deposit[2].toString()).toBe(depositAmount.toString())
        expect(deposit[3]).toContain('/1/0')
    })
})
