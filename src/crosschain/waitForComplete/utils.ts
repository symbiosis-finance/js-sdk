import { DEFAULT_EXCEED_DELAY, POLLING_INTERVAL } from './constants'

export const fetchData = async (url: URL) => {
    const response = await fetch(url)
    if (!response.ok) {
        const text = await response.text()
        const json = JSON.parse(text)
        throw new Error(json.message ?? text)
    }

    return response.json()
}

interface LongPollingParams<T> {
    pollingInterval?: number
    exceedDelay?: number
    pollingFunction: () => Promise<T | undefined>
    successCondition: (result: T) => boolean
    error?: Error
    abortSignal?: AbortSignal
}

export async function longPolling<T>({
    pollingInterval = POLLING_INTERVAL,
    exceedDelay = DEFAULT_EXCEED_DELAY,
    pollingFunction,
    successCondition,
    error,
    abortSignal,
}: LongPollingParams<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        let pastTime = 0
        let result: T | undefined

        const maybeCleanupOnAbort = () => {
            if (!abortSignal) {
                return false
            }
            if (!abortSignal.aborted) {
                return false
            }
            clearInterval(interval)
            reject(error ?? new Error('Long polling aborted'))
            return true
        }

        const func = async () => {
            if (maybeCleanupOnAbort()) {
                return
            }

            pastTime += pollingInterval
            if (pastTime > exceedDelay) {
                clearInterval(interval)
                reject(error ?? new Error(`Long polling exceed time`))
                return
            }

            try {
                result = await pollingFunction()
            } catch (error) {
                // suppress error and try again until timeout
                console.error('Long Polling function error', error)
            } finally {
                if (result && successCondition(result)) {
                    if (abortSignal?.aborted) {
                        clearInterval(interval)
                        reject(error ?? new Error('Long polling aborted'))
                    } else {
                        resolve(result)
                        clearInterval(interval)
                    }
                }
            }
        }

        func()
        const interval = setInterval(func, pollingInterval)

        if (abortSignal) {
            if (abortSignal.aborted) {
                maybeCleanupOnAbort()
                return
            }

            abortSignal.addEventListener(
                'abort',
                () => {
                    maybeCleanupOnAbort()
                },
                { once: true }
            )
        }
    })
}
