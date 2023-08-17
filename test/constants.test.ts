import { ChainId, INIT_CODE_HASH } from '../src/constants'
import { describe, expect, test } from 'vitest'

describe('constants', () => {
    describe('INIT_CODE_HASH', () => {
        test('matches computed bytecode hash', () => {
            expect(INIT_CODE_HASH[ChainId.BSC_MAINNET]).toEqual(
                '0x00fb7f630766e6a796048ea87d01acd3068e8ff67d078148a3fa3f4a84f69bd5'
            )
        })
    })
})
