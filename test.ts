import { Symbiosis } from './src'
import { CacheBuilder } from './src/crosschain/config/cacheBuilder'

const s = new Symbiosis('mainnet', '')
const cache = new CacheBuilder(s)

cache.loadTokenPairs().then((r: any) => {
    console.log({ r })
})
