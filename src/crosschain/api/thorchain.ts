import { Api, HttpClient } from './thorchain.generated'

export * from './thorchain.generated'

const httpClient = new HttpClient({
    baseApiParams: {
        headers: {
            'x-client-id': 'symbiosis',
        },
    },
})

export const thorchainApi = new Api(httpClient)
