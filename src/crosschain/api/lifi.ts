import { Api, HttpClient } from './lifi.generated'

export * from './lifi.generated'

const httpClient = new HttpClient()

export const lifiApi = new Api(httpClient)
