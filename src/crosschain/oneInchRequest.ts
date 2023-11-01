import fetch from 'isomorphic-unfetch'

const ONE_INCH_API_URL = 'https://api-v2.symbiosis.finance/crosschain/v1/inch/'

export type MakeOneInchRequestFn = <T = any>(url: string, urlParams?: URLSearchParams) => Promise<T>

export async function makeOneInchRequest<T = any>(url: string, urlParams?: URLSearchParams): Promise<T> {
    const requestUrl = new URL(url, ONE_INCH_API_URL)

    if (urlParams) {
        requestUrl.search = urlParams.toString()
    }

    const response = await fetch(requestUrl.toString())

    if (!response.ok) {
        const text = await response.text()

        throw new Error(text)
    }

    const json = await response.json()

    return json
}
