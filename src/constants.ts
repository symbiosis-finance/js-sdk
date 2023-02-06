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
    evm?: boolean
}

export enum ChainId {
    ETH_MAINNET = 1,
    ETH_RINKEBY = 4,
    ETH_GOERLI = 5,
    ETH_KOVAN = 42,
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
    BOBA_BNB = 56288,
    BOBA_AVALANCHE = 43288,
    BOBA_RINKEBY = 28,
    MILKOMEDA_MAINNET = 2001,
    MILKOMEDA_DEVNET = 200101,
    BTC_MAINNET = 5555,
    BTC_TESTNET = 55555,
    AURORA_MAINNET = 1313161554,
    AURORA_TESTNET = 1313161555,
    TELOS_MAINNET = 40,
    TELOS_TESTNET = 41,
    SHARDEUM_TESTNET_2 = 8081,
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
    [ChainId.ETH_GOERLI]: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
    [ChainId.ETH_KOVAN]: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
    [ChainId.BSC_MAINNET]: '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73',
    [ChainId.BSC_TESTNET]: '0x6725F303b657a9451d8BA641348b6761A6CC7a17',
    [ChainId.MATIC_MAINNET]: '0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32',
    [ChainId.MATIC_MUMBAI]: '0x8a628F00710993c1cebbaa02338d2264ee7056C6',
    [ChainId.AVAX_MAINNET]: '0xefa94DE7a4656D787667C749f7E1223D71E9FD88',
    [ChainId.AVAX_TESTNET]: '0xb278D63e2E2a4aeb5A398eB87a91FF909B72C8D5',
    [ChainId.HECO_MAINNET]: '0x0000000000000000000000000000000000000000', // TODO
    [ChainId.HECO_TESTNET]: '0xca33f6D096BDD7FcB28d708f631cD76E73Ecfc2d',
    [ChainId.OKEX_MAINNET]: '0x0000000000000000000000000000000000000000', // TODO
    [ChainId.OKEX_TESTNET]: '0xD68B1DCDe3bAeB3FF1483Ad33c3efC6B6e0A8E4C',
    [ChainId.BOBA_MAINNET]: '0xc35DADB65012eC5796536bD9864eD8773aBc74C4',
    [ChainId.BOBA_AVALANCHE]: '0xc35DADB65012eC5796536bD9864eD8773aBc74C4',
    [ChainId.BOBA_BNB]: '0xc35DADB65012eC5796536bD9864eD8773aBc74C4',
    [ChainId.BOBA_RINKEBY]: '0xab740666e226cb5b6b451eb943b0257a7cb3ce0a',
    [ChainId.MILKOMEDA_MAINNET]: '0x2ef06A90b0E7Ae3ae508e83Ea6628a3987945460',
    [ChainId.MILKOMEDA_DEVNET]: '0x428779a1a596c9cfdb68f5daef78b14901b95566',
    [ChainId.BTC_MAINNET]: '0x0000000000000000000000000000000000000000', // TODO
    [ChainId.BTC_TESTNET]: '0x0000000000000000000000000000000000000000', // TODO
    [ChainId.AURORA_MAINNET]: '0xc66F594268041dB60507F00703b152492fb176E7',
    [ChainId.AURORA_TESTNET]: '0x60913758635b54e6C9685f92201A5704eEe74748',
    [ChainId.TELOS_MAINNET]: '0x411172Dfcd5f68307656A1ff35520841C2F7fAec',
    [ChainId.TELOS_TESTNET]: '0x6db1D2C691DcdF4DA36d3497F68a63C7282a4a44',
    [ChainId.SHARDEUM_TESTNET_2]: '0x1DAcbaB28Decd115c8AA6F183877C71b942aE406',
}

export const INIT_CODE_HASH = {
    [ChainId.ETH_MAINNET]: '0x96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f',
    [ChainId.ETH_RINKEBY]: '0x96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f',
    [ChainId.ETH_GOERLI]: '0x96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f',
    [ChainId.ETH_KOVAN]: '0x96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f',
    [ChainId.BSC_MAINNET]: '0x00fb7f630766e6a796048ea87d01acd3068e8ff67d078148a3fa3f4a84f69bd5',
    [ChainId.BSC_TESTNET]: '0xd0d4c4cd0848c93cb4fd1f498d7013ee6bfb25783ea21593d5834f5d250ece66',
    [ChainId.MATIC_MAINNET]: '0x96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f',
    [ChainId.MATIC_MUMBAI]: '0x85f8ad645fe62917d6939782650649d3d7c4b5f25d81415a9fac4a9f341793ca',
    [ChainId.AVAX_MAINNET]: '0x40231f6b438bce0797c9ada29b718a87ea0a5cea3fe9a771abdd76bd41a3e545',
    [ChainId.AVAX_TESTNET]: '0x85f8ad645fe62917d6939782650649d3d7c4b5f25d81415a9fac4a9f341793ca',
    [ChainId.HECO_MAINNET]: '0x0000000000000000000000000000000000000000000000000000000000000000', // TODO
    [ChainId.HECO_TESTNET]: '0x85f8ad645fe62917d6939782650649d3d7c4b5f25d81415a9fac4a9f341793ca',
    [ChainId.OKEX_MAINNET]: '0x0000000000000000000000000000000000000000000000000000000000000000', // TODO
    [ChainId.OKEX_TESTNET]: '0x7f08f1b43a5b37be17b2d24d4f2c6b1311e19eedc53cc4528f0e72cdfb5d8d37',
    [ChainId.BOBA_MAINNET]: '0xe18a34eb0e04b04f7a0ac29a6e80748dca96319b42c54d679cb821dca90c6303',
    [ChainId.BOBA_AVALANCHE]: '0xe18a34eb0e04b04f7a0ac29a6e80748dca96319b42c54d679cb821dca90c6303',
    [ChainId.BOBA_BNB]: '0xe18a34eb0e04b04f7a0ac29a6e80748dca96319b42c54d679cb821dca90c6303',
    [ChainId.BOBA_RINKEBY]: '0x1db9efb13a1398e31bb71895c392fa1217130f78dc65080174491adcec5da9b9',
    [ChainId.MILKOMEDA_MAINNET]: '0x0103d86123641edae209ed992b2bf060ae2baab6a28f5b1eb7dad61335915104',
    [ChainId.MILKOMEDA_DEVNET]: '0x0103d86123641edae209ed992b2bf060ae2baab6a28f5b1eb7dad61335915104',
    [ChainId.BTC_MAINNET]: '0x0000000000000000000000000000000000000000000000000000000000000000', // TODO
    [ChainId.BTC_TESTNET]: '0x0000000000000000000000000000000000000000000000000000000000000000', // TODO
    [ChainId.AURORA_MAINNET]: '0x754e1d90e536e4c1df81b7f030f47b4ca80c87120e145c294f098c83a6cb5ace',
    [ChainId.AURORA_TESTNET]: '0x4a697f690d1f46e0f1a897a8662acae31ced3039b00c052392ed0bc179f9f28c',
    [ChainId.TELOS_MAINNET]: '0x7d4b9bb0d5808344c0184aada7d10aae8f6b0cc8ceb5eba8dd084f63b8c32099',
    [ChainId.TELOS_TESTNET]: '0x4386561b28c0ca71b777ab3684458dd9f6c1b3b7fc609c5758f0f00a48625996',
    [ChainId.SHARDEUM_TESTNET_2]: '0x3bde95ed3dcb15c415ca128950d4807b9e3698b981ff73007c9d3c220a5b2f6f',
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
