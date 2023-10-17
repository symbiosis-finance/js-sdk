import JSBI from 'jsbi'
import invariant from 'tiny-invariant'
import { ChainId, Icons, SolidityType, TokenConstructor } from '../constants'
import { isTronChainId, tronAddressToEvm } from '../crosschain/tron'
import { validateAndParseAddress, validateSolidityTypeInstance } from '../utils'
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
    public readonly userToken?: boolean
    public readonly deprecated: boolean

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
        this.isNative = !!params.isNative
        this.icons = params.icons
        this.chainFromId = params.chainFromId
        this.userToken = params.userToken
        this.deprecated = !!params.deprecated

        if (isTronChainId(params.chainId)) {
            this.address = tronAddressToEvm(params.address)
            return
        }

        this.address = validateAndParseAddress(params.address)
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
    [ChainId.TRON_MAINNET]: new Token({
        chainId: ChainId.TRON_MAINNET,
        address: '0x891CDB91D149F23B1A45D9C5CA78A88D0CB44C18',
        decimals: 6,
        symbol: 'WTRX',
        isNative: false,
        name: 'Wrapped TRX',
        icons: {
            small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1958.png',
            large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1958.png',
        },
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
            large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/14556.png',
            small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/14556.png',
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
            large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/14556.png',
            small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/14556.png',
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
    [ChainId.KAVA_MAINNET]: new Token({
        chainId: ChainId.KAVA_MAINNET,
        address: '0xc86c7C0eFbd6A49B35E8714C5f59D99De09A225b',
        decimals: 18,
        symbol: 'WKAVA',
        isNative: false,
        name: 'Wrapped KAVA',
        icons: {
            small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/4846.png',
            large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/4846.png',
        },
    }),
    [ChainId.SCROLL_TESTNET]: new Token({
        chainId: ChainId.SCROLL_TESTNET,
        address: '0xa1EA0B2354F5A344110af2b6AD68e75545009a03',
        decimals: 18,
        symbol: 'WETH',
        isNative: false,
        name: 'Wrapped ETH',
        icons: {
            small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1027.png',
            large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1027.png',
        },
    }),
    [ChainId.SCROLL_SEPOLIA]: new Token({
        chainId: ChainId.SCROLL_SEPOLIA,
        address: '0x5300000000000000000000000000000000000004',
        decimals: 18,
        symbol: 'WETH',
        isNative: false,
        name: 'Wrapped ETH',
        icons: {
            small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1027.png',
            large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1027.png',
        },
    }),
    [ChainId.ZKSYNC_MAINNET]: new Token({
        chainId: ChainId.ZKSYNC_MAINNET,
        address: '0x5aea5775959fbc2557cc8789bc1bf90a239d9a91',
        decimals: 18,
        symbol: 'WETH',
        isNative: false,
        name: 'Wrapped ETH',
        icons: {
            small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1027.png',
            large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1027.png',
        },
    }),
    [ChainId.ARBITRUM_MAINNET]: new Token({
        chainId: ChainId.ARBITRUM_MAINNET,
        address: '0x82af49447d8a07e3bd95bd0d56f35241523fbab1',
        decimals: 18,
        symbol: 'WETH',
        isNative: false,
        name: 'Wrapped ETH',
        icons: {
            small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1027.png',
            large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1027.png',
        },
    }),
    [ChainId.ARBITRUM_NOVA]: new Token({
        chainId: ChainId.ARBITRUM_NOVA,
        address: '0x722e8bdd2ce80a4422e880164f2079488e115365',
        decimals: 18,
        symbol: 'WETH',
        isNative: false,
        name: 'Wrapped ETH',
        icons: {
            small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1027.png',
            large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1027.png',
        },
    }),
    [ChainId.OPTIMISM_MAINNET]: new Token({
        chainId: ChainId.OPTIMISM_MAINNET,
        address: '0x4200000000000000000000000000000000000006',
        decimals: 18,
        symbol: 'WETH',
        isNative: false,
        name: 'Wrapped ETH',
        icons: {
            small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1027.png',
            large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1027.png',
        },
    }),
    [ChainId.ZETACHAIN_ATHENS_2]: new Token({
        chainId: ChainId.ZETACHAIN_ATHENS_2,
        address: '0x5F0b1a82749cb4E2278EC87F8BF6B618dC71a8bf',
        decimals: 18,
        symbol: 'WZETA',
        isNative: false,
        name: 'Wrapped ZETA',
        icons: {
            small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/21259.png',
            large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/21259.png',
        },
    }),
    [ChainId.POLYGON_ZK]: new Token({
        chainId: ChainId.POLYGON_ZK,
        address: '0x4f9a0e7fd2bf6067db6994cf12e4495df938e6e9',
        decimals: 18,
        symbol: 'WETH',
        isNative: false,
        name: 'Wrapped ETH',
        icons: {
            small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1027.png',
            large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1027.png',
        },
    }),
    [ChainId.TRON_TESTNET]: new Token({
        chainId: ChainId.TRON_TESTNET,
        address: '0xf060b2655346cf3f825c3300177dff8a2acd89aa',
        decimals: 6,
        symbol: 'WTRX',
        isNative: false,
        name: 'Wrapped TRX',
        icons: {
            small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1958.png',
            large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1958.png',
        },
    }),
    [ChainId.LINEA_TESTNET]: new Token({
        chainId: ChainId.LINEA_TESTNET,
        address: '0x2C1b868d6596a18e32E61B901E4060C872647b6C',
        decimals: 18,
        symbol: 'WETH',
        isNative: false,
        name: 'Wrapped ETH',
        icons: {
            small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1027.png',
            large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1027.png',
        },
    }),
    [ChainId.LINEA_MAINNET]: new Token({
        chainId: ChainId.LINEA_MAINNET,
        address: '0xe5D7C2a44FfDDf6b295A15c148167daaAf5Cf34f',
        decimals: 18,
        symbol: 'WETH',
        isNative: false,
        name: 'Wrapped ETH',
        icons: {
            small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1027.png',
            large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1027.png',
        },
    }),
    [ChainId.MANTLE_MAINNET]: new Token({
        chainId: ChainId.MANTLE_MAINNET,
        address: '0x78c1b0C915c4FAA5FffA6CAbf0219DA63d7f4cb8',
        decimals: 18,
        symbol: 'WMNT',
        isNative: false,
        name: 'Wrapped MNT',
        icons: {
            small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/27075.png',
            large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/27075.png',
        },
    }),
    [ChainId.MANTLE_TESTNET]: new Token({
        chainId: ChainId.MANTLE_TESTNET,
        address: '0x8734110e5e1dcF439c7F549db740E546fea82d66',
        decimals: 18,
        symbol: 'WBIT',
        isNative: false,
        name: 'Wrapped BIT',
        icons: {
            small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/27075.png',
            large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/27075.png',
        },
    }),
    [ChainId.BASE_MAINNET]: new Token({
        chainId: ChainId.BASE_MAINNET,
        address: '0x4200000000000000000000000000000000000006',
        decimals: 18,
        symbol: 'WETH',
        isNative: false,
        name: 'Wrapped ETH',
        icons: {
            small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1027.png',
            large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1027.png',
        },
    }),
    [ChainId.SCROLL_MAINNET]: new Token({
        chainId: ChainId.SCROLL_MAINNET,
        address: '0x5300000000000000000000000000000000000004',
        decimals: 18,
        symbol: 'WETH',
        isNative: false,
        name: 'Wrapped ETH',
        icons: {
            small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1027.png',
            large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1027.png',
        },
    }),
}
