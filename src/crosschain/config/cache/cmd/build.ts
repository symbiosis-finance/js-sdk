import { Builder } from '../builder'
import { ConfigName } from '../../../symbiosis'

const ENVS: ConfigName[] = ['mainnet', 'testnet', 'dev', 'bridge']

;(async () => {
    for (let i = 0; i < ENVS.length; i++) {
        const env = ENVS[i]
        console.log(`start building config for env:${env}`)
        await new Builder(env).build()
        console.log(`env ${env} was rebuilt`)
    }
})()
