import { Api, HttpClient } from './kyberswap.generated'

export * from './kyberswap.generated'

const httpClient = new HttpClient({
    baseApiParams: {
        headers: {
            'x-client-id': 'symbiosis',
        },
    },
})

export const kyberSwapApi = new Api(httpClient)
