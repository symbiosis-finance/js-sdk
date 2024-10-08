import { Error } from './error'

export async function getFastestFee(): Promise<number> {
    const response = await fetch('https://mempool.space/api/v1/fees/recommended')
    if (!response.ok) {
        const text = await response.text()
        const json = JSON.parse(text)
        throw new Error(json.message ?? text)
    }

    const { fastestFee } = await response.json()

    return fastestFee
}
