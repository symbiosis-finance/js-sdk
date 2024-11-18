import { describe, expect, test } from 'vitest'
import { ChainId, chains } from '../../src'
import { Transit } from '../../src/crosschain/transit'

describe('Transit#getDirection', async () => {
    const hostChainId = ChainId.BOBA_BNB
    const otherChains = chains.filter((chain) => chain.id !== hostChainId)
    test('mint', () => {
        otherChains.forEach((chain) => {
            expect(Transit['getDirection'](chain.id, ChainId.BOBA_BNB, hostChainId)).toEqual('mint')
        })
    })
    test('burn', () => {
        otherChains.forEach((chain) => {
            expect(Transit['getDirection'](ChainId.BOBA_BNB, chain.id, hostChainId)).toEqual('burn')
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
