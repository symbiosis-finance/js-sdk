import JSBI from 'jsbi'

// exports for external consumption
export type BigintIsh = JSBI | bigint | string

export type Icons = {
    large?: string
    small?: string
}

export type TokenConstructor = {
    name?: string
    symbol?: string
    address: string
    decimals: number
    chainId: ChainId
    isNative?: boolean
    isStable?: boolean
    chainFromId?: ChainId
    icons?: Icons
    userToken?: boolean
}

export type ChainConstructor = {
    id: ChainId
    name: string
    explorer: string
    disabled: boolean
    icons: Icons
    swappable?: boolean
}

export enum ChainId {
    ETH_MAINNET = 1,
    ETH_RINKEBY = 4,
    BSC_MAINNET = 56,
    BSC_TESTNET = 97,
    MATIC_MAINNET = 137,
    MATIC_MUMBAI = 80001,
    AVAX_MAINNET = 43114,
    AVAX_TESTNET = 43113,
    HECO_MAINNET = 128,
    HECO_TESTNET = 256,
    OKEX_MAINNET = 66,
    OKEX_TESTNET = 65,
    BOBA_MAINNET = 288,
    BOBA_RINKEBY = 28,
    MILKOMEDA_MAINNET = 2001,
    MILKOMEDA_DEVNET = 200101,
}

export enum TradeType {
    EXACT_INPUT,
    EXACT_OUTPUT,
}

export enum Rounding {
    ROUND_DOWN,
    ROUND_HALF_UP,
    ROUND_UP,
}
export const FACTORY_ADDRESS = {
    [ChainId.ETH_MAINNET]: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
    [ChainId.ETH_RINKEBY]: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
    [ChainId.BSC_MAINNET]: '0xBCfCcbde45cE874adCB698cC183deBcF17952812',
    [ChainId.BSC_TESTNET]: '0x6725F303b657a9451d8BA641348b6761A6CC7a17',
    [ChainId.MATIC_MAINNET]: '0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32',
    [ChainId.MATIC_MUMBAI]: '0x8a628F00710993c1cebbaa02338d2264ee7056C6',
    [ChainId.AVAX_MAINNET]: '0xefa94DE7a4656D787667C749f7E1223D71E9FD88',
    [ChainId.AVAX_TESTNET]: '0xb278D63e2E2a4aeb5A398eB87a91FF909B72C8D5',
    [ChainId.HECO_MAINNET]: '0x0000000000000000000000000000000000000000', // TODO
    [ChainId.HECO_TESTNET]: '0xca33f6D096BDD7FcB28d708f631cD76E73Ecfc2d',
    [ChainId.OKEX_MAINNET]: '0x0000000000000000000000000000000000000000', // TODO
    [ChainId.OKEX_TESTNET]: '0xD68B1DCDe3bAeB3FF1483Ad33c3efC6B6e0A8E4C',
    [ChainId.BOBA_MAINNET]: '0x7DDaF116889D655D1c486bEB95017a8211265d29',
    [ChainId.BOBA_RINKEBY]: '0xab740666e226cb5b6b451eb943b0257a7cb3ce0a',
    [ChainId.MILKOMEDA_MAINNET]: '0x0000000000000000000000000000000000000000', // TODO
    [ChainId.MILKOMEDA_DEVNET]: '0x0000000000000000000000000000000000000000', // TODO
}

export const INIT_CODE_HASH = {
    [ChainId.ETH_MAINNET]: '0x96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f',
    [ChainId.ETH_RINKEBY]: '0x96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f',
    [ChainId.BSC_MAINNET]: '0xd0d4c4cd0848c93cb4fd1f498d7013ee6bfb25783ea21593d5834f5d250ece66',
    [ChainId.BSC_TESTNET]: '0xd0d4c4cd0848c93cb4fd1f498d7013ee6bfb25783ea21593d5834f5d250ece66',
    [ChainId.MATIC_MAINNET]: '0x96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f',
    [ChainId.MATIC_MUMBAI]: '0x85f8ad645fe62917d6939782650649d3d7c4b5f25d81415a9fac4a9f341793ca',
    [ChainId.AVAX_MAINNET]: '0x40231f6b438bce0797c9ada29b718a87ea0a5cea3fe9a771abdd76bd41a3e545',
    [ChainId.AVAX_TESTNET]: '0x85f8ad645fe62917d6939782650649d3d7c4b5f25d81415a9fac4a9f341793ca',
    [ChainId.HECO_MAINNET]: '0x0000000000000000000000000000000000000000000000000000000000000000', // TODO
    [ChainId.HECO_TESTNET]: '0x85f8ad645fe62917d6939782650649d3d7c4b5f25d81415a9fac4a9f341793ca',
    [ChainId.OKEX_MAINNET]: '0x0000000000000000000000000000000000000000000000000000000000000000', // TODO
    [ChainId.OKEX_TESTNET]: '0x7f08f1b43a5b37be17b2d24d4f2c6b1311e19eedc53cc4528f0e72cdfb5d8d37',
    [ChainId.BOBA_MAINNET]: '0x1db9efb13a1398e31bb71895c392fa1217130f78dc65080174491adcec5da9b9',
    [ChainId.BOBA_RINKEBY]: '0x1db9efb13a1398e31bb71895c392fa1217130f78dc65080174491adcec5da9b9',
    [ChainId.MILKOMEDA_MAINNET]: '0x0000000000000000000000000000000000000000000000000000000000000000', // TODO
    [ChainId.MILKOMEDA_DEVNET]: '0x0000000000000000000000000000000000000000000000000000000000000000', // TODO
}

export const MINIMUM_LIQUIDITY = JSBI.BigInt(1000)

// exports for internal consumption
export const ZERO = JSBI.BigInt(0)
export const ONE = JSBI.BigInt(1)
export const TWO = JSBI.BigInt(2)
export const THREE = JSBI.BigInt(3)
export const FIVE = JSBI.BigInt(5)
export const TEN = JSBI.BigInt(10)
export const _100 = JSBI.BigInt(100)
export const _998 = JSBI.BigInt(998)
export const _1000 = JSBI.BigInt(1000)

export enum SolidityType {
    uint8 = 'uint8',
    uint256 = 'uint256',
}

export const SOLIDITY_TYPE_MAXIMA = {
    [SolidityType.uint8]: JSBI.BigInt('0xff'),
    [SolidityType.uint256]: JSBI.BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'),
}
