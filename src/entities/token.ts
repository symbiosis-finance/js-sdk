import JSBI from 'jsbi'

import { ChainId, Icons, SolidityType, TokenConstructor } from '../constants'
import { validateAndParseAddress, validateSolidityTypeInstance } from '../utils'
import invariant from 'tiny-invariant'
import { Chain, getChainById } from './chain'

/**
 * A token is any fungible financial instrument on Ethereum.
 *
 */
export class Token {
    public readonly decimals: number
    public readonly symbol?: string
    public readonly name?: string
    public readonly chainId: ChainId
    public readonly address: string
    public readonly icons?: Icons
    public readonly chainFromId?: ChainId
    public readonly isNative: boolean
    public readonly isStable?: boolean
    public readonly userToken?: boolean

    /**
     * Constructs an instance of the base class `Token`.
     * @param params TokenConstructor
     */
    constructor(params: TokenConstructor) {
        validateSolidityTypeInstance(JSBI.BigInt(params.decimals), SolidityType.uint8)

        this.decimals = params.decimals
        this.symbol = params.symbol
        this.name = params.name
        this.chainId = params.chainId
        this.address = validateAndParseAddress(params.address)
        this.isNative = !!params.isNative
        this.icons = params.icons
        this.chainFromId = params.chainFromId
        this.isStable = params.isStable
        this.userToken = params.userToken
    }

    /**
     * Returns true if the two tokens are equivalent, i.e. have the same chainId and address.
     * @param other other token to compare
     */
    public equals(other: Token): boolean {
        // short circuit on reference equality
        if (this === other) {
            return true
        }
        return this.chainId === other.chainId && this.address === other.address
    }

    /**
     * Returns true if the address of this token sorts before the address of the other token
     * @param other other token to compare
     * @throws if the tokens have the same address
     * @throws if the tokens are on different chains
     */
    public sortsBefore(other: Token): boolean {
        invariant(this.chainId === other.chainId, 'CHAIN_IDS')
        invariant(this.address !== other.address, 'ADDRESSES')
        return this.address.toLowerCase() < other.address.toLowerCase()
    }
    get isSynthetic() {
        return !!this.chainFromId
    }

    get chain(): Chain | undefined {
        return getChainById(this.chainId)
    }

    get chainFrom(): Chain | undefined {
        return getChainById(this.chainFromId)
    }
}
/**
 * Compares two currencies for equality
 */
export function tokenEquals(tokenA: Token, tokenB: Token): boolean {
    return tokenA.equals(tokenB)
}

export const WETH = {
    [ChainId.BTC_MAINNET]: new Token({
        chainId: ChainId.BTC_MAINNET,
        address: '',
        decimals: 8,
    }),
    [ChainId.BTC_TESTNET]: new Token({
        chainId: ChainId.BTC_TESTNET,
        address: '',
        decimals: 8,
    }),
    [ChainId.ETH_MAINNET]: new Token({
        chainId: ChainId.ETH_MAINNET,
        address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        decimals: 18,
        symbol: 'WETH',
        isNative: false,
        name: 'Wrapped ETH',
        icons: {
            large: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png',
            small: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png',
        },
    }),
    [ChainId.ETH_RINKEBY]: new Token({
        chainId: ChainId.ETH_RINKEBY,
        address: '0xc778417e063141139fce010982780140aa0cd5ab',
        decimals: 18,
        symbol: 'WETH',
        isNative: false,
        name: 'Wrapped ETH',
        icons: {
            large: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png',
            small: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png',
        },
    }),
    [ChainId.ETH_GOERLI]: new Token({
        chainId: ChainId.ETH_GOERLI,
        address: '0xb4fbf271143f4fbf7b91a5ded31805e42b2208d6',
        decimals: 18,
        symbol: 'WETH',
        isNative: false,
        name: 'Wrapped ETH',
        icons: {
            large: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png',
            small: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png',
        },
    }),
    [ChainId.ETH_KOVAN]: new Token({
        chainId: ChainId.ETH_KOVAN,
        address: '0xd0A1E359811322d97991E03f863a0C30C2cF029C',
        decimals: 18,
        symbol: 'WETH',
        isNative: false,
        name: 'Wrapped ETH',
        icons: {
            large: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png',
            small: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png',
        },
    }),
    [ChainId.BSC_MAINNET]: new Token({
        chainId: ChainId.BSC_MAINNET,
        address: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
        decimals: 18,
        symbol: 'WBNB',
        isNative: false,
        name: 'Wrapped BNB',
        icons: {
            large: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/binance/info/logo.png',
            small: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/binance/info/logo.png',
        },
    }),
    [ChainId.BSC_TESTNET]: new Token({
        chainId: ChainId.BSC_TESTNET,
        address: '0xae13d989dac2f0debff460ac112a837c89baa7cd',
        decimals: 18,
        symbol: 'WBNB',
        isNative: false,
        name: 'Wrapped BNB',
        icons: {
            large: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/binance/info/logo.png',
            small: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/binance/info/logo.png',
        },
    }),
    [ChainId.MATIC_MAINNET]: new Token({
        chainId: ChainId.MATIC_MAINNET,
        address: '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270',
        decimals: 18,
        symbol: 'WMATIC',
        isNative: false,
        name: 'Wrapped MATIC',
        icons: {
            large: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/info/logo.png',
            small: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/info/logo.png',
        },
    }),
    [ChainId.MATIC_MUMBAI]: new Token({
        chainId: ChainId.MATIC_MUMBAI,
        address: '0x9c3C9283D3e44854697Cd22D3Faa240Cfb032889',
        decimals: 18,
        symbol: 'WMATIC',
        isNative: false,
        name: 'Wrapped MATIC',
        icons: {
            large: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/info/logo.png',
            small: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/info/logo.png',
        },
    }),

    [ChainId.AVAX_MAINNET]: new Token({
        chainId: ChainId.AVAX_MAINNET,
        address: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7',
        decimals: 18,
        symbol: 'WAVAX',
        isNative: false,
        name: 'Wrapped AVAX',
        icons: {
            small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/9462.png',
            large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/9462.png',
        },
    }),
    [ChainId.AVAX_TESTNET]: new Token({
        chainId: ChainId.AVAX_TESTNET,
        address: '0xd00ae08403B9bbb9124bB305C09058E32C39A48c',
        decimals: 18,
        symbol: 'WAVAX',
        isNative: false,
        name: 'Wrapped AVAX',
        icons: {
            small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/9462.png',
            large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/9462.png',
        },
    }),
    [ChainId.HECO_MAINNET]: new Token({
        chainId: ChainId.HECO_MAINNET,
        address: '0x5545153ccfca01fbd7dd11c0b23ba694d9509a6f',
        decimals: 18,
        symbol: 'WHT',
        isNative: false,
        name: 'Wrapped HT',
        icons: {
            small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/8524.png',
            large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/8524.png',
        },
    }),
    [ChainId.HECO_TESTNET]: new Token({
        chainId: ChainId.HECO_TESTNET,
        address: '0x7aF326B6351C8A9b8fb8CD205CBe11d4Ac5FA836',
        decimals: 18,
        symbol: 'WHT',
        isNative: false,
        name: 'Wrapped HT',
        icons: {
            small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/8524.png',
            large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/8524.png',
        },
    }),
    [ChainId.OKEX_MAINNET]: new Token({
        chainId: ChainId.OKEX_MAINNET,
        address: '0x8F8526dbfd6E38E3D8307702cA8469Bae6C56C15',
        decimals: 18,
        symbol: 'WOKT',
        isNative: false,
        name: 'Wrapped OKT',
        icons: {
            small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/11132.png',
            large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/11132.png',
        },
    }),
    [ChainId.OKEX_TESTNET]: new Token({
        chainId: ChainId.OKEX_TESTNET,
        address: '0x2219845942d28716c0F7C605765fABDcA1a7d9E0',
        decimals: 18,
        symbol: 'WOKT',
        isNative: false,
        name: 'Wrapped OKT',
        icons: {
            small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/11132.png',
            large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/11132.png',
        },
    }),
    [ChainId.BOBA_MAINNET]: new Token({
        chainId: ChainId.BOBA_MAINNET,
        address: '0xDeadDeAddeAddEAddeadDEaDDEAdDeaDDeAD0000',
        decimals: 18,
        symbol: 'WETH',
        isNative: false,
        name: 'Wrapped ETH',
        icons: {
            large: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png',
            small: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png',
        },
    }),
    [ChainId.BOBA_AVALANCHE]: new Token({
        chainId: ChainId.BOBA_AVALANCHE,
        address: '0x26c319B7B2cF823365414d082698C8ac90cbBA63',
        decimals: 18,
        symbol: 'WBOBA',
        isNative: false,
        name: 'Wrapped BOBA',
        icons: {
            large: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png',
            small: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png',
        },
    }),
    [ChainId.BOBA_BNB]: new Token({
        chainId: ChainId.BOBA_BNB,
        address: '0xC58aaD327D6D58D979882601ba8DDa0685B505eA',
        decimals: 18,
        symbol: 'WBOBA',
        isNative: false,
        name: 'Wrapped BOBA',
        icons: {
            large: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png',
            small: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png',
        },
    }),
    [ChainId.BOBA_RINKEBY]: new Token({
        chainId: ChainId.BOBA_RINKEBY,
        address: '0xDeadDeAddeAddEAddeadDEaDDEAdDeaDDeAD0000',
        decimals: 18,
        symbol: 'WETH',
        isNative: false,
        name: 'Wrapped ETH',
        icons: {
            large: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png',
            small: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png',
        },
    }),
    [ChainId.MILKOMEDA_MAINNET]: new Token({
        chainId: ChainId.MILKOMEDA_MAINNET,
        address: '0xAE83571000aF4499798d1e3b0fA0070EB3A3E3F9',
        decimals: 18,
        symbol: 'WADA',
        isNative: false,
        name: 'Wrapped ADA',
        icons: {
            large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/19369.png',
            small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/19369.png',
        },
    }),
    [ChainId.MILKOMEDA_DEVNET]: new Token({
        chainId: ChainId.MILKOMEDA_DEVNET,
        // address: '0x65a51E52eCD17B641f8F0D1d56a6c9738951FDC9',
        address: '0x01bbbb9c97fc43e3393e860fc8bbead47b6960db',
        decimals: 18,
        symbol: 'WTADA',
        isNative: false,
        name: 'Wrapped TADA',
        icons: {
            large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/19369.png',
            small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/19369.png',
        },
    }),
    [ChainId.AURORA_MAINNET]: new Token({
        chainId: ChainId.AURORA_MAINNET,
        address: '0xC9BdeEd33CD01541e1eeD10f90519d2C06Fe3feB',
        decimals: 18,
        symbol: 'WETH',
        isNative: false,
        name: 'Wrapped ETH',
        icons: {
            large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/2396.png',
            small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/2396.png',
        },
    }),
    [ChainId.AURORA_TESTNET]: new Token({
        chainId: ChainId.AURORA_TESTNET,
        address: '0x1b6A3d5B5DCdF7a37CFE35CeBC0C4bD28eA7e946',
        decimals: 18,
        symbol: 'WETH',
        isNative: false,
        name: 'Wrapped ETH',
        icons: {
            large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/2396.png',
            small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/2396.png',
        },
    }),
    [ChainId.TELOS_MAINNET]: new Token({
        chainId: ChainId.TELOS_MAINNET,
        address: '0xD102cE6A4dB07D247fcc28F366A623Df0938CA9E',
        decimals: 18,
        symbol: 'WTLOS',
        isNative: false,
        name: 'Wrapped TLOS',
        icons: {
            large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/18580.png',
            small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/18580.png',
        },
    }),
    [ChainId.TELOS_TESTNET]: new Token({
        chainId: ChainId.TELOS_TESTNET,
        address: '0xaE85Bf723A9e74d6c663dd226996AC1b8d075AA9',
        decimals: 18,
        symbol: 'WTLOS',
        isNative: false,
        name: 'Wrapped TLOS',
        icons: {
            large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/18580.png',
            small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/18580.png',
        },
    }),
    [ChainId.SHARDEUM_TESTNET_2]: new Token({
        chainId: ChainId.SHARDEUM_TESTNET_2,
        address: '0xb6204c4b6b2545cF23F5EC0Bf8AEB8cB56E13C15',
        decimals: 18,
        symbol: 'WSHM',
        isNative: false,
        name: 'Wrapped SHM',
        icons: {
            large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/22353.png',
            small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/22353.png',
        },
    }),
}
