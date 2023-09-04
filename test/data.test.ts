import { ChainId, WETH, Token, Fetcher } from '../src'
import { describe, test } from 'vitest'

// TODO: replace the provider in these tests
describe.skip('data', () => {
    test('Token', async () => {
        const token = await Fetcher.fetchTokenData(ChainId.BSC_MAINNET, '0x6B175474E89094C44Da98b954EedeAC495271d0F') // DAI
        expect(token.decimals).toEqual(18)
    })

    test('Token:CACHE', async () => {
        const token = await Fetcher.fetchTokenData(ChainId.BSC_MAINNET, '0xE0B7927c4aF23765Cb51314A0E0521A9645F0E2A') // DGD
        expect(token.decimals).toEqual(9)
    })

    test('Pair', async () => {
        const token = new Token({
            chainId: ChainId.BSC_TESTNET,
            address: '0xc7AD46e0b8a400Bb3C915120d284AafbA8fc4735',
            decimals: 18,
        }) // DAI
        const pair = await Fetcher.fetchPairData(WETH[ChainId.BSC_TESTNET], token)
        expect(pair.liquidityToken.address).toEqual('0x8B22F85d0c844Cf793690F6D9DFE9F11Ddb35449')
    })
})
