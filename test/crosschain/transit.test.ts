import { describe, expect, test } from 'vitest'
import { ChainId, chains } from '../../src/index.ts'
import { Transit } from '../../src/crosschain/transit.ts'

describe('Transit#getDirection', async () => {
    const hostChainId = ChainId.SYMBIOSIS_MAINNET
    const otherChains = chains.filter((chain) => chain.id !== hostChainId)
    test('mint', () => {
        otherChains.forEach((chain) => {
            expect(Transit['getDirection'](chain.id, ChainId.SYMBIOSIS_MAINNET, hostChainId)).toEqual('mint')
        })
    })
    test('burn', () => {
        otherChains.forEach((chain) => {
            expect(Transit['getDirection'](ChainId.SYMBIOSIS_MAINNET, chain.id, hostChainId)).toEqual('burn')
        })
    })
    test('v2', () => {
        otherChains.forEach((chain1) => {
            otherChains.forEach((chain2) => {
                expect(Transit['getDirection'](chain1.id, chain2.id, hostChainId)).toEqual('v2')
            })
        })
    })
})
