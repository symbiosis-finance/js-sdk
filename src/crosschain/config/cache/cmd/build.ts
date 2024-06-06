import { Builder } from '../builder'
import { ConfigName } from '../../../symbiosis'

const env = process.env.ENV as ConfigName

;(async () => {
    console.log(`start building config for env:${env}`)
    await new Builder(env).build()
    console.log(`env ${env} was rebuilt`)
})()
