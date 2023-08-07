import { Builder } from '../builder'

new Builder('mainnet').build().then(() => {
    console.log('mainnet ok')

    new Builder('testnet').build().then(() => {
        console.log('testnet ok')

        new Builder('dev').build().then(() => {
            console.log('dev ok')
        })
    })
})
