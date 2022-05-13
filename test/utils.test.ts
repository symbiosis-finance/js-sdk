import { decodeTerraAddress, encodeTerraAddress } from '../src'

describe('terra', () => {
    it('encode', () => {
        expect(encodeTerraAddress('terra1a2yhxwheuhysa8utp65nkqg9z03r5u8rzflxww')).toEqual(
            '0xea89733Af9e5C90E9f8B0Ea93b010513E23a70e3'.toLowerCase()
        )
    })
    it('decode', () => {
        expect(decodeTerraAddress('0xea89733Af9e5C90E9f8B0Ea93b010513E23a70e3'.toLowerCase())).toEqual(
            'terra1a2yhxwheuhysa8utp65nkqg9z03r5u8rzflxww'
        )
    })
})
