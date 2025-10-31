import { ChainId } from '../../constants'
import { Config } from '../types'

export const config: Config = {
    advisor: {
        url: 'https://api.dev.symbiosis.finance/calculations',
    },
    limits: [],
    omniPools: [
        {
            chainId: 97,
            address: '0x789001A80a8EdBBEE07876b0dF58c3eAdEE89877',
            oracle: '0x2cD94CB0F4cBC4a51c3e9c4b88d03B982bE24608',
            generalPurpose: true,
            coinGeckoId: 'usd-coin',
        },
    ],
    revertableAddress: {
        [ChainId.TRON_TESTNET]: '0x1b5D6DDF6086Bb06616f58274F894099c31e9DB5',
        default: '0x1b5D6DDF6086Bb06616f58274F894099c31e9DB5',
    },
    fallbackReceiver: '0x1b5D6DDF6086Bb06616f58274F894099c31e9DB5',
    btcConfigs: [],
    chains: [
        {
            id: 97,
            rpc: 'https://bsc-testnet-rpc.publicnode.com',
            filterBlockOffset: 2000,
            stables: [],
            router: '0xD99D1c33F9fC3444f8101754aBC46c52416550D1',
            dexFee: 30,
            metaRouter: '0x87BFB71bBd221a57826489DD247EB103a0cc7482',
            metaRouterGateway: '0x27022ad33b09f49BEE2dCC482F4604FD2560A862',
            bridge: '0x9708C5b89F9B166c080B8F5BBcDEC27D5Fa92eE8',
            synthesis: '0xD67940D8414E09F84eBEa85cd021dbc011A94Bc8',
            portal: '0x0000000000000000000000000000000000000000',
            fabric: '0x167C52B035D7cfA2D8199A2Af450B3493C51576C',
            multicallRouter: '0xF77c766DEB09f424228Be0b679E3F8326b9d7741',
        },
    ],
}
