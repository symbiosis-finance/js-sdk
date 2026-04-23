/* eslint-disable */
/* tslint:disable */
// @ts-nocheck
/*
 * ---------------------------------------------------------------
 * ## THIS FILE WAS GENERATED VIA SWAGGER-TYPESCRIPT-API        ##
 * ##                                                           ##
 * ## AUTHOR: acacode                                           ##
 * ## SOURCE: https://github.com/acacode/swagger-typescript-api ##
 * ---------------------------------------------------------------
 */

export interface Swap {
    /** The input amount of `tokenIn`, in wei */
    inputAmount: string
    /** The input amount of `tokenOut`, in wei */
    outputAmount: string
    /** Estimated gas fee */
    totalGas: number
    /** Current gas price in Gwei */
    gasPriceGwei?: string
    /** Current gas price in USD */
    gasUsd: number
    /** Estimate of input value, in USD */
    amountInUsd: number
    /** Estimate of out value, in USD */
    amountOutUsd: number
    /** Estimate of final received value, in USD */
    receivedUsd: number
    /** Swap path, a 2-dimen array describe how swap is executed */
    swaps: SwapSequence[][]
    /** The encoded data to be sent to our router address */
    encodedSwapData: string
    /** The KyberSwap router address */
    routerAddress: string
}

export interface SwapSequence {
    /** The address of the pool used in our executor */
    pool: string
    /** The input token for this pool */
    tokenIn: string
    /** The output token for this pool */
    tokenOut: string
    /** The input amount swap through this pool */
    swapAmount: string
    /** The output amount after swap through this pool */
    amountOut: string
    /** The original exchange of this pool */
    exchange: string
    /** The type of this pool (internal definition by our aggregator) */
    poolType: string
    /** The pool's extra metadata */
    poolExtra: object
    /** The swap's extra data */
    extra: object
}

export interface GetRouteSuccess {
    /** Response code */
    code: number
    /** Response message */
    message?: string
    /** Response data */
    data: {
        /** The summarised routing data */
        routeSummary: {
            /** The input token for the swap */
            tokenIn: string
            /** The amount of input token for the swap in wei */
            amountIn: string
            /** Estimate of input value, in USD */
            amountInUsd: string
            /** The output token for the swap */
            tokenOut: string
            /** The amount of output token for the swap in wei */
            amountOut: string
            /** Estimate of output value, in USD */
            amountOutUsd: string
            /** Estimated gas required for swap */
            gas: string
            /** Estimated price of gas required for swap, in wei units */
            gasPrice: string
            /** Estimated USD price of gas required for swap */
            gasUsd: string
            /** Estimated USD price of L1 gas required for swap */
            l1FeeUsd: string
            /** Fee configuration for the swap */
            extraFee?: {
                /** Fee amount(s) to be collected, comma-separated */
                feeAmount?: string
                /**
                 * Indicates whether fee is charged by input token `currency_in` or output token `currency_out`.
                 * Default is empty whereby no fee is charged
                 */
                chargeFeeBy?: 'currency_in' | 'currency_out'
                /** If true, fee is taken in BPS */
                isInBps?: boolean
                /** Address(es) to which the fees will be sent, comma-separated */
                feeReceiver?: string
            }
            /** Array of swap routes */
            route: {
                /** Address of the pool which the swap has been routed to */
                pool: string
                /** The input token address for this pool */
                tokenIn: string
                /** The output token address for this pool */
                tokenOut: string
                /** The amount of input token to be swapped through this pool, in wei */
                swapAmount: string
                /** The amount of output token received through swapping through this pool, in wei */
                amountOut: string
                /** The exchange where the pool originated from */
                exchange: string
                /** The pool type as defined by our internal aggregator */
                poolType: string
                /** Additional pool metadata */
                poolExtra: object
                /** Additional swap metadata */
                extra: object
            }[][]
            /** Unique ID of this route */
            routeID: string
            /** Checksum of this route */
            checksum: string
            /** Timestamp of this route */
            timestamp: string
        }
        /** The KyberSwap router address */
        routerAddress: string
    }
    /** Request id for debug support purposes */
    requestId?: string
}

export interface BuildRouteSuccess {
    /** Response code */
    code: number
    /** Response message */
    message?: string
    /** Response data for encoded swap */
    data: {
        /** The amount of input token for the swap in wei */
        amountIn: string
        /** Estimated input value, in USD */
        amountInUsd: string
        /** The amount of output token for the swap in wei */
        amountOut: string
        /** Estimated output value, in USD */
        amountOutUsd: string
        /** Estimated gas required for swap */
        gas: string
        /** Estimated USD price of gas required for swap */
        gasUsd: string
        /** Estimated additional USD cost of required for swap, for example L1 gas cost */
        additionalCostUsd?: string
        /** Description of the additional cost */
        additionalCostMessage?: string
        /** The encoded data to be sent to KyberSwap router address */
        data: string
        /** The KyberSwap router address */
        routerAddress: string
        /** Transaction value to sendto router for swaps from native tokens */
        transactionValue: string
    }
    /** Request id for debug support purposes */
    requestId?: string
}

export interface BuildRoutePostBody {
    /** The summarised routing data as per returned from [V1] Get Swap Route */
    routeSummary: {
        /** The input token for the swap */
        tokenIn: string
        /** The amount of input token for the swap in wei */
        amountIn: string
        /** Estimate of input value, in USD */
        amountInUsd: string
        /** The output token for the swap */
        tokenOut: string
        /** The amount of output token for the swap in wei */
        amountOut: string
        /** Estimate of output value, in USD */
        amountOutUsd: string
        /** Estimated gas required for swap */
        gas: string
        /** Estimated price of gas required for swap, in wei units */
        gasPrice: string
        /** Estimated USD price of gas required for swap */
        gasUsd: string
        /** Fee configuration for the swap */
        extraFee?: {
            /** Fee amount(s) to be collected, comma-separated */
            feeAmount: string
            /**
             * Indicates whether fee is charged by input token `currency_in` or output token `currency_out`.
             * Default is empty whereby no fee is charged
             */
            chargeFeeBy?: 'currency_in' | 'currency_out'
            /** If true, fee is taken in BPS */
            isInBps?: boolean
            /** Address(es) to which the fees will be sent, comma-separated */
            feeReceiver: string
        }
        /** Array of swap routes */
        route: {
            /** Address of the pool which the swap has been routed to */
            pool: string
            /** The input token address for this pool */
            tokenIn: string
            /** The output token address for this pool */
            tokenOut: string
            /** The amount of input token to be swapped through this pool, in wei */
            swapAmount: string
            /** The amount of output token received through swapping through this pool, in wei */
            amountOut: string
            /** The exchange where the pool originated from */
            exchange: string
            /** The pool type as defined by our internal aggregator */
            poolType: string
            /** Additional pool metadata */
            poolExtra: string
            /** Additional swap metadata */
            extra: string
        }[][]
        /** Unique ID of this route */
        routeID: string
        /** Checksum of this route */
        checksum?: string
        /** Timestamp of this route */
        timestamp?: string
    }
    /** Address from which the swap input tokens will be transferred from */
    sender: string
    /** Origin address (user wallet) of the swap tx. Include this to avoid getting rate limited by liquidity sources if you use a fixed sender. */
    origin?: string
    /** Address to which the swap output tokens will be sent to */
    recipient: string
    /**
     * Encoded token's permit calldata to swap without approving.
     * The permit's spender should be the routerAddress returned in the [Get Swap Route](#get-route) API response. See /permit
     */
    permit?: string
    /** Deadline (in Unix time second) for the transaction to be executed. Default will be +20 minute. Cannot be in the past. */
    deadline?: number
    /**
     * This is the amount of slippage the user can accept for his trade. The unit is bps (1/100 of 1%).
     * The value is in ranges [0, 2000], with 10 meaning 0.1%, and 0.1 meaning 0.001%.
     * If no value is provided, slippageTolerance will be set to 0.
     */
    slippageTolerance?: number
    /** If true, the slippage tolerance can be any value. Please use with caution. */
    ignoreCappedSlippage?: boolean
    /** If true, call eth_gasEstimate to get rpc-based gas estimation for the transaction. Also helps to detect any potential reverts. */
    enableGasEstimation?: boolean
    /** The source of the swap to be recorded on-chain. You may use a different value from the `x-client-id` in the header or even have multiple values to track separate sources. */
    source?: string
    /** Referral info to include in the swap transaction's ClientData event. */
    referral?: string
}

export interface Error {
    /** The error code */
    code: number
    /** The error message */
    message: string
    /** KyberSwap's internal request identity for tracing/troubleshooting */
    requestId: string
    /** Optional object which contains the validation error, if any */
    details?: object
}

export type QueryParamsType = Record<string | number, any>
export type ResponseFormat = keyof Omit<Body, 'body' | 'bodyUsed'>

export interface FullRequestParams extends Omit<RequestInit, 'body'> {
    /** set parameter to `true` for call `securityWorker` for this request */
    secure?: boolean
    /** request path */
    path: string
    /** content type of request body */
    type?: ContentType
    /** query params */
    query?: QueryParamsType
    /** format of response (i.e. response.json() -> format: "json") */
    format?: ResponseFormat
    /** request body */
    body?: unknown
    /** base url */
    baseUrl?: string
    /** request cancellation token */
    cancelToken?: CancelToken
}

export type RequestParams = Omit<FullRequestParams, 'body' | 'method' | 'query' | 'path'>

export interface ApiConfig<SecurityDataType = unknown> {
    baseUrl?: string
    baseApiParams?: Omit<RequestParams, 'baseUrl' | 'cancelToken' | 'signal'>
    securityWorker?: (securityData: SecurityDataType | null) => Promise<RequestParams | void> | RequestParams | void
    customFetch?: typeof fetch
}

export interface HttpResponse<D extends unknown, E extends unknown = unknown> extends Response {
    data: D
    error: E
}

type CancelToken = Symbol | string | number

export enum ContentType {
    Json = 'application/json',
    JsonApi = 'application/vnd.api+json',
    FormData = 'multipart/form-data',
    UrlEncoded = 'application/x-www-form-urlencoded',
    Text = 'text/plain',
}

export class HttpClient<SecurityDataType = unknown> {
    public baseUrl: string = 'https://aggregator-api.kyberswap.com'
    private securityData: SecurityDataType | null = null
    private securityWorker?: ApiConfig<SecurityDataType>['securityWorker']
    private abortControllers = new Map<CancelToken, AbortController>()
    private customFetch = (...fetchParams: Parameters<typeof fetch>) => fetch(...fetchParams)

    private baseApiParams: RequestParams = {
        credentials: 'same-origin',
        headers: {},
        redirect: 'follow',
        referrerPolicy: 'no-referrer',
    }

    constructor(apiConfig: ApiConfig<SecurityDataType> = {}) {
        Object.assign(this, apiConfig)
    }

    public setSecurityData = (data: SecurityDataType | null) => {
        this.securityData = data
    }

    protected encodeQueryParam(key: string, value: any) {
        const encodedKey = encodeURIComponent(key)
        return `${encodedKey}=${encodeURIComponent(typeof value === 'number' ? value : `${value}`)}`
    }

    protected addQueryParam(query: QueryParamsType, key: string) {
        return this.encodeQueryParam(key, query[key])
    }

    protected addArrayQueryParam(query: QueryParamsType, key: string) {
        const value = query[key]
        return value.map((v: any) => this.encodeQueryParam(key, v)).join('&')
    }

    protected toQueryString(rawQuery?: QueryParamsType): string {
        const query = rawQuery || {}
        const keys = Object.keys(query).filter((key) => 'undefined' !== typeof query[key])
        return keys
            .map((key) =>
                Array.isArray(query[key]) ? this.addArrayQueryParam(query, key) : this.addQueryParam(query, key)
            )
            .join('&')
    }

    protected addQueryParams(rawQuery?: QueryParamsType): string {
        const queryString = this.toQueryString(rawQuery)
        return queryString ? `?${queryString}` : ''
    }

    private contentFormatters: Record<ContentType, (input: any) => any> = {
        [ContentType.Json]: (input: any) =>
            input !== null && (typeof input === 'object' || typeof input === 'string') ? JSON.stringify(input) : input,
        [ContentType.JsonApi]: (input: any) =>
            input !== null && (typeof input === 'object' || typeof input === 'string') ? JSON.stringify(input) : input,
        [ContentType.Text]: (input: any) =>
            input !== null && typeof input !== 'string' ? JSON.stringify(input) : input,
        [ContentType.FormData]: (input: any) => {
            if (input instanceof FormData) {
                return input
            }

            return Object.keys(input || {}).reduce((formData, key) => {
                const property = input[key]
                formData.append(
                    key,
                    property instanceof Blob
                        ? property
                        : typeof property === 'object' && property !== null
                          ? JSON.stringify(property)
                          : `${property}`
                )
                return formData
            }, new FormData())
        },
        [ContentType.UrlEncoded]: (input: any) => this.toQueryString(input),
    }

    protected mergeRequestParams(params1: RequestParams, params2?: RequestParams): RequestParams {
        return {
            ...this.baseApiParams,
            ...params1,
            ...(params2 || {}),
            headers: {
                ...(this.baseApiParams.headers || {}),
                ...(params1.headers || {}),
                ...((params2 && params2.headers) || {}),
            },
        }
    }

    protected createAbortSignal = (cancelToken: CancelToken): AbortSignal | undefined => {
        if (this.abortControllers.has(cancelToken)) {
            const abortController = this.abortControllers.get(cancelToken)
            if (abortController) {
                return abortController.signal
            }
            return void 0
        }

        const abortController = new AbortController()
        this.abortControllers.set(cancelToken, abortController)
        return abortController.signal
    }

    public abortRequest = (cancelToken: CancelToken) => {
        const abortController = this.abortControllers.get(cancelToken)

        if (abortController) {
            abortController.abort()
            this.abortControllers.delete(cancelToken)
        }
    }

    public request = async <T = any, E = any>({
        body,
        secure,
        path,
        type,
        query,
        format,
        baseUrl,
        cancelToken,
        ...params
    }: FullRequestParams): Promise<T> => {
        const secureParams =
            ((typeof secure === 'boolean' ? secure : this.baseApiParams.secure) &&
                this.securityWorker &&
                (await this.securityWorker(this.securityData))) ||
            {}
        const requestParams = this.mergeRequestParams(params, secureParams)
        const queryString = query && this.toQueryString(query)
        const payloadFormatter = this.contentFormatters[type || ContentType.Json]
        const responseFormat = format || requestParams.format

        return this.customFetch(`${baseUrl || this.baseUrl || ''}${path}${queryString ? `?${queryString}` : ''}`, {
            ...requestParams,
            headers: {
                ...(requestParams.headers || {}),
                ...(type && type !== ContentType.FormData ? { 'Content-Type': type } : {}),
            },
            signal: (cancelToken ? this.createAbortSignal(cancelToken) : requestParams.signal) || null,
            body: typeof body === 'undefined' || body === null ? null : payloadFormatter(body),
        }).then(async (response) => {
            const r = response as HttpResponse<T, E>
            r.data = null as unknown as T
            r.error = null as unknown as E

            const responseToParse = responseFormat ? response.clone() : response
            const data = !responseFormat
                ? r
                : await responseToParse[responseFormat]()
                      .then((data) => {
                          if (r.ok) {
                              r.data = data
                          } else {
                              r.error = data
                          }
                          return r
                      })
                      .catch((e) => {
                          r.error = e
                          return r
                      })

            if (cancelToken) {
                this.abortControllers.delete(cancelToken)
            }

            if (!response.ok) throw data
            return data.data
        })
    }
}

/**
 * @title KyberSwap Aggregator APIs
 * @version 2.12.1
 * @license Apache 2.0 (https://www.apache.org/licenses/LICENSE-2.0.html)
 * @baseUrl https://aggregator-api.kyberswap.com
 * @contact KyberSwap Support <support@kyber.network> (https://kyberswap.com)
 *
 * KyberSwap Aggregator APIs for external partners
 */
export class Api<SecurityDataType extends unknown> {
    http: HttpClient<SecurityDataType>

    constructor(http: HttpClient<SecurityDataType>) {
        this.http = http
    }

    chain = {
        /**
         * @description Retrieve the information about a Swap between 2 tokens with encoded data to submit to KyberSwap router contract. RFQ liquidity sources are not supported. Please refer to [Supported Exchanges And Networks](https://docs.kyberswap.com/getting-started/supported-exchanges-and-networks) for the full list of supported networks.
         *
         * @tags swap
         * @name GetRouteEncode
         * @summary Get Swap Info with Encoded Data
         * @request GET:/{chain}/route/encode
         */
        getRouteEncode: (
            chain: string,
            query: {
                /**
                 * Address of the input token
                 * `0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE` in case of native token
                 */
                tokenIn: string
                /**
                 * Address of the output token
                 * `0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE` in case of native token
                 */
                tokenOut: string
                /** Amount of the input token (in wei) */
                amountIn: string
                /** DEX IDs included in the route, separated by comma */
                dexes?: string
                /** Exclude unscalable sources and only use sources that accept scaling input amounts */
                onlyScalableSources?: boolean
                /** Determines whether gas costs are accounted for when searching for best route */
                gasInclude?: boolean
                /** Custom gas price in wei used when searching for the best swap route. Use result from eth_gasPrice otherwise */
                gasPrice?: string
                /**
                 * This is the amount of slippage the user can accept for his trade. The unit is bps (1/100 of 1%).
                 * The value is in ranges [0, 2000], with 10 meaning 0.1%, and 0.1 meaning 0.001%.
                 * If no value is provided, slippageTolerance will be set to 0.
                 */
                slippageTolerance?: number
                /**
                 * Indicates that the API client wants to charge fee by input token (`currency_in`) or output token (`currency_out`).
                 * Default is empty whereby no fee is charged.
                 */
                chargeFeeBy?: 'currency_in' | 'currency_out'
                /** The API client's wallet address to receive fee (if `chargeFeeBy` is not empty) */
                feeReceiver?: string
                /** if true, fee is taken in bps of the amount in/out, instead of absolute wei value */
                isInBps?: boolean
                /**
                 * Fee amount to be collected.
                 * If `isInBps` = `true`, `feeAmount` is the percentage of fees to take with base unit = 10000, i.e `feeAmount` = 10 and `isInBps` = `true` then fee = 0.1%;
                 * If `isInBps` = `false`, `feeAmount` is the amount of token to take as fee, i.e `feeAmount` = 10 and `isInBps` = 'false' then fee = 10 token weis
                 */
                feeAmount?: string
                /**
                 * Deadline (in Unix epoch second) for the transaction to be executed by. Default will be +20 minute. Cannot be in the past.
                 * @example "1744196804"
                 */
                deadline?: string
                /** Address to receive the output token */
                to: string
                /**
                 * Json string to include your client id in the source field if header cannot be used
                 * @example "{"source":"MyAwesomeApp"}"
                 */
                clientData?: string
                /** Referral info to include in the swap transaction's ClientData event. */
                referral?: string
                /**
                 * Encoded token's permit calldata to swap without approving.
                 * The permit's spender should be the routerAddress returned in the [Get Swap Route](#get-route) API response. See /permit
                 */
                permit?: string
                /** If true, the slippage tolerance can be any value. Please use with caution. */
                ignoreCappedSlippage?: boolean
            },
            params: RequestParams = {}
        ) =>
            this.http.request<Swap, any>({
                path: `/${chain}/route/encode`,
                method: 'GET',
                query: query,
                format: 'json',
                ...params,
            }),

        /**
         * @description Find the best route to swap from `tokenIn` to `tokenOut`, supporting all liquidity sources including RFQ. Use this API to get a route preview before confirming the swap. The route returned can then be combined with transaction specific params in the `POST` API payload to get the encoded data for submission to the KyberSwap router contract. Refer to [Supported Exchanges And Networks](https://docs.kyberswap.com/getting-started/supported-exchanges-and-networks) for the full list of supported networks.
         *
         * @tags swap
         * @name GetRoute
         * @summary [V1] Get Swap Route
         * @request GET:/{chain}/api/v1/routes
         */
        getRoute: (
            chain: string,
            query: {
                /**
                 * Address of the input token
                 * `0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE` in case of native token
                 */
                tokenIn: string
                /**
                 * Address of the output token
                 * `0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE` in case of native token
                 */
                tokenOut: string
                /** Amount of the input token (in wei) */
                amountIn: string
                /** DEX IDs included in the route, separated by comma */
                includedSources?: string
                /** DEX IDs excluded from the route, separated by comma */
                excludedSources?: string
                /** Exclude RFQ sources */
                excludeRFQSources?: boolean
                /** Exclude unscalable sources and only use sources that accept scaling input amounts */
                onlyScalableSources?: boolean
                /** Only routes directly from tokenIn to tokenOut (without hop tokens) */
                onlyDirectPools?: boolean
                /** Determines whether to only return single-path route */
                onlySinglePath?: boolean
                /** Determines whether gas costs are accounted for when searching for best route. Defaults to true */
                gasInclude?: boolean
                /** Custom gas price in wei used when searching for the best swap route. Use result from eth_gasPrice otherwise */
                gasPrice?: string
                /**
                 * Fee amount(s) to be collected.
                 * If `isInBps` = `true`, `feeAmount` is the percentage of fees to take with base unit = 10000, i.e `feeAmount` = 10 and `isInBps` = `true` then fee = 0.1%;
                 * If `isInBps` = `false`, `feeAmount` is the amount of token to take as fee, i.e `feeAmount` = 10 and `isInBps` = 'false' then fee = 10 token weis.
                 * It also accepts a comma-separated list of numbers to support multiple fee receivers, for example: feeAmount=10,20
                 */
                feeAmount?: string
                /**
                 * Indicates that the API client wants to charge fee by input token (`currency_in`) or output token (`currency_out`).
                 * Default is empty whereby no fee is charged.
                 */
                chargeFeeBy?: 'currency_in' | 'currency_out'
                /** if true, fee is taken in bps of the amount in/out, instead of absolute wei value */
                isInBps?: boolean
                /** The API client's wallet address(es) to receive fee (if `chargeFeeBy` is not empty). It can accept a comma separated list of addresses to collect multiple fee amounts into multiple addresses */
                feeReceiver?: string
                /** The origin address (user wallet) of the swap tx. Include this to get access to exclusive pools and rates */
                origin?: string
            },
            params: RequestParams = {}
        ) =>
            this.http.request<GetRouteSuccess, Error>({
                path: `/${chain}/api/v1/routes`,
                method: 'GET',
                query: query,
                format: 'json',
                ...params,
            }),

        /**
         * @description Get the swap's calldata to be sent to the KyberSwap router contract. The request body must contain the `routeSummary` as exactly returned by [V1] Get Swap Route along with the additional tx related parameters. Please refer to [Supported Exchanges And Networks](https://docs.kyberswap.com/getting-started/supported-exchanges-and-networks) for the full list of supported networks.
         *
         * @tags swap
         * @name PostRouteEncoded
         * @summary [V1] Post Swap Route For Encoded Data
         * @request POST:/{chain}/api/v1/route/build
         */
        postRouteEncoded: (chain: string, data: BuildRoutePostBody, params: RequestParams = {}) =>
            this.http.request<BuildRouteSuccess, Error>({
                path: `/${chain}/api/v1/route/build`,
                method: 'POST',
                body: data,
                type: ContentType.Json,
                format: 'json',
                ...params,
            }),
    }
}
