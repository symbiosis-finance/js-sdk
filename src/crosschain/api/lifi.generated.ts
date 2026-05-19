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

export enum PossibilitiesTopicEnum {
  Chains = "chains",
  Tokens = "tokens",
  Bridges = "bridges",
  Exchanges = "exchanges",
}

export enum LIFuelStatusStateEnum {
  NOT_FOUND = "NOT_FOUND",
  PENDING = "PENDING",
  DONE = "DONE",
}

export interface UnavailableRoutes {
  /** An object containing information about routes that were intentionally filtered out. */
  filteredOut?: {
    /**
     * The complete representation of the attempted route.
     * @example "100:USDC-hop-137:USDC-137:USDC~137:SUSHI"
     */
    overallPath?: string;
    /** Out best attempt at describing the failure. */
    reason?: string;
  }[];
  /** An object containing information about failed routes. */
  failed?: {
    /**
     * The complete representation of the attempted route.
     * @example "100:USDC-hop-137:USDC-137:USDC~137:SUSHI"
     */
    overallPath?: string;
    /** An object with all subpaths that generated one or more errors */
    subpaths?: Record<string, ToolError>;
  }[];
}

export interface TxInfo {
  /** @example "0x74546ce8aac58d33c212474293dcfeeadecef115847da75131a2ff6692e03b96" */
  txHash?: string;
  /** @example "https://polygonscan.com/tx/0x74546ce8aac58d33c212474293dcfeeadecef115847da75131a2ff6692e03b96" */
  txLink?: string;
  /**
   * The amount of token that will be / has been relayed
   * @example "10000"
   */
  amount?: string;
  /** Representation of a Token */
  token?: Token;
  /** @example 137 */
  chainId?: number;
  /** @example 39397739 */
  block?: number;
}

export interface LIFuelStatus {
  status?: LIFuelStatusStateEnum;
  sending?: TxInfo;
  receiving?: TxInfo;
}

export interface GasPrice {
  standard?: number;
  fast?: number;
  fastest?: number;
  lastUpdated?: number;
}

export interface Tools {
  exchanges?: Exchange[];
  bridges?: Bridge[];
}

export interface Exchange {
  /** Identifier for an exchange tool. Retrieve the latest exchange keys from the `/v1/tools` endpoint. Keywords such as `all`, `none`, `default`, and `[]` are also supported where applicable. */
  key?: ExchangesEnum;
  /**
   * The common name of the tool
   * @example "0x"
   */
  name?: string;
  /**
   * The logo of the tool
   * @example "https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/exchanges/zerox.svg"
   */
  logoURI?: string;
  /**
   * The chains which are supported on this exchange
   * @example ["1","137","56"]
   */
  supportedChains?: string;
}

export interface Bridge {
  /** Identifier for a bridge tool. Retrieve the latest bridge keys from the `/v1/tools` endpoint. Keywords such as `all`, `none`, `default`, and `[]` are also supported where applicable. */
  key?: BridgesEnum;
  /**
   * The common name of the tool
   * @example "Connext"
   */
  name?: string;
  /**
   * The logo of the tool
   * @example "https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/bridges/relay.svg"
   */
  logoURI?: string;
  supportedChains?: SupportedChains[];
}

export interface SupportedChains {
  /**
   * Supported `from` chain
   * @example 137
   */
  fromChainId?: string;
  /**
   * Supported `to` chain
   * @example 1
   */
  toChainId?: string;
}

/** Identifier for a bridge tool. Retrieve the latest bridge keys from the `/v1/tools` endpoint. Keywords such as `all`, `none`, `default`, and `[]` are also supported where applicable. */
export type BridgesEnum = string;

/** Identifier for an exchange tool. Retrieve the latest exchange keys from the `/v1/tools` endpoint. Keywords such as `all`, `none`, `default`, and `[]` are also supported where applicable. */
export type ExchangesEnum = string;

/** Bridge tool identifier or keyword. Retrieve current bridge keys from the `/v1/tools` endpoint. Supported keywords: `all`, `none`, `default`, `[]`. */
export type QuoteBridgesEnum = string;

/** Exchange tool identifier or keyword. Retrieve current exchange keys from the `/v1/tools` endpoint. Supported keywords: `all`, `none`, `default`, `[]`. */
export type QuoteExchangesEnum = string;

/**
 * Root type for ContractCallsRequest
 * Object defining instructions on how to perform multiple cross-chain/same-chain calls
 */
export interface ContractCallsRequest {
  /** The sending chain. Can be the chain id or chain key */
  fromChain: number;
  /** The token that should be transferred. Can be the address or the symbol */
  fromToken: string;
  /** The wallet that will send the transaction and contains the starting token */
  fromAddress: string;
  /** The receiving chain. Can be the chain id or chain key */
  toChain: number;
  /** The token required to perform the contract interaction (can be something to stake, donate or to be used as payment) */
  toToken: string;
  /** The amount of token required by the contract interaction. The LI.FI API will try and generate a quote that guarantees at least that amount on the destination chain. */
  toAmount: string;
  contractCalls: ContractCall[];
  /** If the call fails, use this address to send the bridged tokens to. If none is specified, the sending address will be used. */
  toFallbackAddress?: string;
  /** Some contract interactions will output a token. This is the case in things like staking. Omit this parameter if no token should be returned to the user. */
  contractOutputsToken?: string;
  /**
   * The maximum allowed slippage for the transaction as a decimal value. 0.005 represents 0.5%.
   * @format double
   * @min 0
   * @max 1
   */
  slippage?: number;
  /** A string containing tracking information about the integrator of the API */
  integrator?: string;
  /** A string containing tracking information about the referrer of the integrator */
  referrer?: string;
  /** List of bridges that are allowed for this transaction. Retrieve the current catalog from the `/v1/tools` endpoint. */
  allowBridges?: string[];
  /** List of bridges that are not allowed for this transaction. Retrieve the current catalog from the `/v1/tools` endpoint. */
  denyBridges?: string[];
  /** List of bridges that should be preferred for this transaction. Retrieve the current catalog from the `/v1/tools` endpoint. */
  preferBridges?: string[];
  /** List of exchanges that are allowed for this transaction. Retrieve the current catalog from the `/v1/tools` endpoint. */
  allowExchanges?: string[];
  /** List of exchanges that are not allowed for this transaction. Retrieve the current catalog from the `/v1/tools` endpoint. */
  denyExchanges?: string[];
  /** List of exchanges that should be preferred for this transaction. Retrieve the current catalog from the `/v1/tools` endpoint. */
  preferExchanges?: string[];
  /** Whether swaps or other contract calls should be allowed as part of the destination transaction of a bridge transfer. Separate swap transactions on the destination chain are not affected by this flag. By default, parameter is `true`. */
  allowDestinationCall?: boolean;
  /**
   * The percent of the integrator's fee that is taken from every transaction. The maximum fee amount should be less than 100%.
   * @format double
   * @min 0
   * @max 1
   * @exclusiveMax true
   */
  fee?: number;
}

/**
 * Root type for ContractCallRequest
 * Object defining instructions on how to perform a cross chain call
 * @deprecated
 */
export interface ContractCallRequest {
  /** The sending chain. Can be the chain id or chain key */
  fromChain: number;
  /** The token that should be transferred. Can be the address or the symbol */
  fromToken: string;
  /** The wallet that will send the transaction and contains the starting token */
  fromAddress: string;
  /** The receiving chain. Can be the chain id or chain key */
  toChain: number;
  /** The token required to perform the contract interation (can be something to stake, donate or to be used as payment) */
  toToken: string;
  /** The amount of token required by the contract interaction. The LI.FI API will try and generate a quote that guarantees at least that amount on the destination chain. */
  toAmount: string;
  /** The address of the contract to interact with */
  toContractAddress: string;
  /** Some contract interactions will output a token. This is the case in things like staking. Omit this parameter if no token should be returned to the user. */
  contractOutputsToken?: string;
  /** The calldata to be sent to the contract for the interaction on the destination chain. */
  toContractCallData: string;
  /** The estimated gas used by the destination call. If this value is incorrect, the interaction may fail -- choose this carefully! */
  toContractGasLimit: string;
  /** If the approval address is different than the contract to call, specify that address here */
  toApprovalAddress?: string;
  /** If the call fails, use this address to send the bridged tokens to. If none is specified, the sending address will be used. */
  toFallbackAddress?: string;
  /**
   * The maximum allowed slippage for the transaction as a decimal value. 0.005 represents 0.5%.
   * @format double
   * @min 0
   * @max 1
   */
  slippage?: number;
  /** A string containing tracking information about the integrator of the API */
  integrator?: string;
  /** A string containing tracking information about the referrer of the integrator */
  referrer?: string;
  /** List of bridges that are allowed for this transaction. Retrieve the current catalog from the `/v1/tools` endpoint. */
  allowBridges?: string[];
  /** List of bridges that are not allowed for this transaction. Retrieve the current catalog from the `/v1/tools` endpoint. */
  denyBridges?: string[];
  /** List of bridges that should be preferred for this transaction. Retrieve the current catalog from the `/v1/tools` endpoint. */
  preferBridges?: string[];
  /** List of exchanges that are allowed for this transaction. Retrieve the current catalog from the `/v1/tools` endpoint. */
  allowExchanges?: string[];
  /** List of exchanges that are not allowed for this transaction. Retrieve the current catalog from the `/v1/tools` endpoint. */
  denyExchanges?: string[];
  /** List of exchanges that should be preferred for this transaction. Retrieve the current catalog from the `/v1/tools` endpoint. */
  preferExchanges?: string[];
  /**
   * The percent of the integrator's fee that is taken from every transaction. The maximum fee amount should be less than 100%.
   * @format double
   * @min 0
   * @max 1
   * @exclusiveMax true
   */
  fee?: number;
  /** Whether swaps or other contract calls should be allowed as part of the destination transaction of a bridge transfer. Separate swap transactions on the destination chain are not affected by this flag. By default, parameter is `true`. */
  allowDestinationCall?: boolean;
}

/**
 * Root Type for PossibilitiesRequest
 * Object defining preferences regarding chain, exchanges and bridges
 * @example {"chains":[100,137],"bridges":{"allow":["relay","hop"],"deny":["cbridge"],"prefer":["relay"]},"exchanges":{"allow":["1inch","paraswap","openocean"],"deny":["0x"],"prefer":["1inch"]}}
 */
export interface PossibilitiesRequest {
  /** The ids of the chains that should be taken into consideration for the possibilities */
  chains?: number[];
  /** Object configuring the bridges that should or should not be taken into consideration for the possibilities */
  bridges?: {
    allow?: BridgesEnum[];
    deny?: BridgesEnum[];
    prefer?: BridgesEnum[];
  };
  /** Object configuring the exchanges that should or should not be taken into consideration for the possibilities */
  exchanges?: {
    allow?: ExchangesEnum[];
    deny?: ExchangesEnum[];
    prefer?: ExchangesEnum[];
  };
  /**
   * To reduce the size of the returned possibilities, you can select which kind of information you like to see.
   * Possible values are `chains`, `tokens`, `bridges`, and `exchanges`.
   */
  include?: PossibilitiesTopicEnum[];
}

/**
 * Root Type for Chain
 * Representation of a chain
 * @example {"key":"pol","name":"Polygon","coin":"MATIC","id":137,"mainnet":true,"logoURI":"https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/polygon.svg","tokenlistUrl":"https://unpkg.com/quickswap-default-token-list@1.0.71/build/quickswap-default.tokenlist.json","faucetUrls":["https://stakely.io/faucet/polygon-matic"],"metamask":{"chainId":"0x89","blockExplorerUrls":["https://polygonscan.com/","https://explorer-mainnet.maticvigil.com/"],"chainName":"Matic(Polygon) Mainnet","nativeCurrency":{"name":"MATIC","symbol":"MATIC","decimals":18},"rpcUrls":["https://polygon-rpc.com/","https://polygon.llamarpc.com/"]}}
 */
export interface Chain {
  /** Short string represenation of the chain */
  key: string;
  /** Type of the chain */
  chainType?: string;
  /** Name of the chain */
  name: string;
  /** The native coin of the chain */
  coin: string;
  /**
   * Unique id of the chain
   * @format number
   */
  id: number;
  /** Whether the chain is mainnet or not */
  mainnet: boolean;
  /** Logo of the chain */
  logoURI?: string;
  /** Url to the list of available tokens */
  tokenlistUrl?: string;
  /** List of available faucets */
  faucetUrls?: string[];
  /** The multicall contract address */
  multicallAddress?: string;
  /** Information about the chain from metamask. Contains data about RPCs and block explorers */
  metamask?: {
    chainId?: string;
    blockExplorerUrls?: string[];
    chainName?: string;
    nativeCurrency?: {
      name?: string;
      symbol?: string;
      /** @format number */
      decimals?: number;
    };
    rpcUrls?: string[];
  };
  /** The native token info for the chain */
  nativeToken?: Token;
}

/**
 * Root Type for Token
 * Representation of a Token
 * @example {"address":"0x8f3cf7ad23cd3cadbd9735aff958023239c6a063","symbol":"DAI","decimals":18,"chainId":137,"name":"(PoS) Dai Stablecoin","coinKey":"DAI","priceUSD":"1","logoURI":"https://static.debank.com/image/matic_token/logo_url/0x8f3cf7ad23cd3cadbd9735aff958023239c6a063/549c4205dbb199f1b8b03af783f35e71.png"}
 */
export interface Token {
  /** Address of the token */
  address: string;
  /**
   * Number of decimals the token uses
   * @format number
   */
  decimals: number;
  /** Symbol of the token */
  symbol: string;
  /**
   * Id of the token's chain
   * @format number
   */
  chainId: number;
  /** Identifier for the token */
  coinKey?: string;
  /** Name of the token */
  name: string;
  /** Logo of the token */
  logoURI?: string;
  /** Token price in USD */
  priceUSD?: string;
}

/**
 * Root Type for BaseToken
 * Minimal token representation returned by the connections endpoint
 * @example {"address":"0x8f3cf7ad23cd3cadbd9735aff958023239c6a063","chainId":137}
 */
export interface BaseToken {
  /** Address of the token */
  address: string;
  /**
   * Id of the token's chain
   * @format number
   */
  chainId: number;
}

/**
 * Root Type for PossibilitiesResponse
 * Object listing current possibilities for any-to-any cross-chain-swaps based on the provided preferences
 * @deprecated
 * @example {"chains":[{"key":"pol","name":"Polygon","coin":"MATIC","id":137,"mainnet":true,"logoURI":"https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/polygon.svg","tokenlistUrl":"https://unpkg.com/quickswap-default-token-list@1.0.71/build/quickswap-default.tokenlist.json","faucetUrls":["https://stakely.io/faucet/polygon-matic"],"metamask":{"chainId":"0x89","blockExplorerUrls":["https://polygonscan.com/","https://explorer-mainnet.maticvigil.com/"],"chainName":"Matic(Polygon) Mainnet","nativeCurrency":{"name":"MATIC","symbol":"MATIC","decimals":18},"rpcUrls":["https://polygon-rpc.com/","https://polygon.llamarpc.com/"]}}],"tokens":[{"address":"0x6a023ccd1ff6f2045c3309768ead9e68f978f6e1","decimals":18,"symbol":"ETH","chainId":100,"coinKey":"ETH","name":"ETH","logoURI":"https://static.debank.com/image/xdai_token/logo_url/0x6a023ccd1ff6f2045c3309768ead9e68f978f6e1/61844453e63cf81301f845d7864236f6.png","priceUSD":"2254.1"},{"address":"0x7122d7661c4564b7c6cd4878b06766489a6028a2","decimals":18,"symbol":"MATIC","chainId":100,"coinKey":"MATIC","name":"MATIC","logoURI":"https://etherscan.io/token/images/matictoken_28.png","priceUSD":"0"},{"address":"0xca8d20f3e0144a72c6b5d576e9bd3fd8557e2b04","decimals":18,"symbol":"BNB","chainId":100,"coinKey":"BNB","name":"BNB","logoURI":"https://assets.coingecko.com/coins/images/825/small/binance-coin-logo.png?1547034615","priceUSD":"0"}],"exchanges":[{"tool":"paraswap","chains":[1,56,137,43114,3,4,42]},{"tool":"1inch","chains":[1,56,137,10,43114,100]}],"bridges":[{"tool":"relay","fromChainId":100,"fromToken":{"address":"0x6a023ccd1ff6f2045c3309768ead9e68f978f6e1","decimals":18,"symbol":"ETH","chainId":100,"coinKey":"ETH","name":"ETH","logoURI":"https://static.debank.com/image/xdai_token/logo_url/0x6a023ccd1ff6f2045c3309768ead9e68f978f6e1/61844453e63cf81301f845d7864236f6.png","priceUSD":"2254.1"},"toChainId":137,"toToken":{"address":"0x7ceb23fd6bc0add59e62ac25578270cff1b9f619","decimals":18,"symbol":"ETH","chainId":137,"coinKey":"ETH","name":"ETH","logoURI":"https://static.debank.com/image/matic_token/logo_url/0x7ceb23fd6bc0add59e62ac25578270cff1b9f619/61844453e63cf81301f845d7864236f6.png","priceUSD":"2254.1"},"maximumTransfer":"Infinity","minimumTransfer":"1","swapFeeRate":"0.005","swapFeeMinimum":"0","swapFeeMaximum":"Infinity"},{"tool":"relay","fromChainId":100,"fromToken":{"address":"0xddafbb505ad214d7b80b1f830fccc89b60fb7a83","decimals":6,"symbol":"USDC","chainId":100,"coinKey":"USDC","name":"USDC","logoURI":"https://static.debank.com/image/xdai_token/logo_url/0xddafbb505ad214d7b80b1f830fccc89b60fb7a83/adee072b10b0db7c5bd7a28dd4fbe96f.png","priceUSD":"1"},"toChainId":137,"toToken":{"address":"0x2791bca1f2de4661ed88a30c99a7a9449aa84174","decimals":6,"symbol":"USDC","chainId":137,"coinKey":"USDC","name":"USDC","logoURI":"https://static.debank.com/image/matic_token/logo_url/0x2791bca1f2de4661ed88a30c99a7a9449aa84174/adee072b10b0db7c5bd7a28dd4fbe96f.png","priceUSD":"1"},"maximumTransfer":"Infinity","minimumTransfer":"1","swapFeeRate":"0.005","swapFeeMinimum":"0","swapFeeMaximum":"Infinity"},{"tool":"relay","fromChainId":100,"fromToken":{"address":"0x4ecaba5870353805a9f068101a40e0f32ed605c6","decimals":6,"symbol":"USDT","chainId":100,"coinKey":"USDT","name":"USDT","logoURI":"https://static.debank.com/image/xdai_token/logo_url/0x4ecaba5870353805a9f068101a40e0f32ed605c6/66eadee7b7bb16b75e02b570ab8d5c01.png","priceUSD":"1"},"toChainId":137,"toToken":{"address":"0xc2132d05d31c914a87c6611c10748aeb04b58e8f","decimals":6,"symbol":"USDT","chainId":137,"coinKey":"USDT","name":"USDT","logoURI":"https://static.debank.com/image/matic_token/logo_url/0xc2132d05d31c914a87c6611c10748aeb04b58e8f/66eadee7b7bb16b75e02b570ab8d5c01.png","priceUSD":"1"},"maximumTransfer":"Infinity","minimumTransfer":"1","swapFeeRate":"0.005","swapFeeMinimum":"0","swapFeeMaximum":"Infinity"},{"tool":"hop","fromChainId":137,"fromToken":{"address":"0xc2132d05d31c914a87c6611c10748aeb04b58e8f","decimals":6,"symbol":"USDT","chainId":137,"coinKey":"USDT","name":"USDT","logoURI":"https://static.debank.com/image/matic_token/logo_url/0xc2132d05d31c914a87c6611c10748aeb04b58e8f/66eadee7b7bb16b75e02b570ab8d5c01.png","priceUSD":"1"},"toChainId":100,"toToken":{"address":"0x4ecaba5870353805a9f068101a40e0f32ed605c6","decimals":6,"symbol":"USDT","chainId":100,"coinKey":"USDT","name":"USDT","logoURI":"https://static.debank.com/image/xdai_token/logo_url/0x4ecaba5870353805a9f068101a40e0f32ed605c6/66eadee7b7bb16b75e02b570ab8d5c01.png","priceUSD":"1"},"maximumTransfer":"Infinity","minimumTransfer":"1","swapFeeRate":"0.005","swapFeeMinimum":"0","swapFeeMaximum":"Infinity"},{"tool":"hop","fromChainId":137,"fromToken":{"address":"0x2791bca1f2de4661ed88a30c99a7a9449aa84174","decimals":6,"symbol":"USDC","chainId":137,"coinKey":"USDC","name":"USDC","logoURI":"https://static.debank.com/image/matic_token/logo_url/0x2791bca1f2de4661ed88a30c99a7a9449aa84174/adee072b10b0db7c5bd7a28dd4fbe96f.png","priceUSD":"1"},"toChainId":100,"toToken":{"address":"0xddafbb505ad214d7b80b1f830fccc89b60fb7a83","decimals":6,"symbol":"USDC","chainId":100,"coinKey":"USDC","name":"USDC","logoURI":"https://static.debank.com/image/xdai_token/logo_url/0xddafbb505ad214d7b80b1f830fccc89b60fb7a83/adee072b10b0db7c5bd7a28dd4fbe96f.png","priceUSD":"1"},"maximumTransfer":"Infinity","minimumTransfer":"1","swapFeeRate":"0.005","swapFeeMinimum":"0","swapFeeMaximum":"Infinity"},{"tool":"hop","fromChainId":137,"fromToken":{"address":"0x8f3cf7ad23cd3cadbd9735aff958023239c6a063","decimals":18,"symbol":"DAI","chainId":137,"coinKey":"DAI","name":"DAI","logoURI":"https://static.debank.com/image/matic_token/logo_url/0x8f3cf7ad23cd3cadbd9735aff958023239c6a063/549c4205dbb199f1b8b03af783f35e71.png","priceUSD":"1"},"toChainId":100,"toToken":{"address":"0x0000000000000000000000000000000000000000","decimals":18,"symbol":"DAI","chainId":100,"coinKey":"DAI","name":"DAI","logoURI":"https://static.debank.com/image/xdai_token/logo_url/xdai/1207e67652b691ef3bfe04f89f4b5362.png","priceUSD":"1"},"maximumTransfer":"Infinity","minimumTransfer":"1","swapFeeRate":"0.005","swapFeeMinimum":"0","swapFeeMaximum":"Infinity"}]}
 */
export interface PossibilitiesResponse {
  /** Possible chains that can be sent from or to */
  chains: Chain[];
  /** Possible `Tokens` that can be transferred */
  tokens: Token[];
  /** Possible exchanges that can be used for transfers */
  exchanges: ExchangeDefinition[];
  /** Possible bridges that can be used for transfers */
  bridges: BridgeDefinition[];
}

/**
 * An error returned by a tool (Exchange or Bridge)
 * Describes why a certain operation (like a quote request) failed.
 */
export interface ToolError {
  /** The type of error that occurred. */
  errorType?: "NO_QUOTE";
  /** The error code. */
  code?:
    | "NO_POSSIBLE_ROUTE"
    | "INSUFFICIENT_LIQUIDITY"
    | "TOOL_TIMEOUT"
    | "UNKNOWN_ERROR"
    | "RPC_ERROR"
    | "AMOUNT_TOO_LOW"
    | "AMOUNT_TOO_HIGH"
    | "FEES_HIGHER_THAN_AMOUNT"
    | "DIFFERENT_RECIPIENT_NOT_SUPPORTED"
    | "TOOL_SPECIFIC_ERROR"
    | "CANNOT_GUARANTEE_MIN_AMOUNT"
    | "RATE_LIMIT_EXCEEDED";
  /** Object describing what happens in a `Step` */
  action?: Action;
  /** The tool that emitted the error. */
  tool?: string;
  /** A human-readable message describing the error. */
  message?: string;
}

/**
 * Root Type for RoutesResponse
 * A list of routes that can be used to realize the described transfer of tokens
 * @example {"routes":[{"id":"0x1e21fad9c26fff48b67ae2925f878e43bf81211da8b1cd9b7faa8bfd8d7ea9d9","fromChainId":100,"fromAmountUSD":"0.05","fromAmount":"1000000000000000000","fromToken":{"address":"0x63e62989d9eb2d37dfdb1f93a22f063635b07d51","symbol":"MIVA","decimals":18,"chainId":100,"name":"Minerva Wallet SuperToken","coinKey":"MIVA","priceUSD":"0.04547537276751318","logoURI":""},"toChainId":137,"toAmountUSD":"0.00","toAmount":"999500000000000000","toAmountMin":"999500000000000000","toToken":{"address":"0xc0b2983a17573660053beeed6fdb1053107cf387","symbol":"MIVA","decimals":18,"chainId":137,"name":"Minerva Wallet SuperToken","coinKey":"MIVA","priceUSD":"0","logoURI":""},"gasCostUSD":"0.00","steps":[{"id":"0x48f0a2f93b0d0a9dab992d07c46bca38516c945101e8f8e08ca42af05b9e6aa9","type":"cross","tool":"relay","action":{"fromChainId":100,"toChainId":137,"fromToken":{"address":"0x63e62989d9eb2d37dfdb1f93a22f063635b07d51","symbol":"MIVA","decimals":18,"chainId":100,"name":"Minerva Wallet SuperToken","coinKey":"MIVA","priceUSD":"0.04547537276751318","logoURI":""},"toToken":{"address":"0xc0b2983a17573660053beeed6fdb1053107cf387","symbol":"MIVA","decimals":18,"chainId":137,"name":"Minerva Wallet SuperToken","coinKey":"MIVA","priceUSD":"0","logoURI":""},"fromAmount":"1000000000000000000","slippage":0.003},"estimate":{"fromAmount":"1000000000000000000","toAmount":"999500000000000000","toAmountMin":"999500000000000000","approvalAddress":"0x115909BDcbaB21954bEb4ab65FC2aBEE9866fa93","feeCosts":[{"name":"Gas Fee","description":"Covers gas expense for sending funds to user on receiving chain.","percentage":"0","token":{"address":"0x63e62989d9eb2d37dfdb1f93a22f063635b07d51","symbol":"MIVA","decimals":18,"chainId":100,"name":"Minerva Wallet SuperToken","coinKey":"MIVA","priceUSD":"0.04547537276751318","logoURI":""},"amount":"0","amountUSD":"0.00","included":true},{"name":"Relay Fee","description":"Covers gas expense for claiming user funds on receiving chain.","percentage":"0","token":{"address":"0x63e62989d9eb2d37dfdb1f93a22f063635b07d51","symbol":"MIVA","decimals":18,"chainId":100,"name":"Minerva Wallet SuperToken","coinKey":"MIVA","priceUSD":"0.04547537276751318","logoURI":""},"amount":"0","amountUSD":"0.00"},{"name":"Router Fee","description":"Router service fee.","percentage":"0.0005","token":{"address":"0x63e62989d9eb2d37dfdb1f93a22f063635b07d51","symbol":"MIVA","decimals":18,"chainId":100,"name":"Minerva Wallet SuperToken","coinKey":"MIVA","priceUSD":"0.04547537276751318","logoURI":""},"amount":"500000000000000","amountUSD":"22737686383756.59"}],"gasCosts":[{"type":"SEND","price":"1.26","estimate":"140000","limit":"175000","amount":"176400","amountUSD":"0.00","token":{"address":"0x0000000000000000000000000000000000000000","symbol":"xDai","decimals":18,"chainId":100,"name":"xDai","coinKey":"xDai","priceUSD":"1","logoURI":"https://static.debank.com/image/xdai_token/logo_url/xdai/1207e67652b691ef3bfe04f89f4b5362.png"}}],"data":{"bid":{"user":"0x53F68B2186E4a4aB4dD976eD32de68db45BA360b","router":"0xeE2Ef40F688607CB23618d9312d62392786d13EB","initiator":"0x53F68B2186E4a4aB4dD976eD32de68db45BA360b","sendingChainId":100,"sendingAssetId":"0x63e62989d9eb2d37dfdb1f93a22f063635b07d51","amount":"1000000000000000000","receivingChainId":137,"receivingAssetId":"0xc0b2983a17573660053beeed6fdb1053107cf387","amountReceived":"999500000000000000","receivingAddress":"0x10fBFF9b9450D3A2d9d1612d6dE3726fACD8809E","transactionId":"0x48f0a2f93b0d0a9dab992d07c46bca38516c945101e8f8e08ca42af05b9e6aa9","expiry":1643364189,"callDataHash":"0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470","callTo":"0x0000000000000000000000000000000000000000","encryptedCallData":"0x","sendingChainTxManagerAddress":"0x115909BDcbaB21954bEb4ab65FC2aBEE9866fa93","receivingChainTxManagerAddress":"0x6090De2EC76eb1Dc3B5d632734415c93c44Fd113","bidExpiry":1643105290},"gasFeeInReceivingToken":"0","totalFee":"500000000000000","metaTxRelayerFee":"0","routerFee":"500000000000000"}},"integrator":"fee-demo"}]},{"id":"0xb785f52e68f8a6fb147d5e392e06f122c1a418be84bdc28de0f311b91fa5e57e","fromChainId":100,"fromAmountUSD":"0.05","fromAmount":"1000000000000000000","fromToken":{"address":"0x63e62989d9eb2d37dfdb1f93a22f063635b07d51","symbol":"MIVA","decimals":18,"chainId":100,"name":"Minerva Wallet SuperToken","coinKey":"MIVA","priceUSD":"0.04547537276751318","logoURI":""},"toChainId":137,"toAmountUSD":"0.00","toAmount":"941511949935063841","toAmountMin":"913266591437011926","toToken":{"address":"0xc0b2983a17573660053beeed6fdb1053107cf387","symbol":"MIVA","decimals":18,"chainId":137,"name":"Minerva Wallet SuperToken","coinKey":"MIVA","priceUSD":"0","logoURI":""},"gasCostUSD":"0.10","steps":[{"id":"ea5abad4-2e2a-476f-981d-797816e5cc77","type":"swap","tool":"1inch","action":{"fromChainId":100,"toChainId":100,"fromToken":{"address":"0x63e62989d9eb2d37dfdb1f93a22f063635b07d51","symbol":"MIVA","decimals":18,"chainId":100,"name":"Minerva Wallet SuperToken","coinKey":"MIVA","priceUSD":"0.04547537276751318","logoURI":""},"toToken":{"name":"Own a fraction","symbol":"FRACTION","coinKey":"FRACTION","decimals":18,"chainId":100,"logoURI":"https://assets.coingecko.com/coins/images/15099/large/fraction.png?1619691519","address":"0x2bf2ba13735160624a0feae98f6ac8f70885ea61"},"fromAmount":"1000000000000000000","slippage":0.003},"estimate":{"fromAmount":"1000000000000000000","toAmount":"809146346742","toAmountMin":"784871956340","approvalAddress":"0x1111111254fb6c44bac0bed2854e76f90643097d","feeCosts":[],"gasCosts":[{"type":"SEND","price":"1.26","estimate":"252364","limit":"315455","amount":"317979","amountUSD":"0.00","token":{"address":"0x0000000000000000000000000000000000000000","symbol":"xDai","decimals":18,"chainId":100,"name":"xDai","coinKey":"xDai","priceUSD":"1","logoURI":"https://static.debank.com/image/xdai_token/logo_url/xdai/1207e67652b691ef3bfe04f89f4b5362.png"}}],"data":{"fromToken":{"name":"Minerva Wallet SuperToken","address":"0x63e62989d9eb2d37dfdb1f93a22f063635b07d51","symbol":"MIVA","decimals":18,"logoURI":"https://minerva.digital/i/MIVA-Token_200x200.png"},"toToken":{"address":"0x2bf2ba13735160624a0feae98f6ac8f70885ea61","decimals":18,"symbol":"FRACTION","name":"Own a fraction","logoURI":"https://etherscan.io/images/main/empty-token.png","isCustom":true},"toTokenAmount":"809146346742","fromTokenAmount":"1000000000000000000","protocols":[[[{"name":"GNOSIS_HONEYSWAP","part":100,"fromTokenAddress":"0x63e62989d9eb2d37dfdb1f93a22f063635b07d51","toTokenAddress":"0x2bf2ba13735160624a0feae98f6ac8f70885ea61"}]]],"estimatedGas":252364}},"integrator":"fee-demo"},{"id":"0x85e93238e8f2f83dd5840eb748c7b9099d69e1ea227a13e7a2e949cf6a32ab7d","type":"cross","tool":"relay","action":{"fromChainId":100,"toChainId":137,"fromToken":{"name":"Own a fraction","symbol":"FRACTION","coinKey":"FRACTION","decimals":18,"chainId":100,"logoURI":"https://assets.coingecko.com/coins/images/15099/large/fraction.png?1619691519","address":"0x2bf2ba13735160624a0feae98f6ac8f70885ea61"},"toToken":{"name":"Own a fraction","symbol":"FRACTION","coinKey":"FRACTION","decimals":18,"chainId":137,"logoURI":"https://assets.coingecko.com/coins/images/15099/large/fraction.png?1619691519","address":"0xbd80cfa9d93a87d1bb895f810ea348e496611cd4"},"fromAmount":"784871956340","slippage":0.003},"estimate":{"fromAmount":"784871956340","toAmount":"784479520361","toAmountMin":"784479520361","approvalAddress":"0x115909BDcbaB21954bEb4ab65FC2aBEE9866fa93","feeCosts":[{"name":"Gas Fee","description":"Covers gas expense for sending funds to user on receiving chain.","percentage":"0","token":{"name":"Own a fraction","symbol":"FRACTION","coinKey":"FRACTION","decimals":18,"chainId":100,"logoURI":"https://assets.coingecko.com/coins/images/15099/large/fraction.png?1619691519","address":"0x2bf2ba13735160624a0feae98f6ac8f70885ea61"},"amount":"0","amountUSD":"0.00","included":true},{"name":"Relay Fee","description":"Covers gas expense for claiming user funds on receiving chain.","percentage":"0","token":{"name":"Own a fraction","symbol":"FRACTION","coinKey":"FRACTION","decimals":18,"chainId":100,"logoURI":"https://assets.coingecko.com/coins/images/15099/large/fraction.png?1619691519","address":"0x2bf2ba13735160624a0feae98f6ac8f70885ea61"},"amount":"0","amountUSD":"0.00","included":true},{"name":"Router Fee","description":"Router service fee.","percentage":"0.00050000000105749733","token":{"name":"Own a fraction","symbol":"FRACTION","coinKey":"FRACTION","decimals":18,"chainId":100,"logoURI":"https://assets.coingecko.com/coins/images/15099/large/fraction.png?1619691519","address":"0x2bf2ba13735160624a0feae98f6ac8f70885ea61"},"amount":"392435979","amountUSD":"0.00","included":true}],"gasCosts":[{"type":"SEND","price":"1.26","estimate":"140000","limit":"175000","amount":"176400","amountUSD":"0.00","token":{"address":"0x0000000000000000000000000000000000000000","symbol":"xDai","decimals":18,"chainId":100,"name":"xDai","coinKey":"xDai","priceUSD":"1","logoURI":"https://static.debank.com/image/xdai_token/logo_url/xdai/1207e67652b691ef3bfe04f89f4b5362.png"}}],"data":{"bid":{"user":"0x53F68B2186E4a4aB4dD976eD32de68db45BA360b","router":"0xeE2Ef40F688607CB23618d9312d62392786d13EB","initiator":"0x53F68B2186E4a4aB4dD976eD32de68db45BA360b","sendingChainId":100,"sendingAssetId":"0x2bf2ba13735160624a0feae98f6ac8f70885ea61","amount":"784871956340","receivingChainId":137,"receivingAssetId":"0xbd80cfa9d93a87d1bb895f810ea348e496611cd4","amountReceived":"784479520361","receivingAddress":"0x10fBFF9b9450D3A2d9d1612d6dE3726fACD8809E","transactionId":"0x85e93238e8f2f83dd5840eb748c7b9099d69e1ea227a13e7a2e949cf6a32ab7d","expiry":1643364189,"callDataHash":"0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470","callTo":"0x0000000000000000000000000000000000000000","encryptedCallData":"0x","sendingChainTxManagerAddress":"0x115909BDcbaB21954bEb4ab65FC2aBEE9866fa93","receivingChainTxManagerAddress":"0x6090De2EC76eb1Dc3B5d632734415c93c44Fd113","bidExpiry":1643105290},"gasFeeInReceivingToken":"0","totalFee":"392435979","metaTxRelayerFee":"0","routerFee":"392435979"}},"integrator":"fee-demo"},{"id":"d8686af1-c131-4566-bf4a-ef8226f9879b","type":"swap","tool":"1inch","action":{"fromChainId":137,"toChainId":137,"fromToken":{"name":"Own a fraction","symbol":"FRACTION","coinKey":"FRACTION","decimals":18,"chainId":137,"logoURI":"https://assets.coingecko.com/coins/images/15099/large/fraction.png?1619691519","address":"0xbd80cfa9d93a87d1bb895f810ea348e496611cd4"},"toToken":{"address":"0xc0b2983a17573660053beeed6fdb1053107cf387","symbol":"MIVA","decimals":18,"chainId":137,"name":"Minerva Wallet SuperToken","coinKey":"MIVA","priceUSD":"0","logoURI":""},"fromAmount":"784479520361","slippage":0.003},"estimate":{"fromAmount":"784479520361","toAmount":"941511949935063841","toAmountMin":"913266591437011926","approvalAddress":"0x1111111254fb6c44bac0bed2854e76f90643097d","feeCosts":[],"gasCosts":[{"type":"SEND","price":"129","estimate":"549386","limit":"686733","amount":"70870794","amountUSD":"0.10","token":{"address":"0x0000000000000000000000000000000000000000","symbol":"MATIC","decimals":18,"chainId":137,"name":"MATIC","coinKey":"MATIC","priceUSD":"1.469213","logoURI":"https://static.debank.com/image/matic_token/logo_url/matic/e5a8a2860ba5cf740a474dcab796dc63.png"}}],"data":{"fromToken":{"address":"0xbd80cfa9d93a87d1bb895f810ea348e496611cd4","decimals":18,"symbol":"FRACTION","name":"Own a fraction","logoURI":"https://etherscan.io/images/main/empty-token.png","isCustom":true},"toToken":{"address":"0xc0b2983a17573660053beeed6fdb1053107cf387","decimals":18,"symbol":"MIVA","name":"Minerva Wallet SuperToken","logoURI":"https://etherscan.io/images/main/empty-token.png","isCustom":true},"toTokenAmount":"941511949935063841","fromTokenAmount":"784479520361","protocols":[[[{"name":"POLYGON_QUICKSWAP","part":100,"fromTokenAddress":"0xbd80cfa9d93a87d1bb895f810ea348e496611cd4","toTokenAddress":"0x7ceb23fd6bc0add59e62ac25578270cff1b9f619"}],[{"name":"POLYDEX_FINANCE","part":100,"fromTokenAddress":"0x7ceb23fd6bc0add59e62ac25578270cff1b9f619","toTokenAddress":"0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"}],[{"name":"POLYGON_QUICKSWAP","part":100,"fromTokenAddress":"0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee","toTokenAddress":"0xc0b2983a17573660053beeed6fdb1053107cf387"}]]],"estimatedGas":549386}},"integrator":"fee-demo"}]}],"errors":[{"errorType":"NO_QUOTE","code":"NO_POSSIBLE_ROUTE","action":{"fromChainId":42161,"toChainId":42161,"fromToken":{"address":"0xff970a61a04b1ca14834a43f5de4533ebddb5cc8","decimals":6,"symbol":"USDC","coinKey":"USDC","chainId":42161,"name":"USDC","logoURI":"http://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png\",","priceUSD":"1.001"},"toToken":{"address":"0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9","decimals":6,"symbol":"USDT","coinKey":"USDT","chainId":42161,"name":"Tether USD","logoURI":"http://get.celer.app/cbridge-icons/USDT.png\""},"fromAmount":"100000","slippage":0.003}}]}
 */
export interface RoutesResponse {
  /** List of possible `Routes` for the given transfer */
  routes: Route[];
  /** An object representing the routes that are unavailable for the given transfer */
  unavailableRoutes?: UnavailableRoutes[];
}

/**
 * Root Type for Route
 * A route describing a transfer form a token to another
 * @example {"id":"0x1e21fad9c26fff48b67ae2925f878e43bf81211da8b1cd9b7faa8bfd8d7ea9d9","fromChainId":100,"fromAmountUSD":"0.05","fromAmount":"1000000000000000000","fromToken":{"address":"0x63e62989d9eb2d37dfdb1f93a22f063635b07d51","symbol":"MIVA","decimals":18,"chainId":100,"name":"Minerva Wallet SuperToken","coinKey":"MIVA","priceUSD":"0.04547537276751318","logoURI":""},"toChainId":137,"toAmountUSD":"0.00","toAmount":"999500000000000000","toAmountMin":"999500000000000000","toToken":{"address":"0xc0b2983a17573660053beeed6fdb1053107cf387","symbol":"MIVA","decimals":18,"chainId":137,"name":"Minerva Wallet SuperToken","coinKey":"MIVA","priceUSD":"0","logoURI":""},"gasCostUSD":"0.00","steps":[{"id":"0x48f0a2f93b0d0a9dab992d07c46bca38516c945101e8f8e08ca42af05b9e6aa9","type":"cross","tool":"relay","action":{"fromChainId":100,"toChainId":137,"fromToken":{"address":"0x63e62989d9eb2d37dfdb1f93a22f063635b07d51","symbol":"MIVA","decimals":18,"chainId":100,"name":"Minerva Wallet SuperToken","coinKey":"MIVA","priceUSD":"0.04547537276751318","logoURI":""},"toToken":{"address":"0xc0b2983a17573660053beeed6fdb1053107cf387","symbol":"MIVA","decimals":18,"chainId":137,"name":"Minerva Wallet SuperToken","coinKey":"MIVA","priceUSD":"0","logoURI":""},"fromAmount":"1000000000000000000","slippage":0.003},"estimate":{"fromAmount":"1000000000000000000","toAmount":"999500000000000000","toAmountMin":"999500000000000000","approvalAddress":"0x115909BDcbaB21954bEb4ab65FC2aBEE9866fa93","feeCosts":[{"name":"Gas Fee","description":"Covers gas expense for sending funds to user on receiving chain.","percentage":"0","token":{"address":"0x63e62989d9eb2d37dfdb1f93a22f063635b07d51","symbol":"MIVA","decimals":18,"chainId":100,"name":"Minerva Wallet SuperToken","coinKey":"MIVA","priceUSD":"0.04547537276751318","logoURI":""},"amount":"0","amountUSD":"0.00","included":true},{"name":"Relay Fee","description":"Covers gas expense for claiming user funds on receiving chain.","percentage":"0","token":{"address":"0x63e62989d9eb2d37dfdb1f93a22f063635b07d51","symbol":"MIVA","decimals":18,"chainId":100,"name":"Minerva Wallet SuperToken","coinKey":"MIVA","priceUSD":"0.04547537276751318","logoURI":""},"amount":"0","amountUSD":"0.00","included":true},{"name":"Router Fee","description":"Router service fee.","percentage":"0.0005","token":{"address":"0x63e62989d9eb2d37dfdb1f93a22f063635b07d51","symbol":"MIVA","decimals":18,"chainId":100,"name":"Minerva Wallet SuperToken","coinKey":"MIVA","priceUSD":"0.04547537276751318","logoURI":""},"amount":"500000000000000","amountUSD":"22737686383756.59","included":true}],"gasCosts":[{"type":"SEND","price":"1.26","estimate":"140000","limit":"175000","amount":"176400","amountUSD":"0.00","token":{"address":"0x0000000000000000000000000000000000000000","symbol":"xDai","decimals":18,"chainId":100,"name":"xDai","coinKey":"xDai","priceUSD":"1","logoURI":"https://static.debank.com/image/xdai_token/logo_url/xdai/1207e67652b691ef3bfe04f89f4b5362.png"}}],"data":{"bid":{"user":"0x53F68B2186E4a4aB4dD976eD32de68db45BA360b","router":"0xeE2Ef40F688607CB23618d9312d62392786d13EB","initiator":"0x53F68B2186E4a4aB4dD976eD32de68db45BA360b","sendingChainId":100,"sendingAssetId":"0x63e62989d9eb2d37dfdb1f93a22f063635b07d51","amount":"1000000000000000000","receivingChainId":137,"receivingAssetId":"0xc0b2983a17573660053beeed6fdb1053107cf387","amountReceived":"999500000000000000","receivingAddress":"0x10fBFF9b9450D3A2d9d1612d6dE3726fACD8809E","transactionId":"0x48f0a2f93b0d0a9dab992d07c46bca38516c945101e8f8e08ca42af05b9e6aa9","expiry":1643364189,"callDataHash":"0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470","callTo":"0x0000000000000000000000000000000000000000","encryptedCallData":"0x","sendingChainTxManagerAddress":"0x115909BDcbaB21954bEb4ab65FC2aBEE9866fa93","receivingChainTxManagerAddress":"0x6090De2EC76eb1Dc3B5d632734415c93c44Fd113","bidExpiry":1643105290},"gasFeeInReceivingToken":"0","totalFee":"500000000000000","metaTxRelayerFee":"0","routerFee":"500000000000000"}},"integrator":"fee-demo"}]}
 */
export interface Route {
  /** Unique identifier of the route */
  id: string;
  /**
   * The id of the sending chain
   * @format number
   */
  fromChainId: number;
  /** The amount that should be transferred in USD */
  fromAmountUSD: string;
  /** The amount that should be transferred */
  fromAmount: string;
  /** The sending `Token` */
  fromToken: Token;
  /**
   * The id of the receiving chain
   * @format number
   */
  toChainId: number;
  /** The estimated resulting amount of the `toToken` in USD as float with two decimals */
  toAmountUSD: string;
  /** The estimated resulting amount of the `toToken` including all decimals */
  toAmount: string;
  /** The minimal resulting amount of the `toToken` including all decimals */
  toAmountMin: string;
  /** The `Token` that should be transferred to */
  toToken: Token;
  /** Aggregation of th eunderlying gas costs in USD */
  gasCostUSD?: string;
  /** The steps required to fulfill the transfer */
  steps: Step[];
  /** The sending wallet address */
  fromAddress?: string;
  /** The receiving wallet address */
  toAddress?: string;
  /** Whether a chain switch is part of the route */
  containsSwitchChain?: boolean;
}

/**
 * Root Type for RoutesRequest
 * A description of a token transfer
 * @example {"fromAddress":"0x552008c0f6870c2f77e5cC1d2eb9bdff03e30Ea0","fromChainId":100,"fromAmount":"1000000000000000000","fromTokenAddress":"0x63e62989d9eb2d37dfdb1f93a22f063635b07d51","toChainId":137,"toTokenAddress":"0xc0b2983a17573660053beeed6fdb1053107cf387","options":{"integrator":"fee-demo","slippage":0.003,"fee":0.02,"bridges":{"allow":["relay"]},"exchanges":{"allow":["1inch","openocean"]}}}
 */
export interface RoutesRequest {
  /**
   * The sending chain id
   * @format number
   */
  fromChainId: number;
  /** The amount that should be transferred including all decimals (e.g. 1000000 for 1 USDC (6 decimals)) */
  fromAmount: string;
  /** The address of the sending `Token` */
  fromTokenAddress: string;
  /**
   * The id of the receiving chain
   * @format number
   */
  toChainId: number;
  /** The address of the receiving `Token` */
  toTokenAddress: string;
  /** Optional configuration for the routes */
  options?: RouteOptions;
  /** The sending wallet address */
  fromAddress?: string;
  /** The receiving wallet address */
  toAddress?: string;
  /** The amount of the token to convert to gas on the destination side. */
  fromAmountForGas?: string;
}

/**
 * Root Type for StepRequest
 * A step object
 * @example {"id":"a8dc011a-f52d-4492-9e99-21de64b5453a","type":"swap","tool":"1inch","action":{"fromChainId":100,"toChainId":100,"fromToken":{"address":"0x0000000000000000000000000000000000000000","symbol":"xDai","decimals":18,"chainId":100,"name":"xDai","coinKey":"xDai","priceUSD":"1","logoURI":"https://static.debank.com/image/xdai_token/logo_url/xdai/1207e67652b691ef3bfe04f89f4b5362.png"},"toToken":{"name":"Minerva Wallet SuperToken","symbol":"MIVA","coinKey":"MIVA","decimals":18,"chainId":100,"logoURI":"https://minerva.digital/i/MIVA-Token_200x200.png","address":"0x63e62989d9eb2d37dfdb1f93a22f063635b07d51"},"fromAmount":"1000000000000000000","slippage":0.003,"fromAddress":"0x552008c0f6870c2f77e5cC1d2eb9bdff03e30Ea0","toAddress":"0x552008c0f6870c2f77e5cC1d2eb9bdff03e30Ea0"},"estimate":{"fromAmount":"1000000000000000000","toAmount":"21922914496086353975","toAmountMin":"21265227061203763356","approvalAddress":"0x1111111254fb6c44bac0bed2854e76f90643097d","feeCosts":[],"gasCosts":[{"type":"SEND","price":"1","estimate":"252364","limit":"315455","amount":"252364","amountUSD":"0.00","token":{"address":"0x0000000000000000000000000000000000000000","symbol":"xDai","decimals":18,"chainId":100,"name":"xDai","coinKey":"xDai","priceUSD":"1","logoURI":"https://static.debank.com/image/xdai_token/logo_url/xdai/1207e67652b691ef3bfe04f89f4b5362.png"}}],"data":{"fromToken":{"name":"xDAI","address":"0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee","symbol":"xDAI","decimals":18,"logoURI":"https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x6B175474E89094C44Da98b954EedeAC495271d0F/logo.png"},"toToken":{"name":"Minerva Wallet SuperToken","address":"0x63e62989d9eb2d37dfdb1f93a22f063635b07d51","symbol":"MIVA","decimals":18,"logoURI":"https://minerva.digital/i/MIVA-Token_200x200.png"},"toTokenAmount":"21922914496086353975","fromTokenAmount":"1000000000000000000","protocols":[[[{"name":"GNOSIS_HONEYSWAP","part":100,"fromTokenAddress":"0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee","toTokenAddress":"0x63e62989d9eb2d37dfdb1f93a22f063635b07d51"}]]],"estimatedGas":252364}},"integrator":"fee-demo"}
 */
export interface StepRequest {
  id?: string;
  type?: string;
  tool?: string;
  toolDetails?: {
    key?: string;
    name?: string;
    logoURI?: string;
  };
  action?: {
    /** @format number */
    fromChainId?: number;
    /** @format number */
    toChainId?: number;
    fromToken?: {
      address?: string;
      /** @format number */
      decimals?: number;
      symbol?: string;
      /** @format number */
      chainId?: number;
      coinKey?: string;
      name?: string;
      logoURI?: string;
    };
    toToken?: {
      address?: string;
      /** @format number */
      decimals?: number;
      symbol?: string;
      /** @format number */
      chainId?: number;
      coinKey?: string;
      name?: string;
      logoURI?: string;
    };
    fromAmount?: string;
    fromAddress?: string;
    toAddress?: string;
    /** @format number */
    slippage?: number;
  };
  estimate?: {
    fromAmount?: string;
    toAmount?: string;
    toAmountMin?: string;
    approvalAddress?: string;
    feeCosts?: {
      name?: string;
      description?: string;
      percentage?: string;
      token?: {
        address?: string;
        /** @format number */
        decimals?: number;
        symbol?: string;
        /** @format number */
        chainId?: number;
        coinKey?: string;
        name?: string;
        logoURI?: string;
      };
      amount?: string;
      amountUSD?: string;
      included?: boolean;
    }[];
    gasCosts?: {
      type?: string;
      price?: string;
      estimate?: string;
      limit?: string;
      amount?: string;
      amountUSD?: string;
      token?: {
        address?: string;
        symbol?: string;
        /** @format number */
        decimals?: number;
        /** @format number */
        chainId?: number;
        name?: string;
        coinKey?: string;
        priceUSD?: string;
        logoURI?: string;
      };
    }[];
    data?: {
      bid?: {
        user?: string;
        router?: string;
        initiator?: string;
        /** @format number */
        sendingChainId?: number;
        sendingAssetId?: string;
        amount?: string;
        /** @format number */
        receivingChainId?: number;
        receivingAssetId?: string;
        amountReceived?: string;
        receivingAddress?: string;
        transactionId?: string;
        /** @format number */
        expiry?: number;
        callDataHash?: string;
        callTo?: string;
        encryptedCallData?: string;
        sendingChainTxManagerAddress?: string;
        receivingChainTxManagerAddress?: string;
        /** @format number */
        bidExpiry?: number;
      };
      bidSignature?: string;
      gasFeeInReceivingToken?: string;
      metaTxRelayerFee?: string;
    };
  };
  integrator?: string;
  execution?: {
    status?: string;
    process?: {
      id?: string;
      /** @format number */
      startedAt?: number;
      message?: string;
      status?: string;
      txHash?: string;
      txLink?: string;
      /** @format number */
      doneAt?: number;
    }[];
  };
}

/**
 * Root Type for TokenRequest
 * The address and chain id of the requested token
 * @example {"chainId":137,"address":"0x8f3cf7ad23cd3cadbd9735aff958023239c6a063"}
 */
export interface TokenRequest {
  /**
   * Id of the chain that contains the token
   * @format number
   */
  chainId: number;
  /** Address of the token on the requested chain */
  address: string;
}

/**
 * Root Type for ContractCall
 * Object defining a single arbitrary contract call
 */
export interface ContractCall {
  /** The amount that will feed into this contract call. This is not dependent on how much was bridged or deposited before - it's the *expected* amount of token available on order to execute the call. */
  fromAmount: string;
  /** The token that will feed into this contract call. E.g. a ETH staking transaction would expect to have ETH available. */
  fromTokenAddress: string;
  /** The address of the contract to interact with. */
  toContractAddress: string;
  /** The calldata to be sent to the contract for the interaction on the destination chain. */
  toContractCallData: string;
  /** The estimated gas used by the destination call. If this value is incorrect, the interaction may fail -- choose this carefully! */
  toContractGasLimit: string;
  /** If the approval address is different thant the contract to call, specify that address here */
  toApprovalAddress?: string;
  /** If the contract outputs a token, specify its address here. (E.g. staking ETH produces stETH) */
  toTokenAddress?: string;
}

/**
 * Root Type for AllowDenyPrefer
 * Object defining which tools should be allowed, denied and preferred
 */
export interface AllowDenyPrefer {
  /** Allowed tools */
  allow?: string[];
  /** Forbidden tools */
  deny?: string[];
  /** Preferred tools */
  prefer?: string[];
}

/**
 * Root Type for Step
 * Object that represents one step of a `Route`
 * @example {"id":"0x48f0a2f93b0d0a9dab992d07c46bca38516c945101e8f8e08ca42af05b9e6aa9","type":"cross","tool":"relay","action":{"fromChainId":100,"toChainId":137,"fromToken":{"address":"0x63e62989d9eb2d37dfdb1f93a22f063635b07d51","symbol":"MIVA","decimals":18,"chainId":100,"name":"Minerva Wallet SuperToken","coinKey":"MIVA","priceUSD":"0.04547537276751318","logoURI":""},"toToken":{"address":"0xc0b2983a17573660053beeed6fdb1053107cf387","symbol":"MIVA","decimals":18,"chainId":137,"name":"Minerva Wallet SuperToken","coinKey":"MIVA","priceUSD":"0","logoURI":""},"fromAmount":"1000000000000000000","slippage":0.003},"estimate":{"fromAmount":"1000000000000000000","toAmount":"999500000000000000","toAmountMin":"999500000000000000","approvalAddress":"0x115909BDcbaB21954bEb4ab65FC2aBEE9866fa93","feeCosts":[{"name":"Gas Fee","description":"Covers gas expense for sending funds to user on receiving chain.","percentage":"0","token":{"address":"0x63e62989d9eb2d37dfdb1f93a22f063635b07d51","symbol":"MIVA","decimals":18,"chainId":100,"name":"Minerva Wallet SuperToken","coinKey":"MIVA","priceUSD":"0.04547537276751318","logoURI":""},"amount":"0","amountUSD":"0.00","included":true},{"name":"Relay Fee","description":"Covers gas expense for claiming user funds on receiving chain.","percentage":"0","token":{"address":"0x63e62989d9eb2d37dfdb1f93a22f063635b07d51","symbol":"MIVA","decimals":18,"chainId":100,"name":"Minerva Wallet SuperToken","coinKey":"MIVA","priceUSD":"0.04547537276751318","logoURI":""},"amount":"0","amountUSD":"0.00","included":true},{"name":"Router Fee","description":"Router service fee.","percentage":"0.0005","token":{"address":"0x63e62989d9eb2d37dfdb1f93a22f063635b07d51","symbol":"MIVA","decimals":18,"chainId":100,"name":"Minerva Wallet SuperToken","coinKey":"MIVA","priceUSD":"0.04547537276751318","logoURI":""},"amount":"500000000000000","amountUSD":"22737686383756.59","included":true}],"gasCosts":[{"type":"SEND","price":"1.26","estimate":"140000","limit":"175000","amount":"176400","amountUSD":"0.00","token":{"address":"0x0000000000000000000000000000000000000000","symbol":"xDai","decimals":18,"chainId":100,"name":"xDai","coinKey":"xDai","priceUSD":"1","logoURI":"https://static.debank.com/image/xdai_token/logo_url/xdai/1207e67652b691ef3bfe04f89f4b5362.png"}}],"data":{"bid":{"user":"0x53F68B2186E4a4aB4dD976eD32de68db45BA360b","router":"0xeE2Ef40F688607CB23618d9312d62392786d13EB","initiator":"0x53F68B2186E4a4aB4dD976eD32de68db45BA360b","sendingChainId":100,"sendingAssetId":"0x63e62989d9eb2d37dfdb1f93a22f063635b07d51","amount":"1000000000000000000","receivingChainId":137,"receivingAssetId":"0xc0b2983a17573660053beeed6fdb1053107cf387","amountReceived":"999500000000000000","receivingAddress":"0x10fBFF9b9450D3A2d9d1612d6dE3726fACD8809E","transactionId":"0x48f0a2f93b0d0a9dab992d07c46bca38516c945101e8f8e08ca42af05b9e6aa9","expiry":1643364189,"callDataHash":"0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470","callTo":"0x0000000000000000000000000000000000000000","encryptedCallData":"0x","sendingChainTxManagerAddress":"0x115909BDcbaB21954bEb4ab65FC2aBEE9866fa93","receivingChainTxManagerAddress":"0x6090De2EC76eb1Dc3B5d632734415c93c44Fd113","bidExpiry":1643105290},"gasFeeInReceivingToken":"0","totalFee":"500000000000000","metaTxRelayerFee":"0","routerFee":"500000000000000"}},"integrator":"fee-demo"}
 */
export interface Step {
  /** Unique identifier of the step */
  id: string;
  /** The type of the step. `swap` executes a DEX swap on a single chain, `cross` bridges assets between chains, `lifi` runs LiFi's internal multi-action logic, and `protocol` represents protocol-level actions such as fee collection or vault interactions executed inside LiFi managed contracts. */
  type: "swap" | "cross" | "lifi" | "protocol";
  /** The tool used for this step. E.g. `relay` */
  tool: string;
  /** The details of the tool used for this step. E.g. `relay` */
  toolDetails?: {
    /** The tool key */
    key?: string;
    /** The tool name */
    name?: string;
    /** The tool logo URL */
    logoURI?: string;
  };
  /** The action of the step */
  action: Action;
  /** The estimation for the step */
  estimate?: Estimate;
  /** A string containing tracking information about the integrator of the API */
  integrator?: string;
  includedSteps?: IncludedStep[];
  /** A string containing tracking information about the referrer of the integrator */
  referrer?: string;
  /** An objection containing status information about the execution */
  execution?: any;
  /** An ether.js TransactionRequest that can be triggered using a wallet provider. (https://docs.ethers.io/v5/api/providers/types/#providers-TransactionRequest) */
  transactionRequest?: any;
}

/**
 * Root Type for Internal Step
 * Object that represents one step of an `IncludedSteps` array in `Route`
 */
export interface IncludedStep {
  /** Unique identifier of the step */
  id: string;
  /** The type of the step. `swap` executes a DEX swap on a single chain, `cross` bridges assets between chains, `lifi` runs LiFi's internal multi-action logic, and `protocol` represents protocol-level actions such as fee collection or vault interactions executed inside LiFi managed contracts. */
  type: "swap" | "cross" | "lifi" | "protocol";
  /** The tool used for this step. E.g. `allbridge` */
  tool: string;
  /** The details of the tool used for this step. E.g. `allbridge` */
  toolDetails: {
    /** The tool key */
    key?: string;
    /** The tool name */
    name?: string;
    /** The tool logo URL */
    logoURI?: string;
  };
  /** Object describing what happens in a `Step` */
  action: Action;
  /** An estimate for the current transfer */
  estimate: Estimate;
}

/**
 * Root Type for Action
 * Object describing what happens in a `Step`
 * @example {"fromChainId":100,"fromAmount":"1000000000000000000","fromToken":{"address":"0x63e62989d9eb2d37dfdb1f93a22f063635b07d51","symbol":"MIVA","decimals":18,"chainId":100,"name":"Minerva Wallet SuperToken","coinKey":"MIVA","priceUSD":"0.0455272371751059","logoURI":""},"toChainId":137,"toToken":{"address":"0xc0b2983a17573660053beeed6fdb1053107cf387","symbol":"MIVA","decimals":18,"chainId":137,"name":"Minerva Wallet SuperToken","coinKey":"MIVA","priceUSD":"0","logoURI":""},"slippage":0.003}
 */
export interface Action {
  /**
   * The id of the chain where the transfer should start
   * @format number
   */
  fromChainId: number;
  /** The amount that should be transferred including all decimals */
  fromAmount: string;
  /** The sending token */
  fromToken: Token;
  /**
   * The id of the chain where the transfer should end
   * @format number
   */
  toChainId: number;
  /** The token that should be transferred to */
  toToken: Token;
  /**
   * The maximum allowed slippage
   * @format double
   */
  slippage?: number;
  /** The sending wallet address */
  fromAddress?: string;
  /** The receiving wallet address */
  toAddress?: string;
}

/**
 * Root Type for FeeCost
 * Fees included in the transfer
 * @example {"name":"Gas Fee","description":"Covers gas expense for sending funds to user on receiving chain.","percentage":"0","token":{"address":"0x63e62989d9eb2d37dfdb1f93a22f063635b07d51","symbol":"MIVA","decimals":18,"chainId":100,"name":"Minerva Wallet SuperToken","coinKey":"MIVA","priceUSD":"0.0455272371751059","logoURI":""},"amount":"0","amountUSD":"0.00"}
 */
export interface FeeCost {
  /** Name of the fee */
  name: string;
  /** Description of the fee costs */
  description?: string;
  /** Percentage of how much fees are taken */
  percentage: string;
  /** The `Token` in which the fees are taken */
  token: Token;
  /** The amount of fees */
  amount?: string;
  /** The amount of fees in USD */
  amountUSD: string;
  /** Whether fee is included into transfer's `fromAmount` */
  included: boolean;
}

/**
 * Root Type for GasCost
 * Gas costs included in the transfer
 * @example {"type":"SEND","price":"1.22","estimate":"140000","limit":"175000","amount":"170800","amountUSD":"0.00","token":{"address":"0x0000000000000000000000000000000000000000","symbol":"xDai","decimals":18,"chainId":100,"name":"xDai","coinKey":"xDai","priceUSD":"1","logoURI":"https://static.debank.com/image/xdai_token/logo_url/xdai/1207e67652b691ef3bfe04f89f4b5362.png"}}
 */
export interface GasCost {
  /** Can be one of `SUM`, `APPROVE` or `SEND` */
  type: string;
  /** Suggested current standard price for the chain */
  price?: string;
  /** Estimation how much gas will be needed */
  estimate?: string;
  /** Suggested gas limit */
  limit?: string;
  /** Amount of the gas cost */
  amount: string;
  /** Amount of the gas cost in USD */
  amountUSD?: string;
  /** The used gas token */
  token: Token;
}

/**
 * Root Type for Estimate
 * An estimate for the current transfer
 * @example {"fromAmount":"1000000000000000000","toAmount":"999500000000000000","toAmountMin":"999500000000000000","tool":"allbridge","executionDuration":60,"approvalAddress":"0x115909BDcbaB21954bEb4ab65FC2aBEE9866fa93","feeCosts":[{"name":"Gas Fee","description":"Covers gas expense for sending funds to user on receiving chain.","percentage":"0","token":{"address":"0x63e62989d9eb2d37dfdb1f93a22f063635b07d51","symbol":"MIVA","decimals":18,"chainId":100,"name":"Minerva Wallet SuperToken","coinKey":"MIVA","priceUSD":"0.0455272371751059","logoURI":""},"amount":"0","amountUSD":"0.00","included":true},{"name":"Relay Fee","description":"Covers gas expense for claiming user funds on receiving chain.","percentage":"0","token":{"address":"0x63e62989d9eb2d37dfdb1f93a22f063635b07d51","symbol":"MIVA","decimals":18,"chainId":100,"name":"Minerva Wallet SuperToken","coinKey":"MIVA","priceUSD":"0.0455272371751059","logoURI":""},"amount":"0","amountUSD":"0.00","included":true},{"name":"Router Fee","description":"Router service fee.","percentage":"0.0005","token":{"address":"0x63e62989d9eb2d37dfdb1f93a22f063635b07d51","symbol":"MIVA","decimals":18,"chainId":100,"name":"Minerva Wallet SuperToken","coinKey":"MIVA","priceUSD":"0.0455272371751059","logoURI":""},"amount":"500000000000000","amountUSD":"22763618587552.95","included":true}],"gasCosts":[{"type":"SEND","price":"1.22","estimate":"140000","limit":"175000","amount":"170800","amountUSD":"0.00","token":{"address":"0x0000000000000000000000000000000000000000","symbol":"xDai","decimals":18,"chainId":100,"name":"xDai","coinKey":"xDai","priceUSD":"1","logoURI":"https://static.debank.com/image/xdai_token/logo_url/xdai/1207e67652b691ef3bfe04f89f4b5362.png"}}],"data":{"bid":{"user":"0x10fBFF9b9450D3A2d9d1612d6dE3726fACD8809E","router":"0xeE2Ef40F688607CB23618d9312d62392786d13EB","initiator":"0x10fBFF9b9450D3A2d9d1612d6dE3726fACD8809E","sendingChainId":100,"sendingAssetId":"0x63e62989d9eb2d37dfdb1f93a22f063635b07d51","amount":"1000000000000000000","receivingChainId":137,"receivingAssetId":"0xc0b2983a17573660053beeed6fdb1053107cf387","amountReceived":"999500000000000000","receivingAddress":"0x10fBFF9b9450D3A2d9d1612d6dE3726fACD8809E","transactionId":"0x9f54c1764e19367c44706f4a6253941b81e9ec524af5590091aa8ae67e7644ed","expiry":1643369368,"callDataHash":"0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470","callTo":"0x0000000000000000000000000000000000000000","encryptedCallData":"0x","sendingChainTxManagerAddress":"0x115909BDcbaB21954bEb4ab65FC2aBEE9866fa93","receivingChainTxManagerAddress":"0x6090De2EC76eb1Dc3B5d632734415c93c44Fd113","bidExpiry":1643110469},"gasFeeInReceivingToken":"0","totalFee":"500000000000000","metaTxRelayerFee":"0","routerFee":"500000000000000"}}
 */
export interface Estimate {
  /** The tools that is being used for this step */
  tool: string;
  /** The amount that should be transferred including all decimals */
  fromAmount: string;
  /** The amount that should be transferred in USD equivalent */
  fromAmountUSD?: string;
  /** The estimated resulting amount of the `toToken` including all decimals */
  toAmount: string;
  /** The minimal outcome of the transfer including all decimals */
  toAmountMin: string;
  /** The estimated resulting amount of the `toToken` in USD equivalent */
  toAmountUSD?: string;
  /** The contract address for the approval */
  approvalAddress: string;
  /** Fees included in the transfer */
  feeCosts?: FeeCost[];
  /** Gas costs included in the transfer */
  gasCosts?: GasCost[];
  /** The time needed to complete the following step */
  executionDuration: number;
  /** Arbitrary data that depends on the the used tool */
  data?: {
    bid?: {
      user?: string;
      router?: string;
      initiator?: string;
      /** @format number */
      sendingChainId?: number;
      sendingAssetId?: string;
      amount?: string;
      /** @format number */
      receivingChainId?: number;
      receivingAssetId?: string;
      amountReceived?: string;
      receivingAddress?: string;
      transactionId?: string;
      /** @format number */
      expiry?: number;
      callDataHash?: string;
      callTo?: string;
      encryptedCallData?: string;
      sendingChainTxManagerAddress?: string;
      receivingChainTxManagerAddress?: string;
      /** @format number */
      bidExpiry?: number;
    };
    bidSignature?: string;
    gasFeeInReceivingToken?: string;
    totalFee?: string;
    metaTxRelayerFee?: string;
    routerFee?: string;
  };
}

/**
 * Root Type for RouteOptions
 * Optional settings for the route
 * @example {"integrator":"fee-demo","slippage":0.003,"fee":0.02,"bridges":{"allow":["relay"]},"exchanges":{"allow":["1inch","openocean"]},"maxPriceImpact":0.1}
 */
export interface RouteOptions {
  /**
   * Facilitates transfer insurance via insurace.io, ensuring secure and insured transfer of assets.
   * @deprecated
   */
  insurance?: boolean;
  /** Custom string the developer who integrates LiFi can set */
  integrator?: string;
  /**
   * The maximum allowed slippage
   * @format double
   */
  slippage?: number;
  /** Object configuring the bridges that should or should not be taken into consideration for the possibilities */
  bridges?: {
    /** @default ["all"] */
    allow?: string[];
    deny?: string[];
    prefer?: string[];
  };
  /** Object configuring the exchanges that should or should not be taken into consideration for the possibilities */
  exchanges?: {
    /** @default ["all"] */
    allow?: string[];
    deny?: string[];
    prefer?: string[];
  };
  /** The way the resulting routes should be ordered */
  order?: "FASTEST" | "CHEAPEST";
  /**
   * Whether chain switches should be allowed in the routes
   * @default false
   */
  allowSwitchChain?: boolean;
  /**
   * Defines if we should return routes with a cross-chain bridge protocol (Connext, etc.) destination calls or not.
   * @default true
   */
  allowDestinationCall?: boolean;
  /** Integrators can set a wallet address as referrer to track them */
  referrer?: string;
  /**
   * The percent of the integrator's fee that is taken from every transaction. The maximum fee amount should be less than 100%.
   * @format double
   * @min 0
   * @max 1
   * @exclusiveMax true
   */
  fee?: number;
  /**
   * The price impact threshold above which routes are hidden. As an example, one should specify 0.15 (15%) to hide routes with more than 15% price impact. The default is 10%.
   * @format double
   */
  maxPriceImpact?: number;
  timing?: {
    /** Timing setting to wait for a certain amount of swap rates. Please check [docs.li.fi](https://docs.li.fi) for more details. */
    swapStepTimingStrategies?: {
      strategy?: "minWaitTime";
      /**
       * @min 0
       * @max 15000
       */
      minWaitTimeMs?: number;
      /**
       * @min 0
       * @max 100
       */
      startingExpectedResults?: number;
      /**
       * @min 0
       * @max 15000
       */
      reduceEveryMs?: number;
    }[];
    /** Timing setting to wait for a certain amount of routes to be generated before choosing the best one. Please check [docs.li.fi](https://docs.li.fi) for more details. */
    routeTimingStrategies?: {
      strategy?: "minWaitTime";
      /**
       * @min 0
       * @max 15000
       */
      minWaitTimeMs?: number;
      /**
       * @min 0
       * @max 100
       */
      startingExpectedResults?: number;
      /**
       * @min 0
       * @max 15000
       */
      reduceEveryMs?: number;
    }[];
  };
  /**
   * Pre-configured routing and quote optimization preset. The preset value `stablecoin` is supported for requesting swap and/or bridging operations involving stablecoin tokens. Each preset provides optimized default settings for slippage, price impact, and tool preferences that can be overridden by custom configuration options specified in the same request.
   * @minLength 1
   * @maxLength 50
   * @pattern ^[a-zA-Z0-9-_]+$
   * @example "stablecoin"
   */
  preset?: string;
  /** Priority fee level for Solana Virtual Machine (SVM) transactions. */
  svmPriorityFeeLevel?: "NORMAL" | "FAST" | "ULTRA";
}

/**
 * Root Type for BridgeDefinition
 * The definition of a bridge with the transferrable token pair
 * @example {"tool":"relay","fromChainId":100,"fromToken":{"address":"0x6a023ccd1ff6f2045c3309768ead9e68f978f6e1","decimals":18,"symbol":"ETH","chainId":100,"coinKey":"ETH","name":"ETH","logoURI":"https://static.debank.com/image/xdai_token/logo_url/0x6a023ccd1ff6f2045c3309768ead9e68f978f6e1/61844453e63cf81301f845d7864236f6.png","priceUSD":"2426.47"},"toChainId":137,"toToken":{"address":"0x7ceb23fd6bc0add59e62ac25578270cff1b9f619","decimals":18,"symbol":"ETH","chainId":137,"coinKey":"ETH","name":"ETH","logoURI":"https://static.debank.com/image/matic_token/logo_url/0x7ceb23fd6bc0add59e62ac25578270cff1b9f619/61844453e63cf81301f845d7864236f6.png","priceUSD":"2426.47"},"maximumTransfer":"Infinity","minimumTransfer":"1","swapFeeRate":"0.005","swapFeeMinimum":"0","swapFeeMaximum":"Infinity"}
 */
export interface BridgeDefinition {
  /** Identifier for a bridge tool. Retrieve the latest bridge keys from the `/v1/tools` endpoint. Keywords such as `all`, `none`, `default`, and `[]` are also supported where applicable. */
  tool: BridgesEnum;
  /**
   * From which chain transfers can happen
   * @format number
   */
  fromChainId: number;
  /** Which `Token` can be sent */
  fromToken: {
    address?: string;
    /** @format number */
    decimals?: number;
    symbol?: string;
    /** @format number */
    chainId?: number;
    coinKey?: string;
    name?: string;
    logoURI?: string;
    priceUSD?: string;
  };
  /**
   * To which chain transfers can happen
   * @format number
   */
  toChainId: number;
  /** The `Token` that can be transferred to */
  toToken: {
    address?: string;
    /** @format number */
    decimals?: number;
    symbol?: string;
    /** @format number */
    chainId?: number;
    coinKey?: string;
    name?: string;
    logoURI?: string;
    priceUSD?: string;
  };
  /** The maximum amount that can be sent in one transfer */
  maximumTransfer: string;
  /** The minimum amount that can be sent in one transfer */
  minimumTransfer: string;
  /** The rate taken for swap fees */
  swapFeeRate: string;
  /** The minimum swap fees that will be taken */
  swapFeeMinimum: string;
  /** The maximum swap fees that might occur */
  swapFeeMaximum: string;
}

/**
 * Root Type for BridgeDefinition
 * The defintion of an exchange with the avaiable chains
 * @example {"tool":"1inch","chains":[1,56,137,10,43114,100]}
 */
export interface ExchangeDefinition {
  /** The exchange tool */
  tool: "1inch" | "paraswap" | "openocean" | "0x";
  /** The available chains for this tool */
  chains: number[];
}

/**
 * Root Type for BasicTransaction
 * A basic transaction object
 * @example {"txHash":"0xd3ad8fb8798d8440f3a1ec7fd51e102a88e4690f9365fad4eff1a17020376b4a","txLink":"https://polygonscan.com/tx/0xd3ad8fb8798d8440f3a1ec7fd51e102a88e4690f9365fad4eff1a17020376b4a","amount":"13000000","token":{"address":"0xd69b31c3225728cc57ddaf9be532a4ee1620be51","symbol":"anyUSDC","decimals":6,"chainId":137,"name":"USDC","coinKey":"anyUSDC","priceUSD":"0","logoURI":""},"chainId":137}
 */
export interface BasicTransaction {
  /** The hash of the transaction */
  txHash: string;
  /** Link to a block explorer showing the transaction */
  txLink: string;
  /** The amount of the transaction */
  amount: string;
  /** Information about the token */
  token: Token;
  /** The id of the chain */
  chainId: number;
}

/**
 * Root Type for TransactionInfo
 * A transaction info object
 * @example {"txHash":"0xd3ad8fb8798d8440f3a1ec7fd51e102a88e4690f9365fad4eff1a17020376b4a","txLink":"https://polygonscan.com/tx/0xd3ad8fb8798d8440f3a1ec7fd51e102a88e4690f9365fad4eff1a17020376b4a","amount":"13000000","token":{"address":"0xd69b31c3225728cc57ddaf9be532a4ee1620be51","symbol":"anyUSDC","decimals":6,"chainId":137,"name":"USDC","coinKey":"anyUSDC","priceUSD":"0","logoURI":""},"gasToken":{"address":"0x0000000000000000000000000000000000001010","symbol":"MATIC","decimals":18,"chainId":137,"name":"MATIC","coinKey":"MATIC","priceUSD":"0","logoURI":""},"chainId":137,"gasAmount":"10000","gasAmountUSD":"0.0","gasPrice":"1000","gasUsed":"1000","timestamp":1720545119,"value":"0"}
 */
export interface TransactionInfo {
  /** The hash of the transaction */
  txHash: string;
  /** Link to a block explorer showing the transaction */
  txLink: string;
  /** The amount of the transaction */
  amount: string;
  /** Information about the token */
  token: Token;
  /** The id of the chain */
  chainId: number;
  /** The token in which gas was paid */
  gasToken?: Token;
  /** The amount of the gas that was paid */
  gasAmount?: string;
  /** The amount of the gas that was paid in USD */
  gasAmountUSD?: string;
  /** The price of the gas */
  gasPrice?: string;
  /** The amount of the gas that was used */
  gasUsed?: string;
  /** The transaction timestamp */
  timestamp?: number;
  /** The transaction value */
  value?: string;
  /** An array of swap or protocol steps included in the LI.FI transaction */
  includedSteps?: IncludedSwapSteps[];
}

/**
 * Root type for Transaction Metadata
 * The metadata of the transaction which includes integrator data, etc.
 */
export interface Metadata {
  /** Integrator ID */
  integrator?: string;
}

/**
 * Root type for included swaps or protocol steps in the status response
 * The included steps contain tool name and details, sending and receiving token data and amounts.
 */
export interface IncludedSwapSteps {
  /** The tool used for this step */
  tool?: string;
  /** The details of the tool used for this step. E.g. `1inch` or `feeProtocol` */
  toolDetails?: {
    /** The tool key */
    key?: string;
    /** The tool name */
    name?: string;
    /** The tool logo URL */
    logoURI?: string;
  };
  /** The amount that was sent to the tool */
  fromAmount?: string;
  /** The token that was sent to the tool */
  fromToken?: string;
  /** The amount that was received from the tool */
  toAmount?: string;
  /** The token that was received from the tool */
  toToken?: string;
  /** The amount that was sent to the bridge */
  bridgedAmount?: string;
}

/**
 * Root Type for StatusResponse
 * The current status of a transfer
 * @example {"sending":{"txHash":"0xd3ad8fb8798d8440f3a1ec7fd51e102a88e4690f9365fad4eff1a17020376b4a","txLink":"https://polygonscan.com/tx/0xd3ad8fb8798d8440f3a1ec7fd51e102a88e4690f9365fad4eff1a17020376b4a","amount":"13000000","token":{"address":"0xd69b31c3225728cc57ddaf9be532a4ee1620be51","symbol":"anyUSDC","decimals":6,"chainId":137,"name":"USDC","coinKey":"anyUSDC","priceUSD":"0","logoURI":""},"chainId":137,"gasToken":{"address":"0x0000000000000000000000000000000000001010","symbol":"MATIC","decimals":18,"chainId":137,"name":"MATIC","coinKey":"MATIC","priceUSD":"0","logoURI":""},"gasAmount":"10000","gasAmountUSD":"0.0","gasPrice":"1000","gasUsed":"1000","timestamp":1720545119,"value":"0"},"receiving":{"txHash":"0xba2793065e20835ef60993144d92e6bc1a86529a70e16c357f66ad13774868ad","txLink":"https://bscscan.com/tx/0xba2793065e20835ef60993144d92e6bc1a86529a70e16c357f66ad13774868ad","amount":"12100000000000000000","token":{"address":"0x8965349fb649a33a30cbfda057d8ec2c48abe2a2","symbol":"anyUSDC","decimals":18,"chainId":56,"name":"USDC","coinKey":"anyUSDC","priceUSD":"0","logoURI":""},"chainId":56,"gasToken":{"address":"0x0000000000000000000000000000000000001010","symbol":"BNB","decimals":18,"chainId":56,"name":"BNB","coinKey":"BNB","priceUSD":"0","logoURI":""},"gasAmount":"10000","gasAmountUSD":"0.0","gasPrice":"1000","gasUsed":"1000","timestamp":1720560232,"value":"0"},"tool":"anyswap","status":"DONE","substatus":"COMPLETED","substatusMessage":"The transfer is complete.","transactionId":"0x0000000000000000000000000000000000001010","fromAddress":"0x0000000000000000000000000000000000001010","toAddress":"0x0000000000000000000000000000000000001010","lifiExplorerLink":"https://scan.li.fi/tx/0xd3ad8fb8798d8440f3a1ec7fd51e102a88e4690f9365fad4eff1a17020376b4a","metadata":{"integrator":"jumper.exchange"}}
 */
export interface StatusResponse {
  /** The transaction on the sending chain */
  sending: TransactionInfo;
  /** The transaction on the receiving chain */
  receiving?: TransactionInfo;
  /** An array of fee costs for the transaction */
  feeCosts?: {
    name?: string;
    description?: string;
    percentage?: string;
    token?: {
      address?: string;
      /** @format number */
      decimals?: number;
      symbol?: string;
      /** @format number */
      chainId?: number;
      coinKey?: string;
      name?: string;
      logoURI?: string;
    };
    amount?: string;
    amountUSD?: string;
    included?: boolean;
  }[];
  /** The current status of the transfer. Can be `PENDING`, `DONE`, `NOT_FOUND` or `FAILED` */
  status: "NOT_FOUND" | "INVALID" | "PENDING" | "DONE" | "FAILED";
  /** A more specific substatus. This is available for PENDING and DONE statuses. More information can be found here: https://docs.li.fi/introduction/user-flows-and-examples/status-tracking */
  substatus?:
    | "WAIT_SOURCE_CONFIRMATIONS"
    | "WAIT_DESTINATION_TRANSACTION"
    | "BRIDGE_NOT_AVAILABLE"
    | "CHAIN_NOT_AVAILABLE"
    | "REFUND_IN_PROGRESS"
    | "UNKNOWN_ERROR"
    | "COMPLETED"
    | "PARTIAL"
    | "REFUNDED";
  /** A message that describes the substatus */
  substatusMessage?: string;
  /** The tool used for this transfer */
  tool: string;
  /** The ID of this transfer (NOT a transaction hash). */
  transactionId?: string;
  /** The address of the sender. */
  fromAddress?: string;
  /** The address of the receiver. */
  toAddress?: string;
  /** The link to the LI.FI explorer. */
  lifiExplorerLink?: string;
  /** The transaction metadata which includes integrator's string, etc. */
  metadata?: Metadata;
}

/**
 * Root Type for IntegratorResponse
 * Integrator's fee balance by chain
 * @example {"integratorId":"fee-demo","feeBalances":[{"chainId":137,"tokenBalances":[{"token":{"address":"0x0000000000000000000000000000000000000000","symbol":"MATIC","decimals":18,"chainId":137,"name":"MATIC","coinKey":"MATIC","priceUSD":"0.742896","logoURI":"https://static.debank.com/image/matic_token/logo_url/matic/6f5a6b6f0732a7a235131bd7804d357c.png"},"amount":0,"amountUsd":0}]}]}
 */
export interface IntegratorResponse {
  /** The integrator's name or wallet address */
  integratorId: string;
  /** The fee balances of the integrator */
  feeBalances?: FeeBalances[];
}

export interface FeeBalances {
  /**
   * The id of the chain
   * @example 137
   */
  chainId?: number;
  tokenBalances?: TokenBalances[];
}

export interface TokenBalances {
  /** Representation of a Token */
  token?: Token;
  /**
   * Fee amount in tokens
   * @example "0"
   */
  amount?: string;
  /**
   * Fee amount in USD
   * @example "0"
   */
  amountUsd?: string;
}

/**
 * Root Type for IntegratorWithdrawalResponse
 * Transaction request for withdrawing integrator's collected fees for the specified chain
 */
export interface IntegratorWithdrawalResponse {
  /** The transaction request */
  transactionRequest: {
    /** The transaction's data */
    data?: string;
    /** The FeeCollector's contract address for the specified chain */
    to?: string;
  };
}

/**
 * Root Type for ChainsResponse
 * @example {"chains":[{"key":"eth","name":"Ethereum","coin":"ETH","id":1,"mainnet":true,"chainType":"EVM","logoURI":"https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/ethereum.svg","tokenlistUrl":"https://gateway.ipfs.io/ipns/tokens.uniswap.org","multicallAddress":"0xcA11bde05977b3631167028862bE2a173976CA11","diamondAddress":"0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE","metamask":{"chainId":"0x1","blockExplorerUrls":["https://etherscan.io/"],"chainName":"Ethereum Mainnet","nativeCurrency":{"name":"ETH","symbol":"ETH","decimals":18},"rpcUrls":["https://mainnet.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161"]},"nativeToken":{"address":"0x0000000000000000000000000000000000000000","decimals":18,"symbol":"ETH","chainId":1,"coinKey":"ETH","name":"ETH","logoURI":"https://static.debank.com/image/token/logo_url/eth/935ae4e4d1d12d59a99717a24f2540b5.png","priceUSD":"2582.35"}},{"key":"pol","name":"Polygon","coin":"MATIC","id":137,"mainnet":true,"logoURI":"https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/polygon.svg","tokenlistUrl":"https://unpkg.com/quickswap-default-token-list@1.0.71/build/quickswap-default.tokenlist.json","faucetUrls":["https://stakely.io/faucet/polygon-matic"],"metamask":{"chainId":"0x89","blockExplorerUrls":["https://polygonscan.com/","https://explorer-mainnet.maticvigil.com/"],"chainName":"Matic(Polygon) Mainnet","nativeCurrency":{"name":"MATIC","symbol":"MATIC","decimals":18},"rpcUrls":["https://polygon-rpc.com/","https://polygon.llamarpc.com/"]}},{"key":"bsc","name":"BSC","coin":"BNB","id":56,"mainnet":true,"logoURI":"https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/bsc.svg","tokenlistUrl":"https://tokens.pancakeswap.finance/pancakeswap-extended.json","faucetUrls":["https://stakely.io/faucet/bsc-chain-bnb"],"metamask":{"chainId":"0x38","blockExplorerUrls":["https://bscscan.com/"],"chainName":"Binance Smart Chain Mainnet","nativeCurrency":{"name":"BNB","symbol":"BNB","decimals":18},"rpcUrls":["https://bsc-dataseed.binance.org/","https://bsc-dataseed1.defibit.io/","https://bsc-dataseed1.ninicoin.io/"]}},{"key":"dai","name":"Gnosis","coin":"DAI","id":100,"mainnet":true,"logoURI":"https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/gnosis.svg","tokenlistUrl":"https://tokens.honeyswap.org/","faucetUrls":["https://stakely.io/faucet/xdai-chain"],"metamask":{"chainId":"0x64","blockExplorerUrls":["https://blockscout.com/xdai/mainnet/"],"chainName":"Gnosis Chain","nativeCurrency":{"name":"xDai","symbol":"xDai","decimals":18},"rpcUrls":["https://rpc.gnosischain.com/","https://rpc.xdaichain.com/","https://dai.poa.network/"]}}]}
 */
export interface ChainsResponse {
  chains?: Chain[];
}

/**
 * Root Type for ConnectionsResponse
 * @example {"connections":[{"fromChainId":137,"toChainId":1,"fromTokens":[{"address":"0x8f3cf7ad23cd3cadbd9735aff958023239c6a063","chainId":137}],"toTokens":[{"address":"0x6b175474e89094c44da98b954eedeac495271d0f","chainId":1},{"address":"0x0000000000000000000000000000000000000000","chainId":1}]}]}
 */
export interface ConnectionsResponse {
  /** The possible connections */
  connections?: Connection[];
}

/**
 * Root Type for Connection
 * A connection from one chain to another defined by tokens that can be exchanged for another.
 * @example {"connections":[{"fromChainId":137,"toChainId":1,"fromTokens":[{"address":"0x8f3cf7ad23cd3cadbd9735aff958023239c6a063","chainId":137}],"toTokens":[{"address":"0x6b175474e89094c44da98b954eedeac495271d0f","chainId":1},{"address":"0x0000000000000000000000000000000000000000","chainId":1}]},{"fromChainId":137,"toChainId":10,"fromTokens":[{"address":"0x8f3cf7ad23cd3cadbd9735aff958023239c6a063","chainId":137}],"toTokens":[{"address":"0xda10009cbd5d07dd0cecc66161fc93d7c9000da1","chainId":10},{"address":"0x0000000000000000000000000000000000000000","chainId":10}]},{"fromChainId":137,"toChainId":56,"fromTokens":[{"address":"0x8f3cf7ad23cd3cadbd9735aff958023239c6a063","chainId":137}],"toTokens":[{"address":"0x1af3f329e8be154074d8769d1ffa4ee058b1dbc3","chainId":56},{"address":"0x2170ed0880ac9a755fd29b2688956bd959f933f8","chainId":56}]}]}
 */
export interface Connection {
  /** The sending chain */
  fromChainId: number;
  /** The receiving chain */
  toChainId: number;
  /** List of possible tokens that can be sent */
  fromTokens: BaseToken[];
  /** List of tokens that can be received */
  toTokens: BaseToken[];
}

/** Transfer */
export interface TransferResult {
  transfers?: StatusResponse[];
}

/**
 * Transfers Summary
 * Transfers summary element as returned by GET /v1/analytics/transfers/summary endpoint
 */
export interface TransfersSummaryResult {
  id?: {
    /** The address in the receiving side of the transfer */
    toAddress?: string;
    /** The ID of the chain the transfer was sent from */
    sendingChainId?: number;
  };
  /** The cumulative amount of token received */
  totalReceivedAmount?: number;
}

/**
 * Pagination Query Parameters
 * Parameters used to query paginated endpoints
 */
export interface PaginatedResult {
  /**
   * Flag indicating if there is a next page
   * @default false
   */
  hasNext?: boolean;
  /**
   * Flag indicating if there is a previous page
   * @default false
   */
  hasPrevious?: boolean;
  /** Cursor for fetching the next page. Should be passed to `next` in the pagination query. */
  next?: string | null;
  /** Cursor for fetching the previous page. Should be passed to `previous` in the pagination query. */
  previous?: string | null;
  /** An array containing the paginated data returned by the endpoint  */
  data?: any;
}

/**
 * Root Type for RelayTransactionStatus
 * Status details of a relay transaction
 * @example {"status":"DONE","message":"All done","metadata":{"chainId":137,"txHash":"0x1425098ed5ecc5192070ac32a69dd924268b9df5e7a69764142473e9d022321a"},"transactionStatus":{"transactionId":"0xaddfdf22eeacd02f006e04bbb58f683394807664f62e150b078db0598ab64daa","sending":{"txHash":"0x1425098ed5ecc5192070ac32a69dd924268b9df5e7a69764142473e9d022321a","txLink":"https://polygonscan.com/tx/0x1425098ed5ecc5192070ac32a69dd924268b9df5e7a69764142473e9d022321a","amount":"1000000","token":{"address":"0xc2132D05D31c914a87C6611C10748AEb04B58e8F","chainId":137,"symbol":"USDT","decimals":6,"name":"USDT","coinKey":"USDT","logoURI":"https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png","priceUSD":"0.99989"},"chainId":137,"gasPrice":"85184881231","gasUsed":"361568","gasToken":{"address":"0x0000000000000000000000000000000000000000","chainId":137,"symbol":"POL","decimals":18,"name":"Polygon Ecosystem Token","coinKey":"POL","logoURI":"https://static.debank.com/image/matic_token/logo_url/matic/6f5a6b6f0732a7a235131bd7804d357c.png","priceUSD":"0.4506"},"gasAmount":"30800127136930208","gasAmountUSD":"0.0139","amountUSD":"0.9999","timestamp":1736518025},"receiving":{"txHash":"0x1425098ed5ecc5192070ac32a69dd924268b9df5e7a69764142473e9d022321a","txLink":"https://polygonscan.com/tx/0x1425098ed5ecc5192070ac32a69dd924268b9df5e7a69764142473e9d022321a","amount":"820847","token":{"address":"0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359","chainId":137,"symbol":"USDC","decimals":6,"name":"USD Coin","coinKey":"USDC","logoURI":"https://static.debank.com/image/coin/logo_url/usdc/e87790bfe0b3f2ea855dc29069b38818.png","priceUSD":"1.000100010001"},"chainId":137,"gasPrice":"85184881231","gasUsed":"361568","gasToken":{"address":"0x0000000000000000000000000000000000000000","chainId":137,"symbol":"POL","decimals":18,"name":"Polygon Ecosystem Token","coinKey":"POL","logoURI":"https://static.debank.com/image/matic_token/logo_url/matic/6f5a6b6f0732a7a235131bd7804d357c.png","priceUSD":"0.4506"},"gasAmount":"30800127136930208","gasAmountUSD":"0.0139","amountUSD":"0.8209","timestamp":1736518025}}}
 */
export interface RelayTransactionStatus {
  status?: string;
  message?: string;
  /** Extra information about a relay transaction */
  metadata?: {
    /** @format int32 */
    chainId?: number;
    txHash?: string;
  };
  /** Details about the transaction */
  transactionStatus?: {
    transactionId?: string;
    sending?: {
      txHash?: string;
      txLink?: string;
      amount?: string;
      token?: {
        address?: string;
        /** @format int32 */
        chainId?: number;
        symbol?: string;
        /** @format int32 */
        decimals?: number;
        name?: string;
        coinKey?: string;
        logoURI?: string;
        priceUSD?: string;
      };
      /** @format int32 */
      chainId?: number;
      gasPrice?: string;
      gasUsed?: string;
      gasToken?: {
        address?: string;
        /** @format int32 */
        chainId?: number;
        symbol?: string;
        /** @format int32 */
        decimals?: number;
        name?: string;
        coinKey?: string;
        logoURI?: string;
        priceUSD?: string;
      };
      gasAmount?: string;
      gasAmountUSD?: string;
      amountUSD?: string;
      /** @format int32 */
      timestamp?: number;
    };
    receiving?: {
      txHash?: string;
      txLink?: string;
      amount?: string;
      token?: {
        address?: string;
        /** @format int32 */
        chainId?: number;
        symbol?: string;
        /** @format int32 */
        decimals?: number;
        name?: string;
        coinKey?: string;
        logoURI?: string;
        priceUSD?: string;
      };
      /** @format int32 */
      chainId?: number;
      gasPrice?: string;
      gasUsed?: string;
      gasToken?: {
        address?: string;
        /** @format int32 */
        chainId?: number;
        symbol?: string;
        /** @format int32 */
        decimals?: number;
        name?: string;
        coinKey?: string;
        logoURI?: string;
        priceUSD?: string;
      };
      gasAmount?: string;
      gasAmountUSD?: string;
      amountUSD?: string;
      /** @format int32 */
      timestamp?: number;
    };
  };
}

/**
 * Root Type for RelayTransactionMetadata
 * Extra information about a relay transaction
 * @example {"chainId":137,"txHash":"0x1425098ed5ecc5192070ac32a69dd924268b9df5e7a69764142473e9d022321a"}
 */
export interface RelayTransactionMetadata {
  /** @format int32 */
  chainId?: number;
  txHash?: string;
}

/**
 * Root Type for RelayTransactionStatusResponse
 * @example {"status":"ok","data":{"status":"DONE","message":"All done","metadata":{"chainId":137,"txHash":"0x1425098ed5ecc5192070ac32a69dd924268b9df5e7a69764142473e9d022321a"},"transactionStatus":{"transactionId":"0xaddfdf22eeacd02f006e04bbb58f683394807664f62e150b078db0598ab64daa","sending":{"txHash":"0x1425098ed5ecc5192070ac32a69dd924268b9df5e7a69764142473e9d022321a","txLink":"https://polygonscan.com/tx/0x1425098ed5ecc5192070ac32a69dd924268b9df5e7a69764142473e9d022321a","amount":"1000000","token":{"address":"0xc2132D05D31c914a87C6611C10748AEb04B58e8F","chainId":137,"symbol":"USDT","decimals":6,"name":"USDT","coinKey":"USDT","logoURI":"https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png","priceUSD":"0.99989"},"chainId":137,"gasPrice":"85184881231","gasUsed":"361568","gasToken":{"address":"0x0000000000000000000000000000000000000000","chainId":137,"symbol":"POL","decimals":18,"name":"Polygon Ecosystem Token","coinKey":"POL","logoURI":"https://static.debank.com/image/matic_token/logo_url/matic/6f5a6b6f0732a7a235131bd7804d357c.png","priceUSD":"0.4506"},"gasAmount":"30800127136930208","gasAmountUSD":"0.0139","amountUSD":"0.9999","timestamp":1736518025},"receiving":{"txHash":"0x1425098ed5ecc5192070ac32a69dd924268b9df5e7a69764142473e9d022321a","txLink":"https://polygonscan.com/tx/0x1425098ed5ecc5192070ac32a69dd924268b9df5e7a69764142473e9d022321a","amount":"820847","token":{"address":"0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359","chainId":137,"symbol":"USDC","decimals":6,"name":"USD Coin","coinKey":"USDC","logoURI":"https://static.debank.com/image/coin/logo_url/usdc/e87790bfe0b3f2ea855dc29069b38818.png","priceUSD":"1.000100010001"},"chainId":137,"gasPrice":"85184881231","gasUsed":"361568","gasToken":{"address":"0x0000000000000000000000000000000000000000","chainId":137,"symbol":"POL","decimals":18,"name":"Polygon Ecosystem Token","coinKey":"POL","logoURI":"https://static.debank.com/image/matic_token/logo_url/matic/6f5a6b6f0732a7a235131bd7804d357c.png","priceUSD":"0.4506"},"gasAmount":"30800127136930208","gasAmountUSD":"0.0139","amountUSD":"0.8209","timestamp":1736518025}}}}
 */
export interface RelayTransactionStatusResponse {
  status?: string;
  /** Status details of a relay transaction */
  data: {
    status?: string;
    message?: string;
    metadata?: {
      /** @format int32 */
      chainId?: number;
      txHash?: string;
    };
    transactionStatus?: {
      transactionId?: string;
      sending?: {
        txHash?: string;
        txLink?: string;
        amount?: string;
        token?: {
          address?: string;
          /** @format int32 */
          chainId?: number;
          symbol?: string;
          /** @format int32 */
          decimals?: number;
          name?: string;
          coinKey?: string;
          logoURI?: string;
          priceUSD?: string;
        };
        /** @format int32 */
        chainId?: number;
        gasPrice?: string;
        gasUsed?: string;
        gasToken?: {
          address?: string;
          /** @format int32 */
          chainId?: number;
          symbol?: string;
          /** @format int32 */
          decimals?: number;
          name?: string;
          coinKey?: string;
          logoURI?: string;
          priceUSD?: string;
        };
        gasAmount?: string;
        gasAmountUSD?: string;
        amountUSD?: string;
        /** @format int32 */
        timestamp?: number;
      };
      receiving?: {
        txHash?: string;
        txLink?: string;
        amount?: string;
        token?: {
          address?: string;
          /** @format int32 */
          chainId?: number;
          symbol?: string;
          /** @format int32 */
          decimals?: number;
          name?: string;
          coinKey?: string;
          logoURI?: string;
          priceUSD?: string;
        };
        /** @format int32 */
        chainId?: number;
        gasPrice?: string;
        gasUsed?: string;
        gasToken?: {
          address?: string;
          /** @format int32 */
          chainId?: number;
          symbol?: string;
          /** @format int32 */
          decimals?: number;
          name?: string;
          coinKey?: string;
          logoURI?: string;
          priceUSD?: string;
        };
        gasAmount?: string;
        gasAmountUSD?: string;
        amountUSD?: string;
        /** @format int32 */
        timestamp?: number;
      };
    };
  };
}

/**
 * Root Type for RelayPermitSchema
 * A set of parameters specifying the token, permitted amount, spender address, nonce (for uniqueness), and deadline (for expiration) in a Permit2 allowance grant.
 * @example {"permitted":{"token":"0xc2132D05D31c914a87C6611C10748AEb04B58e8F","amount":"1000000"},"spender":"0x6307119078556Fc8aD77781DFC67df20d75FB4f9","nonce":"19","deadline":1738149521625}
 */
export interface RelayPermitSchema {
  permitted: {
    token?: string;
    amount?: string;
  };
  spender: string;
  nonce: string;
  /** @format int32 */
  deadline: number;
}

/**
 * Root Type for PermittedTokenSchema
 * @example {"token":"0xc2132D05D31c914a87C6611C10748AEb04B58e8F","amount":"1000000"}
 */
export interface PermittedTokenSchema {
  token?: string;
  amount?: string;
}

/**
 * Root Type for RelayLifiCallWitness
 * @example [{"type":"address","name":"diamondAddress"},{"type":"bytes32","name":"diamondCalldataHash"}]
 */
export type RelayLifiCallWitness = RelayWitnessParameters[];

/**
 * Root Type for RelayWithnessType
 * @example {"LiFiCall":[{"type":"address","name":"diamondAddress"},{"type":"bytes32","name":"diamondCalldataHash"}]}
 */
export interface RelayWithnessType {
  LiFiCall?: RelayWitnessParameters[];
}

/**
 * Root Type for RelayWitness
 * @example {"diamondAddress":"0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE","diamondCalldataHash":"0x78c758554f4213645a8ebcaa5c5c3eb7e6db4b90cf37df4adb54fb92a7fb2a78"}
 */
export interface RelayWitness {
  diamondAddress?: string;
  diamondCalldataHash?: string;
}

/**
 * Root Type for RelayPermitDomain
 * @example {"name":"Permit2","chainId":137,"verifyingContract":"0x000000000022D473030F116dDEE9F6B43aC78BA3"}
 */
export interface RelayPermitDomain {
  name?: string;
  /** @format int32 */
  chainId?: number;
  verifyingContract?: string;
}

/**
 * Root Type for RelayPermitTypes
 * @example {"PermitWitnessTransferFrom":[{"type":"TokenPermissions","name":"permitted"},{"type":"address","name":"spender"},{"type":"uint256","name":"nonce"},{"type":"uint256","name":"deadline"},{"type":"LiFiCall","name":"witness"}],"TokenPermissions":[{"type":"address","name":"token"},{"type":"uint256","name":"amount"}],"LiFiCall":[{"type":"address","name":"diamondAddress"},{"type":"bytes32","name":"diamondCalldataHash"}]}
 */
export interface RelayPermitTypes {
  PermitWitnessTransferFrom?: RelayWitnessParameters[];
  TokenPermissions?: RelayWitnessParameters[];
  LiFiCall?: RelayWitnessParameters[];
}

/**
 * Root Type for RelayWitnessLifiCallParameters
 * @example {"type":"bytes32","name":"diamondCalldataHash"}
 */
export interface RelayWitnessParameters {
  type?: string;
  name?: string;
}

/**
 * Root Type for RelayPermitData
 * @example {"domain":{"name":"Permit2","chainId":137,"verifyingContract":"0x000000000022D473030F116dDEE9F6B43aC78BA3"},"types":{"PermitWitnessTransferFrom":[{"type":"TokenPermissions","name":"permitted"},{"type":"address","name":"spender"},{"type":"uint256","name":"nonce"},{"type":"uint256","name":"deadline"},{"type":"LiFiCall","name":"witness"}],"TokenPermissions":[{"type":"address","name":"token"},{"type":"uint256","name":"amount"}],"LiFiCall":[{"type":"address","name":"diamondAddress"},{"type":"bytes32","name":"diamondCalldataHash"}]},"values":{"permitted":{"token":"0xc2132D05D31c914a87C6611C10748AEb04B58e8F","amount":"1000000"},"spender":"0x6307119078556Fc8aD77781DFC67df20d75FB4f9","nonce":"19","deadline":1738149521625,"witness":{"diamondAddress":"0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE","diamondCalldataHash":"0x78c758554f4213645a8ebcaa5c5c3eb7e6db4b90cf37df4adb54fb92a7fb2a78"}}}
 */
export interface RelayPermitData {
  domain?: {
    name?: string;
    /** @format int32 */
    chainId?: number;
    verifyingContract?: string;
  };
  types?: {
    PermitWitnessTransferFrom?: {
      type?: string;
      name?: string;
    }[];
    TokenPermissions?: {
      type?: string;
      name?: string;
    }[];
    LiFiCall?: {
      type?: string;
      name?: string;
    }[];
  };
  values?: {
    permitted?: {
      token?: string;
      amount?: string;
    };
    spender?: string;
    nonce?: string;
    /** @format int32 */
    deadline?: number;
    witness?: {
      diamondAddress?: string;
      diamondCalldataHash?: string;
    };
  };
}

/**
 * Root Type for RelayPermitWithWitness
 * @example {"permitted":{"token":"0xc2132D05D31c914a87C6611C10748AEb04B58e8F","amount":"1000000"},"spender":"0x6307119078556Fc8aD77781DFC67df20d75FB4f9","nonce":"19","deadline":1738149521625,"witness":{"diamondAddress":"0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE","diamondCalldataHash":"0x78c758554f4213645a8ebcaa5c5c3eb7e6db4b90cf37df4adb54fb92a7fb2a78"}}
 */
export interface RelayPermitWithWitness {
  permitted?: {
    token?: string;
    amount?: string;
  };
  spender?: string;
  nonce?: string;
  /** @format int32 */
  deadline?: number;
  witness?: {
    diamondAddress?: string;
    diamondCalldataHash?: string;
  };
}

/**
 * Root Type for RelayQuote
 * @example {"tokenOwner":"0xb9c0dE368BECE5e76B52545a8E377a4C118f597B","chainId":137,"permit":{"permitted":{"token":"0xc2132D05D31c914a87C6611C10748AEb04B58e8F","amount":"1000000"},"spender":"0x6307119078556Fc8aD77781DFC67df20d75FB4f9","nonce":"19","deadline":1738149521625},"witness":{"witnessType":{"LiFiCall":[{"type":"address","name":"diamondAddress"},{"type":"bytes32","name":"diamondCalldataHash"}]},"witnessTypeName":"LiFiCall","witness":{"diamondAddress":"0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE","diamondCalldataHash":"0x78c758554f4213645a8ebcaa5c5c3eb7e6db4b90cf37df4adb54fb92a7fb2a78"}},"permitData":{"domain":{"name":"Permit2","chainId":137,"verifyingContract":"0x000000000022D473030F116dDEE9F6B43aC78BA3"},"types":{"PermitWitnessTransferFrom":[{"type":"TokenPermissions","name":"permitted"},{"type":"address","name":"spender"},{"type":"uint256","name":"nonce"},{"type":"uint256","name":"deadline"},{"type":"LiFiCall","name":"witness"}],"TokenPermissions":[{"type":"address","name":"token"},{"type":"uint256","name":"amount"}],"LiFiCall":[{"type":"address","name":"diamondAddress"},{"type":"bytes32","name":"diamondCalldataHash"}]},"values":{"permitted":{"token":"0xc2132D05D31c914a87C6611C10748AEb04B58e8F","amount":"1000000"},"spender":"0x6307119078556Fc8aD77781DFC67df20d75FB4f9","nonce":"19","deadline":1738149521625,"witness":{"diamondAddress":"0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE","diamondCalldataHash":"0x78c758554f4213645a8ebcaa5c5c3eb7e6db4b90cf37df4adb54fb92a7fb2a78"}}},"step":{"id":"85f4d82a-9693-461c-bebe-956108965e5e:0","type":"lifi","tool":"lifidexaggregator","toolDetails":{"key":"lifidexaggregator","name":"LI.FI DEX Aggregator","logoURI":"https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/exchanges/lifidexaggregator.svg"},"integrator":"lifigasless","action":{"fromChainId":137,"fromAmount":"1000000","fromToken":{"address":"0xc2132D05D31c914a87C6611C10748AEb04B58e8F","chainId":137,"symbol":"USDT","decimals":6,"name":"USDT","coinKey":"USDT","logoURI":"https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png","priceUSD":"0.99961"},"fromAddress":"0xb9c0dE368BECE5e76B52545a8E377a4C118f597B","toChainId":137,"toToken":{"address":"0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359","chainId":137,"symbol":"USDC","decimals":6,"name":"USD Coin","coinKey":"USDC","logoURI":"https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png","priceUSD":"1.000300090027008"},"toAddress":"0xb9c0dE368BECE5e76B52545a8E377a4C118f597B","slippage":0.005},"estimate":{"tool":"lifidexaggregator","fromAmount":"1000000","fromAmountUSD":"0.9996","toAmount":"900330","toAmountMin":"895828","toAmountUSD":"0.9006","approvalAddress":"0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE","feeCosts":[{"name":"LIFI Fixed Fee","description":"Fixed LIFI fee, independent of any other fee","percentage":"0.1063","token":{"address":"0xc2132D05D31c914a87C6611C10748AEb04B58e8F","chainId":137,"symbol":"USDT","decimals":6,"name":"USDT","coinKey":"USDT","logoURI":"https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png","priceUSD":"0.99961"},"amount":"106302","amountUSD":"0.1063","included":true}],"gasCosts":[{"type":"SEND","price":"109499535178","estimate":"362865","limit":"544298","amount":"39733548832364970","amountUSD":"0.0172","token":{"address":"0x0000000000000000000000000000000000000000","chainId":137,"symbol":"MATIC","decimals":18,"name":"MATIC","coinKey":"MATIC","logoURI":"https://static.debank.com/image/matic_token/logo_url/matic/6f5a6b6f0732a7a235131bd7804d357c.png","priceUSD":"0.4333"}}],"executionDuration":30},"transactionRequest":{"to":"0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE","from":"0xb9c0dE368BECE5e76B52545a8E377a4C118f597B","gasLimit":"0x84e2a","gasPrice":"0x197eae4f4a","data":"0x5fd9ae2e71e792b43619012b1b703953c54ce1937ee5a5c162682fa775f4c5feb576c8cb00000000000000000000000000000000000000000000000000000000000000c00000000000000000000000000000000000000000000000000000000000000100000000000000000000000000b9c0de368bece5e76b52545a8e377a4c118f597b00000000000000000000000000000000000000000000000000000000000dab540000000000000000000000000000000000000000000000000000000000000160000000000000000000000000000000000000000000000000000000000000000b6c6966696761736c657373000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002a307830303030303030303030303030303030303030303030303030303030303030303030303030303030000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000001e0000000000000000000000000bd6c7b0d2f68c2b7805d88388319cfb6ecb50ea9000000000000000000000000bd6c7b0d2f68c2b7805d88388319cfb6ecb50ea9000000000000000000000000c2132d05d31c914a87c6611c10748aeb04b58e8f000000000000000000000000c2132d05d31c914a87c6611c10748aeb04b58e8f00000000000000000000000000000000000000000000000000000000000f424000000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000084eedd56e1000000000000000000000000c2132d05d31c914a87c6611c10748aeb04b58e8f0000000000000000000000000000000000000000000000000000000000019f3e0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000b9c0de368bece5e76b52545a8e377a4c118f597b000000000000000000000000000000000000000000000000000000000000000000000000000000006140b987d6b51fd75b66c3b07733beb5167c42fc0000000000000000000000006140b987d6b51fd75b66c3b07733beb5167c42fc000000000000000000000000c2132d05d31c914a87c6611c10748aeb04b58e8f0000000000000000000000003c499c542cef5e3811e1192ce70d8cc03d5c335900000000000000000000000000000000000000000000000000000000000da30200000000000000000000000000000000000000000000000000000000000000e0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001842646478b000000000000000000000000c2132d05d31c914a87c6611c10748aeb04b58e8f00000000000000000000000000000000000000000000000000000000000da3020000000000000000000000003c499c542cef5e3811e1192ce70d8cc03d5c335900000000000000000000000000000000000000000000000000000000000dab540000000000000000000000001231deb6f5749ef6ce6943a275a1d3e7486f4eae00000000000000000000000000000000000000000000000000000000000000c0000000000000000000000000000000000000000000000000000000000000008702c2132d05d31c914a87c6611c10748aeb04b58e8f01ffff0043c355d9ce77f91b7e1a314e258246d155100be9006140b987d6b51fd75b66c3b07733beb5167c42fc000bb80153e0bca35ec356bd5dddfebbd1fc0fd03fabad3901ffff0179e4240e33c121402dfc9009de266356c91f241d001231deb6f5749ef6ce6943a275a1d3e7486f4eae0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000","value":"0x0","chainId":137},"includedSteps":[{"id":"78473472-909f-4b67-a6c5-98c6a70ba384","type":"protocol","tool":"feeCollection","toolDetails":{"key":"feeCollection","name":"Integrator Fee","logoURI":"https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/protocols/feeCollection.svg"},"action":{"fromChainId":137,"fromAmount":"1000000","fromToken":{"address":"0xc2132D05D31c914a87C6611C10748AEb04B58e8F","chainId":137,"symbol":"USDT","decimals":6,"name":"USDT","coinKey":"USDT","logoURI":"https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png","priceUSD":"0.99961"},"fromAddress":"0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE","toChainId":137,"toToken":{"address":"0xc2132D05D31c914a87C6611C10748AEb04B58e8F","chainId":137,"symbol":"USDT","decimals":6,"name":"USDT","coinKey":"USDT","logoURI":"https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png","priceUSD":"0.99961"},"toAddress":"0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE","slippage":0.005},"estimate":{"tool":"feeCollection","fromAmount":"1000000","toAmount":"893698","toAmountMin":"893698","approvalAddress":"0xbD6C7B0d2f68c2b7805d88388319cfB6EcB50eA9","feeCosts":[{"name":"LIFI Fixed Fee","description":"Fixed LIFI fee, independent of any other fee","percentage":"0.1063","token":{"address":"0xc2132D05D31c914a87C6611C10748AEb04B58e8F","chainId":137,"symbol":"USDT","decimals":6,"name":"USDT","coinKey":"USDT","logoURI":"https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png","priceUSD":"0.99961"},"amount":"106302","amountUSD":"0.1063","included":true}],"gasCosts":[{"type":"SEND","price":"109499535178","estimate":"130000","limit":"195000","amount":"14234939573140000","amountUSD":"0.0062","token":{"address":"0x0000000000000000000000000000000000000000","chainId":137,"symbol":"MATIC","decimals":18,"name":"MATIC","coinKey":"MATIC","logoURI":"https://static.debank.com/image/matic_token/logo_url/matic/6f5a6b6f0732a7a235131bd7804d357c.png","priceUSD":"0.4333"}}],"executionDuration":0}},{"id":"5655a846-26e1-4182-b4b7-57e8b189b301","type":"swap","tool":"lifidexaggregator","toolDetails":{"key":"lifidexaggregator","name":"LI.FI DEX Aggregator","logoURI":"https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/exchanges/lifidexaggregator.svg"},"action":{"fromChainId":137,"fromAmount":"893698","fromToken":{"address":"0xc2132D05D31c914a87C6611C10748AEb04B58e8F","chainId":137,"symbol":"USDT","decimals":6,"name":"USDT","coinKey":"USDT","logoURI":"https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png","priceUSD":"0.99961"},"fromAddress":"0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE","toChainId":137,"toToken":{"address":"0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359","chainId":137,"symbol":"USDC","decimals":6,"name":"USD Coin","coinKey":"USDC","logoURI":"https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png","priceUSD":"1.000300090027008"},"toAddress":"0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE","slippage":0.005},"estimate":{"tool":"lifidexaggregator","fromAmount":"893698","toAmount":"900330","toAmountMin":"895828","approvalAddress":"0x6140b987d6B51Fd75b66C3B07733Beb5167c42fc","feeCosts":[],"gasCosts":[{"type":"SEND","price":"109499535178","estimate":"170000","limit":"255000","amount":"18614920980260000","amountUSD":"0.0081","token":{"address":"0x0000000000000000000000000000000000000000","chainId":137,"symbol":"MATIC","decimals":18,"name":"MATIC","coinKey":"MATIC","logoURI":"https://static.debank.com/image/matic_token/logo_url/matic/6f5a6b6f0732a7a235131bd7804d357c.png","priceUSD":"0.4333"}}],"executionDuration":30}}]}}
 */
export interface RelayQuote {
  tokenOwner?: string;
  /** @format int32 */
  chainId?: number;
  /** A set of parameters specifying the token, permitted amount, spender address, nonce (for uniqueness), and deadline (for expiration) in a Permit2 allowance grant. */
  permit?: {
    permitted?: {
      token?: string;
      amount?: string;
    };
    spender?: string;
    nonce?: string;
    /** @format int32 */
    deadline?: number;
  };
  witness?: {
    witnessType?: {
      LiFiCall?: {
        type?: string;
        name?: string;
      }[];
    };
    witnessTypeName?: string;
    witness?: {
      diamondAddress?: string;
      diamondCalldataHash?: string;
    };
  };
  permitData?: {
    domain?: {
      name?: string;
      /** @format int32 */
      chainId?: number;
      verifyingContract?: string;
    };
    types?: {
      PermitWitnessTransferFrom?: {
        type?: string;
        name?: string;
      }[];
      TokenPermissions?: {
        type?: string;
        name?: string;
      }[];
      LiFiCall?: {
        type?: string;
        name?: string;
      }[];
    };
    values?: {
      permitted?: {
        token?: string;
        amount?: string;
      };
      spender?: string;
      nonce?: string;
      /** @format int32 */
      deadline?: number;
      witness?: {
        diamondAddress?: string;
        diamondCalldataHash?: string;
      };
    };
  };
  /** Object that represents one step of a `Route` */
  step?: {
    id?: string;
    type?: string;
    tool?: string;
    toolDetails?: {
      key?: string;
      name?: string;
      logoURI?: string;
    };
    integrator?: string;
    action?: {
      /** @format int32 */
      fromChainId?: number;
      fromAmount?: string;
      fromToken?: {
        address?: string;
        /** @format int32 */
        chainId?: number;
        symbol?: string;
        /** @format int32 */
        decimals?: number;
        name?: string;
        coinKey?: string;
        logoURI?: string;
        priceUSD?: string;
      };
      fromAddress?: string;
      /** @format int32 */
      toChainId?: number;
      toToken?: {
        address?: string;
        /** @format int32 */
        chainId?: number;
        symbol?: string;
        /** @format int32 */
        decimals?: number;
        name?: string;
        coinKey?: string;
        logoURI?: string;
        priceUSD?: string;
      };
      toAddress?: string;
      /** @format double */
      slippage?: number;
    };
    estimate?: {
      tool?: string;
      fromAmount?: string;
      fromAmountUSD?: string;
      toAmount?: string;
      toAmountMin?: string;
      toAmountUSD?: string;
      approvalAddress?: string;
      approvalReset?: boolean;
      feeCosts?: {
        name?: string;
        description?: string;
        percentage?: string;
        token?: {
          address?: string;
          /** @format int32 */
          chainId?: number;
          symbol?: string;
          /** @format int32 */
          decimals?: number;
          name?: string;
          coinKey?: string;
          logoURI?: string;
          priceUSD?: string;
        };
        amount?: string;
        amountUSD?: string;
        included?: boolean;
      }[];
      gasCosts?: {
        type?: string;
        price?: string;
        estimate?: string;
        limit?: string;
        amount?: string;
        amountUSD?: string;
        token?: {
          address?: string;
          /** @format int32 */
          chainId?: number;
          symbol?: string;
          /** @format int32 */
          decimals?: number;
          name?: string;
          coinKey?: string;
          logoURI?: string;
          priceUSD?: string;
        };
      }[];
      /** @format int32 */
      executionDuration?: number;
    };
    transactionRequest?: {
      to?: string;
      from?: string;
      gasLimit?: string;
      gasPrice?: string;
      data?: string;
      value?: string;
      /** @format int32 */
      chainId?: number;
    };
    includedSteps?: {
      id?: string;
      type?: string;
      tool?: string;
      toolDetails?: {
        key?: string;
        name?: string;
        logoURI?: string;
      };
      action?: {
        /** @format int32 */
        fromChainId?: number;
        fromAmount?: string;
        fromToken?: {
          address?: string;
          /** @format int32 */
          chainId?: number;
          symbol?: string;
          /** @format int32 */
          decimals?: number;
          name?: string;
          coinKey?: string;
          logoURI?: string;
          priceUSD?: string;
        };
        fromAddress?: string;
        /** @format int32 */
        toChainId?: number;
        toToken?: {
          address?: string;
          /** @format int32 */
          chainId?: number;
          symbol?: string;
          /** @format int32 */
          decimals?: number;
          name?: string;
          coinKey?: string;
          logoURI?: string;
          priceUSD?: string;
        };
        toAddress?: string;
        /** @format double */
        slippage?: number;
      };
      estimate?: {
        tool?: string;
        fromAmount?: string;
        toAmount?: string;
        toAmountMin?: string;
        approvalAddress?: string;
        approvalReset?: boolean;
        feeCosts?: {
          name?: string;
          description?: string;
          percentage?: string;
          token?: {
            address?: string;
            /** @format int32 */
            chainId?: number;
            symbol?: string;
            /** @format int32 */
            decimals?: number;
            name?: string;
            coinKey?: string;
            logoURI?: string;
            priceUSD?: string;
          };
          amount?: string;
          amountUSD?: string;
          included?: boolean;
        }[];
        gasCosts?: {
          type?: string;
          price?: string;
          estimate?: string;
          limit?: string;
          amount?: string;
          amountUSD?: string;
          token?: {
            address?: string;
            /** @format int32 */
            chainId?: number;
            symbol?: string;
            /** @format int32 */
            decimals?: number;
            name?: string;
            coinKey?: string;
            logoURI?: string;
            priceUSD?: string;
          };
        }[];
        /** @format int32 */
        executionDuration?: number;
      };
    }[];
  };
}

/**
 * Root Type for RelayWitness
 * @example {"witnessType":{"LiFiCall":[{"type":"address","name":"diamondAddress"},{"type":"bytes32","name":"diamondCalldataHash"}]},"witnessTypeName":"LiFiCall","witness":{"diamondAddress":"0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE","diamondCalldataHash":"0x78c758554f4213645a8ebcaa5c5c3eb7e6db4b90cf37df4adb54fb92a7fb2a78"}}
 */
export interface RelayWitnessFull {
  witnessType?: {
    LiFiCall?: {
      type?: string;
      name?: string;
    }[];
  };
  witnessTypeName?: string;
  witness?: {
    diamondAddress?: string;
    diamondCalldataHash?: string;
  };
}

/**
 * Root Type for RelayQuoteData
 * @example {"quote":{"tokenOwner":"0xb9c0dE368BECE5e76B52545a8E377a4C118f597B","chainId":137,"permit":{"permitted":{"token":"0xc2132D05D31c914a87C6611C10748AEb04B58e8F","amount":"1000000"},"spender":"0x6307119078556Fc8aD77781DFC67df20d75FB4f9","nonce":"19","deadline":1738149521625},"witness":{"witnessType":{"LiFiCall":[{"type":"address","name":"diamondAddress"},{"type":"bytes32","name":"diamondCalldataHash"}]},"witnessTypeName":"LiFiCall","witness":{"diamondAddress":"0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE","diamondCalldataHash":"0x78c758554f4213645a8ebcaa5c5c3eb7e6db4b90cf37df4adb54fb92a7fb2a78"}},"permitData":{"domain":{"name":"Permit2","chainId":137,"verifyingContract":"0x000000000022D473030F116dDEE9F6B43aC78BA3"},"types":{"PermitWitnessTransferFrom":[{"type":"TokenPermissions","name":"permitted"},{"type":"address","name":"spender"},{"type":"uint256","name":"nonce"},{"type":"uint256","name":"deadline"},{"type":"LiFiCall","name":"witness"}],"TokenPermissions":[{"type":"address","name":"token"},{"type":"uint256","name":"amount"}],"LiFiCall":[{"type":"address","name":"diamondAddress"},{"type":"bytes32","name":"diamondCalldataHash"}]},"values":{"permitted":{"token":"0xc2132D05D31c914a87C6611C10748AEb04B58e8F","amount":"1000000"},"spender":"0x6307119078556Fc8aD77781DFC67df20d75FB4f9","nonce":"19","deadline":1738149521625,"witness":{"diamondAddress":"0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE","diamondCalldataHash":"0x78c758554f4213645a8ebcaa5c5c3eb7e6db4b90cf37df4adb54fb92a7fb2a78"}}},"step":{}},"approvalTxs":[]}
 */
export interface RelayQuoteData {
  quote?: {
    tokenOwner?: string;
    /** @format int32 */
    chainId?: number;
    permit?: {
      permitted?: {
        token?: string;
        amount?: string;
      };
      spender?: string;
      nonce?: string;
      /** @format int32 */
      deadline?: number;
    };
    witness?: {
      witnessType?: {
        LiFiCall?: {
          type?: string;
          name?: string;
        }[];
      };
      witnessTypeName?: string;
      witness?: {
        diamondAddress?: string;
        diamondCalldataHash?: string;
      };
    };
    permitData?: {
      domain?: {
        name?: string;
        /** @format int32 */
        chainId?: number;
        verifyingContract?: string;
      };
      types?: {
        PermitWitnessTransferFrom?: {
          type?: string;
          name?: string;
        }[];
        TokenPermissions?: {
          type?: string;
          name?: string;
        }[];
        LiFiCall?: {
          type?: string;
          name?: string;
        }[];
      };
      values?: {
        permitted?: {
          token?: string;
          amount?: string;
        };
        spender?: string;
        nonce?: string;
        /** @format int32 */
        deadline?: number;
        witness?: {
          diamondAddress?: string;
          diamondCalldataHash?: string;
        };
      };
    };
    step?: object;
  };
  approvalTxs?: ContractTransactionSchema[];
}

export interface ContractTransactionSchema {
  to?: string;
  from?: string;
  nonce?: number;
  gasLimit?: string;
  gasPrice?: string;
  data?: string;
  value?: string;
  chainId?: string;
  type?: number;
  accessList?: RelayAccessList[];
  maxPriorityFeePerGas?: string;
  maxFeePerGas?: string;
  customData?: any;
  enableCcipRead?: boolean;
  blockTag?: string;
}

export interface RelayAccessList {
  address?: string;
  storageKeys?: string[];
}

/**
 * Root Type for RelayQuoteResponse
 * @example {"status":"ok","data":{"quote":{"tokenOwner":"0xb9c0dE368BECE5e76B52545a8E377a4C118f597B","chainId":137,"permit":{"permitted":{"token":"0xc2132D05D31c914a87C6611C10748AEb04B58e8F","amount":"1000000"},"spender":"0x6307119078556Fc8aD77781DFC67df20d75FB4f9","nonce":"19","deadline":1738149521625},"witness":{"witnessType":{"LiFiCall":[{"type":"address","name":"diamondAddress"},{"type":"bytes32","name":"diamondCalldataHash"}]},"witnessTypeName":"LiFiCall","witness":{"diamondAddress":"0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE","diamondCalldataHash":"0x78c758554f4213645a8ebcaa5c5c3eb7e6db4b90cf37df4adb54fb92a7fb2a78"}},"permitData":{"domain":{"name":"Permit2","chainId":137,"verifyingContract":"0x000000000022D473030F116dDEE9F6B43aC78BA3"},"types":{"PermitWitnessTransferFrom":[{"type":"TokenPermissions","name":"permitted"},{"type":"address","name":"spender"},{"type":"uint256","name":"nonce"},{"type":"uint256","name":"deadline"},{"type":"LiFiCall","name":"witness"}],"TokenPermissions":[{"type":"address","name":"token"},{"type":"uint256","name":"amount"}],"LiFiCall":[{"type":"address","name":"diamondAddress"},{"type":"bytes32","name":"diamondCalldataHash"}]},"values":{"permitted":{"token":"0xc2132D05D31c914a87C6611C10748AEb04B58e8F","amount":"1000000"},"spender":"0x6307119078556Fc8aD77781DFC67df20d75FB4f9","nonce":"19","deadline":1738149521625,"witness":{"diamondAddress":"0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE","diamondCalldataHash":"0x78c758554f4213645a8ebcaa5c5c3eb7e6db4b90cf37df4adb54fb92a7fb2a78"}}},"step":{"id":"85f4d82a-9693-461c-bebe-956108965e5e:0","type":"lifi","tool":"lifidexaggregator","toolDetails":{"key":"lifidexaggregator","name":"LI.FI DEX Aggregator","logoURI":"https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/exchanges/lifidexaggregator.svg"},"integrator":"lifigasless","action":{"fromChainId":137,"fromAmount":"1000000","fromToken":{"address":"0xc2132D05D31c914a87C6611C10748AEb04B58e8F","chainId":137,"symbol":"USDT","decimals":6,"name":"USDT","coinKey":"USDT","logoURI":"https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png","priceUSD":"0.99961"},"fromAddress":"0xb9c0dE368BECE5e76B52545a8E377a4C118f597B","toChainId":137,"toToken":{"address":"0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359","chainId":137,"symbol":"USDC","decimals":6,"name":"USD Coin","coinKey":"USDC","logoURI":"https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png","priceUSD":"1.000300090027008"},"toAddress":"0xb9c0dE368BECE5e76B52545a8E377a4C118f597B","slippage":0.005},"estimate":{"tool":"lifidexaggregator","fromAmount":"1000000","fromAmountUSD":"0.9996","toAmount":"900330","toAmountMin":"895828","toAmountUSD":"0.9006","approvalAddress":"0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE","feeCosts":[{"name":"LIFI Fixed Fee","description":"Fixed LIFI fee, independent of any other fee","percentage":"0.1063","token":{"address":"0xc2132D05D31c914a87C6611C10748AEb04B58e8F","chainId":137,"symbol":"USDT","decimals":6,"name":"USDT","coinKey":"USDT","logoURI":"https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png","priceUSD":"0.99961"},"amount":"106302","amountUSD":"0.1063","included":true}],"gasCosts":[{"type":"SEND","price":"109499535178","estimate":"362865","limit":"544298","amount":"39733548832364970","amountUSD":"0.0172","token":{"address":"0x0000000000000000000000000000000000000000","chainId":137,"symbol":"MATIC","decimals":18,"name":"MATIC","coinKey":"MATIC","logoURI":"https://static.debank.com/image/matic_token/logo_url/matic/6f5a6b6f0732a7a235131bd7804d357c.png","priceUSD":"0.4333"}}],"executionDuration":30},"transactionRequest":{"to":"0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE","from":"0xb9c0dE368BECE5e76B52545a8E377a4C118f597B","gasLimit":"0x84e2a","gasPrice":"0x197eae4f4a","data":"0x5fd9ae2e71e792b43619012b1b703953c54ce1937ee5a5c162682fa775f4c5feb576c8cb00000000000000000000000000000000000000000000000000000000000000c00000000000000000000000000000000000000000000000000000000000000100000000000000000000000000b9c0de368bece5e76b52545a8e377a4c118f597b00000000000000000000000000000000000000000000000000000000000dab540000000000000000000000000000000000000000000000000000000000000160000000000000000000000000000000000000000000000000000000000000000b6c6966696761736c657373000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002a307830303030303030303030303030303030303030303030303030303030303030303030303030303030000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000001e0000000000000000000000000bd6c7b0d2f68c2b7805d88388319cfb6ecb50ea9000000000000000000000000bd6c7b0d2f68c2b7805d88388319cfb6ecb50ea9000000000000000000000000c2132d05d31c914a87c6611c10748aeb04b58e8f000000000000000000000000c2132d05d31c914a87c6611c10748aeb04b58e8f00000000000000000000000000000000000000000000000000000000000f424000000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000084eedd56e1000000000000000000000000c2132d05d31c914a87c6611c10748aeb04b58e8f0000000000000000000000000000000000000000000000000000000000019f3e0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000b9c0de368bece5e76b52545a8e377a4c118f597b000000000000000000000000000000000000000000000000000000000000000000000000000000006140b987d6b51fd75b66c3b07733beb5167c42fc0000000000000000000000006140b987d6b51fd75b66c3b07733beb5167c42fc000000000000000000000000c2132d05d31c914a87c6611c10748aeb04b58e8f0000000000000000000000003c499c542cef5e3811e1192ce70d8cc03d5c335900000000000000000000000000000000000000000000000000000000000da30200000000000000000000000000000000000000000000000000000000000000e0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001842646478b000000000000000000000000c2132d05d31c914a87c6611c10748aeb04b58e8f00000000000000000000000000000000000000000000000000000000000da3020000000000000000000000003c499c542cef5e3811e1192ce70d8cc03d5c335900000000000000000000000000000000000000000000000000000000000dab540000000000000000000000001231deb6f5749ef6ce6943a275a1d3e7486f4eae00000000000000000000000000000000000000000000000000000000000000c0000000000000000000000000000000000000000000000000000000000000008702c2132d05d31c914a87c6611c10748aeb04b58e8f01ffff0043c355d9ce77f91b7e1a314e258246d155100be9006140b987d6b51fd75b66c3b07733beb5167c42fc000bb80153e0bca35ec356bd5dddfebbd1fc0fd03fabad3901ffff0179e4240e33c121402dfc9009de266356c91f241d001231deb6f5749ef6ce6943a275a1d3e7486f4eae0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000","value":"0x0","chainId":137},"includedSteps":[{"id":"78473472-909f-4b67-a6c5-98c6a70ba384","type":"protocol","tool":"feeCollection","toolDetails":{"key":"feeCollection","name":"Integrator Fee","logoURI":"https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/protocols/feeCollection.svg"},"action":{"fromChainId":137,"fromAmount":"1000000","fromToken":{"address":"0xc2132D05D31c914a87C6611C10748AEb04B58e8F","chainId":137,"symbol":"USDT","decimals":6,"name":"USDT","coinKey":"USDT","logoURI":"https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png","priceUSD":"0.99961"},"fromAddress":"0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE","toChainId":137,"toToken":{"address":"0xc2132D05D31c914a87C6611C10748AEb04B58e8F","chainId":137,"symbol":"USDT","decimals":6,"name":"USDT","coinKey":"USDT","logoURI":"https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png","priceUSD":"0.99961"},"toAddress":"0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE","slippage":0.005},"estimate":{"tool":"feeCollection","fromAmount":"1000000","toAmount":"893698","toAmountMin":"893698","approvalAddress":"0xbD6C7B0d2f68c2b7805d88388319cfB6EcB50eA9","feeCosts":[{"name":"LIFI Fixed Fee","description":"Fixed LIFI fee, independent of any other fee","percentage":"0.1063","token":{"address":"0xc2132D05D31c914a87C6611C10748AEb04B58e8F","chainId":137,"symbol":"USDT","decimals":6,"name":"USDT","coinKey":"USDT","logoURI":"https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png","priceUSD":"0.99961"},"amount":"106302","amountUSD":"0.1063","included":true}],"gasCosts":[{"type":"SEND","price":"109499535178","estimate":"130000","limit":"195000","amount":"14234939573140000","amountUSD":"0.0062","token":{"address":"0x0000000000000000000000000000000000000000","chainId":137,"symbol":"MATIC","decimals":18,"name":"MATIC","coinKey":"MATIC","logoURI":"https://static.debank.com/image/matic_token/logo_url/matic/6f5a6b6f0732a7a235131bd7804d357c.png","priceUSD":"0.4333"}}],"executionDuration":0}},{"id":"5655a846-26e1-4182-b4b7-57e8b189b301","type":"swap","tool":"lifidexaggregator","toolDetails":{"key":"lifidexaggregator","name":"LI.FI DEX Aggregator","logoURI":"https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/exchanges/lifidexaggregator.svg"},"action":{"fromChainId":137,"fromAmount":"893698","fromToken":{"address":"0xc2132D05D31c914a87C6611C10748AEb04B58e8F","chainId":137,"symbol":"USDT","decimals":6,"name":"USDT","coinKey":"USDT","logoURI":"https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png","priceUSD":"0.99961"},"fromAddress":"0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE","toChainId":137,"toToken":{"address":"0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359","chainId":137,"symbol":"USDC","decimals":6,"name":"USD Coin","coinKey":"USDC","logoURI":"https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png","priceUSD":"1.000300090027008"},"toAddress":"0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE","slippage":0.005},"estimate":{"tool":"lifidexaggregator","fromAmount":"893698","toAmount":"900330","toAmountMin":"895828","approvalAddress":"0x6140b987d6B51Fd75b66C3B07733Beb5167c42fc","feeCosts":[],"gasCosts":[{"type":"SEND","price":"109499535178","estimate":"170000","limit":"255000","amount":"18614920980260000","amountUSD":"0.0081","token":{"address":"0x0000000000000000000000000000000000000000","chainId":137,"symbol":"MATIC","decimals":18,"name":"MATIC","coinKey":"MATIC","logoURI":"https://static.debank.com/image/matic_token/logo_url/matic/6f5a6b6f0732a7a235131bd7804d357c.png","priceUSD":"0.4333"}}],"executionDuration":30}}]}},"approvalTxs":[]}}
 */
export interface RelayQuoteResponse {
  status?: string;
  data?: {
    quote?: {
      tokenOwner?: string;
      /** @format int32 */
      chainId?: number;
      permit?: {
        permitted?: {
          token?: string;
          amount?: string;
        };
        spender?: string;
        nonce?: string;
        /** @format int32 */
        deadline?: number;
      };
      witness?: {
        witnessType?: {
          LiFiCall?: {
            type?: string;
            name?: string;
          }[];
        };
        witnessTypeName?: string;
        witness?: {
          diamondAddress?: string;
          diamondCalldataHash?: string;
        };
      };
      permitData?: {
        domain?: {
          name?: string;
          /** @format int32 */
          chainId?: number;
          verifyingContract?: string;
        };
        types?: {
          PermitWitnessTransferFrom?: {
            type?: string;
            name?: string;
          }[];
          TokenPermissions?: {
            type?: string;
            name?: string;
          }[];
          LiFiCall?: {
            type?: string;
            name?: string;
          }[];
        };
        values?: {
          permitted?: {
            token?: string;
            amount?: string;
          };
          spender?: string;
          nonce?: string;
          /** @format int32 */
          deadline?: number;
          witness?: {
            diamondAddress?: string;
            diamondCalldataHash?: string;
          };
        };
      };
      step?: {
        id?: string;
        type?: string;
        tool?: string;
        toolDetails?: {
          key?: string;
          name?: string;
          logoURI?: string;
        };
        integrator?: string;
        action?: {
          /** @format int32 */
          fromChainId?: number;
          fromAmount?: string;
          fromToken?: {
            address?: string;
            /** @format int32 */
            chainId?: number;
            symbol?: string;
            /** @format int32 */
            decimals?: number;
            name?: string;
            coinKey?: string;
            logoURI?: string;
            priceUSD?: string;
          };
          fromAddress?: string;
          /** @format int32 */
          toChainId?: number;
          toToken?: {
            address?: string;
            /** @format int32 */
            chainId?: number;
            symbol?: string;
            /** @format int32 */
            decimals?: number;
            name?: string;
            coinKey?: string;
            logoURI?: string;
            priceUSD?: string;
          };
          toAddress?: string;
          /** @format double */
          slippage?: number;
        };
        estimate?: {
          tool?: string;
          fromAmount?: string;
          fromAmountUSD?: string;
          toAmount?: string;
          toAmountMin?: string;
          toAmountUSD?: string;
          approvalAddress?: string;
          approvalReset?: boolean;
          feeCosts?: {
            name?: string;
            description?: string;
            percentage?: string;
            token?: {
              address?: string;
              /** @format int32 */
              chainId?: number;
              symbol?: string;
              /** @format int32 */
              decimals?: number;
              name?: string;
              coinKey?: string;
              logoURI?: string;
              priceUSD?: string;
            };
            amount?: string;
            amountUSD?: string;
            included?: boolean;
          }[];
          gasCosts?: {
            type?: string;
            price?: string;
            estimate?: string;
            limit?: string;
            amount?: string;
            amountUSD?: string;
            token?: {
              address?: string;
              /** @format int32 */
              chainId?: number;
              symbol?: string;
              /** @format int32 */
              decimals?: number;
              name?: string;
              coinKey?: string;
              logoURI?: string;
              priceUSD?: string;
            };
          }[];
          /** @format int32 */
          executionDuration?: number;
        };
        transactionRequest?: {
          to?: string;
          from?: string;
          gasLimit?: string;
          gasPrice?: string;
          data?: string;
          value?: string;
          /** @format int32 */
          chainId?: number;
        };
        includedSteps?: {
          id?: string;
          type?: string;
          tool?: string;
          toolDetails?: {
            key?: string;
            name?: string;
            logoURI?: string;
          };
          action?: {
            /** @format int32 */
            fromChainId?: number;
            fromAmount?: string;
            fromToken?: {
              address?: string;
              /** @format int32 */
              chainId?: number;
              symbol?: string;
              /** @format int32 */
              decimals?: number;
              name?: string;
              coinKey?: string;
              logoURI?: string;
              priceUSD?: string;
            };
            fromAddress?: string;
            /** @format int32 */
            toChainId?: number;
            toToken?: {
              address?: string;
              /** @format int32 */
              chainId?: number;
              symbol?: string;
              /** @format int32 */
              decimals?: number;
              name?: string;
              coinKey?: string;
              logoURI?: string;
              priceUSD?: string;
            };
            toAddress?: string;
            /** @format double */
            slippage?: number;
          };
          estimate?: {
            tool?: string;
            fromAmount?: string;
            toAmount?: string;
            toAmountMin?: string;
            approvalAddress?: string;
            approvalReset?: boolean;
            feeCosts?: {
              name?: string;
              description?: string;
              percentage?: string;
              token?: {
                address?: string;
                /** @format int32 */
                chainId?: number;
                symbol?: string;
                /** @format int32 */
                decimals?: number;
                name?: string;
                coinKey?: string;
                logoURI?: string;
                priceUSD?: string;
              };
              amount?: string;
              amountUSD?: string;
              included?: boolean;
            }[];
            gasCosts?: {
              type?: string;
              price?: string;
              estimate?: string;
              limit?: string;
              amount?: string;
              amountUSD?: string;
              token?: {
                address?: string;
                /** @format int32 */
                chainId?: number;
                symbol?: string;
                /** @format int32 */
                decimals?: number;
                name?: string;
                coinKey?: string;
                logoURI?: string;
                priceUSD?: string;
              };
            }[];
            /** @format int32 */
            executionDuration?: number;
          };
        }[];
      };
    };
    approvalTxs?: any[];
  };
}

export interface RelayRequestSchema {
  tokenOwner: string;
  chainId: number;
  /** A set of parameters specifying the token, permitted amount, spender address, nonce (for uniqueness), and deadline (for expiration) in a Permit2 allowance grant. */
  permit?: RelayPermitSchema;
  signedPermitData?: string;
  callData: string;
}

/**
 * Root Type for RelayResponseData
 * @example {"taskId":"string"}
 */
export interface RelayResponseData {
  taskId?: string;
}

/**
 * Root Type for RelayResponse
 * @example {"status":"ok","data":{"taskId":"string"}}
 */
export interface RelayResponse {
  status?: string;
  data?: {
    taskId?: string;
  };
}

export type QueryParamsType = Record<string | number, any>;
export type ResponseFormat = keyof Omit<Body, "body" | "bodyUsed">;

export interface FullRequestParams extends Omit<RequestInit, "body"> {
  /** set parameter to `true` for call `securityWorker` for this request */
  secure?: boolean;
  /** request path */
  path: string;
  /** content type of request body */
  type?: ContentType;
  /** query params */
  query?: QueryParamsType;
  /** format of response (i.e. response.json() -> format: "json") */
  format?: ResponseFormat;
  /** request body */
  body?: unknown;
  /** base url */
  baseUrl?: string;
  /** request cancellation token */
  cancelToken?: CancelToken;
}

export type RequestParams = Omit<
  FullRequestParams,
  "body" | "method" | "query" | "path"
>;

export interface ApiConfig<SecurityDataType = unknown> {
  baseUrl?: string;
  baseApiParams?: Omit<RequestParams, "baseUrl" | "cancelToken" | "signal">;
  securityWorker?: (
    securityData: SecurityDataType | null,
  ) => Promise<RequestParams | void> | RequestParams | void;
  customFetch?: typeof fetch;
}

export interface HttpResponse<D extends unknown, E extends unknown = unknown>
  extends Response {
  data: D;
  error: E;
}

type CancelToken = Symbol | string | number;

export enum ContentType {
  Json = "application/json",
  JsonApi = "application/vnd.api+json",
  FormData = "multipart/form-data",
  UrlEncoded = "application/x-www-form-urlencoded",
  Text = "text/plain",
}

export class HttpClient<SecurityDataType = unknown> {
  public baseUrl: string = "https://li.quest";
  private securityData: SecurityDataType | null = null;
  private securityWorker?: ApiConfig<SecurityDataType>["securityWorker"];
  private abortControllers = new Map<CancelToken, AbortController>();
  private customFetch = (...fetchParams: Parameters<typeof fetch>) =>
    fetch(...fetchParams);

  private baseApiParams: RequestParams = {
    credentials: "same-origin",
    headers: {},
    redirect: "follow",
    referrerPolicy: "no-referrer",
  };

  constructor(apiConfig: ApiConfig<SecurityDataType> = {}) {
    Object.assign(this, apiConfig);
  }

  public setSecurityData = (data: SecurityDataType | null) => {
    this.securityData = data;
  };

  protected encodeQueryParam(key: string, value: any) {
    const encodedKey = encodeURIComponent(key);
    return `${encodedKey}=${encodeURIComponent(typeof value === "number" ? value : `${value}`)}`;
  }

  protected addQueryParam(query: QueryParamsType, key: string) {
    return this.encodeQueryParam(key, query[key]);
  }

  protected addArrayQueryParam(query: QueryParamsType, key: string) {
    const value = query[key];
    return value.map((v: any) => this.encodeQueryParam(key, v)).join("&");
  }

  protected toQueryString(rawQuery?: QueryParamsType): string {
    const query = rawQuery || {};
    const keys = Object.keys(query).filter(
      (key) => "undefined" !== typeof query[key],
    );
    return keys
      .map((key) =>
        Array.isArray(query[key])
          ? this.addArrayQueryParam(query, key)
          : this.addQueryParam(query, key),
      )
      .join("&");
  }

  protected addQueryParams(rawQuery?: QueryParamsType): string {
    const queryString = this.toQueryString(rawQuery);
    return queryString ? `?${queryString}` : "";
  }

  private contentFormatters: Record<ContentType, (input: any) => any> = {
    [ContentType.Json]: (input: any) =>
      input !== null && (typeof input === "object" || typeof input === "string")
        ? JSON.stringify(input)
        : input,
    [ContentType.JsonApi]: (input: any) =>
      input !== null && (typeof input === "object" || typeof input === "string")
        ? JSON.stringify(input)
        : input,
    [ContentType.Text]: (input: any) =>
      input !== null && typeof input !== "string"
        ? JSON.stringify(input)
        : input,
    [ContentType.FormData]: (input: any) => {
      if (input instanceof FormData) {
        return input;
      }

      return Object.keys(input || {}).reduce((formData, key) => {
        const property = input[key];
        formData.append(
          key,
          property instanceof Blob
            ? property
            : typeof property === "object" && property !== null
              ? JSON.stringify(property)
              : `${property}`,
        );
        return formData;
      }, new FormData());
    },
    [ContentType.UrlEncoded]: (input: any) => this.toQueryString(input),
  };

  protected mergeRequestParams(
    params1: RequestParams,
    params2?: RequestParams,
  ): RequestParams {
    return {
      ...this.baseApiParams,
      ...params1,
      ...(params2 || {}),
      headers: {
        ...(this.baseApiParams.headers || {}),
        ...(params1.headers || {}),
        ...((params2 && params2.headers) || {}),
      },
    };
  }

  protected createAbortSignal = (
    cancelToken: CancelToken,
  ): AbortSignal | undefined => {
    if (this.abortControllers.has(cancelToken)) {
      const abortController = this.abortControllers.get(cancelToken);
      if (abortController) {
        return abortController.signal;
      }
      return void 0;
    }

    const abortController = new AbortController();
    this.abortControllers.set(cancelToken, abortController);
    return abortController.signal;
  };

  public abortRequest = (cancelToken: CancelToken) => {
    const abortController = this.abortControllers.get(cancelToken);

    if (abortController) {
      abortController.abort();
      this.abortControllers.delete(cancelToken);
    }
  };

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
      ((typeof secure === "boolean" ? secure : this.baseApiParams.secure) &&
        this.securityWorker &&
        (await this.securityWorker(this.securityData))) ||
      {};
    const requestParams = this.mergeRequestParams(params, secureParams);
    const queryString = query && this.toQueryString(query);
    const payloadFormatter = this.contentFormatters[type || ContentType.Json];
    const responseFormat = format || requestParams.format;

    return this.customFetch(
      `${baseUrl || this.baseUrl || ""}${path}${queryString ? `?${queryString}` : ""}`,
      {
        ...requestParams,
        headers: {
          ...(requestParams.headers || {}),
          ...(type && type !== ContentType.FormData
            ? { "Content-Type": type }
            : {}),
        },
        signal:
          (cancelToken
            ? this.createAbortSignal(cancelToken)
            : requestParams.signal) || null,
        body:
          typeof body === "undefined" || body === null
            ? null
            : payloadFormatter(body),
      },
    ).then(async (response) => {
      const r = response as HttpResponse<T, E>;
      r.data = null as unknown as T;
      r.error = null as unknown as E;

      const responseToParse = responseFormat ? response.clone() : response;
      const data = !responseFormat
        ? r
        : await responseToParse[responseFormat]()
            .then((data) => {
              if (r.ok) {
                r.data = data;
              } else {
                r.error = data;
              }
              return r;
            })
            .catch((e) => {
              r.error = e;
              return r;
            });

      if (cancelToken) {
        this.abortControllers.delete(cancelToken);
      }

      if (!response.ok) throw data;
      return data.data;
    });
  };
}

/**
 * @title LI.FI API
 * @version 1.0.0
 * @baseUrl https://li.quest
 *
 * LI.FI provides the best cross-chain swap across all liquidity pools and bridges.
 */
export class Api<SecurityDataType extends unknown> {
  http: HttpClient<SecurityDataType>;

  constructor(http: HttpClient<SecurityDataType>) {
    this.http = http;
  }

  v1 = {
    /**
     * @description This endpoint can be used to fetch all tokens known to the LI.FI services.
     *
     * @name TokensList
     * @summary Fetch all known tokens
     * @request GET:/v1/tokens
     */
    tokensList: (
      query?: {
        /**
         * Restrict the resulting tokens to the given chains
         * @example "POL,DAI"
         */
        chains?: string;
        /**
         * Restrict the resulting tokens to the given token tags (comma separated)
         * @example "stablecoin"
         */
        tags?: string;
        /**
         * Restrict the resulting tokens to the given chainTypes.
         * @example "EVM,SVM"
         */
        chainTypes?: string;
        /**
         * Filters results by minimum token price in USD. Minimum value for this parameter is 0. Defaults to 0.0001 USD.
         * @example 0.01
         */
        minPriceUSD?: number;
      },
      params: RequestParams = {},
    ) =>
      this.http.request<
        {
          /** The requested tokens */
          "1"?: Token[];
        },
        any
      >({
        path: `/v1/tokens`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * @description This endpoint can be used to get more information about a token by its address or symbol and its chain. If you want to learn more about how to use this endpoint please have a look at our [guide](/api-reference/fetch-information-about-a-token).
     *
     * @name TokenList
     * @summary Fetch information about a Token
     * @request GET:/v1/token
     */
    tokenList: (
      query: {
        /**
         * Id or key of the chain that contains the token
         * @example "POL"
         */
        chain: string;
        /**
         * Address or symbol of the token on the requested chain
         * @example "DAI"
         */
        token: string;
      },
      params: RequestParams = {},
    ) =>
      this.http.request<Token[], any>({
        path: `/v1/token`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * @description This endpoint can be used to request a quote for a transfer of one token to another, cross chain or not. The endpoint returns a `Step` object which contains information about the estimated result as well as a `transactionRequest` which can directly be sent to your wallet. The estimated result can be found inside the `estimate`, containing the estimated `toAmount` of the requested `Token` and the `toAmountMin`, which is the guaranteed minimum value that the transfer will yield including slippage. If you want to learn more about how to use this endpoint please have a look at our [guide](/introduction/user-flows-and-examples/requesting-route-fetching-quote).
     *
     * @name QuoteList
     * @summary Get a quote for a token transfer
     * @request GET:/v1/quote
     */
    quoteList: (
      query: {
        /**
         * The sending chain. Can be the chain id or chain key
         * @example "DAI"
         */
        fromChain: string;
        /**
         * The receiving chain. Can be the chain id or chain key
         * @example "POL"
         */
        toChain: string;
        /**
         * The token that should be transferred. Can be the address or the symbol
         * @example "0x4ecaba5870353805a9f068101a40e0f32ed605c6"
         */
        fromToken: string;
        /**
         * The token that should be transferred to. Can be the address or the symbol
         * @example "0x2791bca1f2de4661ed88a30c99a7a9449aa84174"
         */
        toToken: string;
        /**
         * The sending wallet address
         * @example "0x552008c0f6870c2f77e5cC1d2eb9bdff03e30Ea0"
         */
        fromAddress: string;
        /**
         * The receiving wallet address. If none is provided, the fromAddress will be used
         * @example "0x552008c0f6870c2f77e5cC1d2eb9bdff03e30Ea0"
         */
        toAddress?: string;
        /**
         * The amount that should be sent including all decimals (e.g. 1000000 for 1 USDC (6 decimals))
         * @example "1000000"
         */
        fromAmount: string;
        /** Which kind of route should be preferred **FASTEST**: This sorting criterion prioritizes routes with the shortest estimated execution time. Users who value speed and want their transactions to be completed as quickly as possible should choose the fastest routes. **CHEAPEST**: This criterion focuses on minimizing the cost of the transaction, whether in token amount or USD amount (USD amount minus gas cost). Users looking for the most economical option should choose the cheapest routes. */
        order?: "FASTEST" | "CHEAPEST";
        /**
         * The maximum allowed slippage for the transaction as a decimal value. 0.005 represents 0.5%.
         * @min 0
         * @max 1
         * @example 0.005
         */
        slippage?: number;
        /**
         * A string containing tracking information about the integrator of the API
         * @example "fee-demo"
         */
        integrator?: string;
        /**
         * The percent of the integrator's fee that is taken from every transaction. 0.02 represents 2%. The maximum fee amount should be less than 100%.
         * @min 0
         * @max 1
         * @exclusiveMax true
         * @example 0.02
         */
        fee?: number;
        /** A string containing tracking information about the referrer of the integrator */
        referrer?: string;
        /**
         * List of bridges that are allowed for this transaction. Retrieve the current catalog from the `/v1/tools` endpoint. Also values `all`, `none`, `default` and `[]` are acceptable and mean all tools of the current type (`all`), no tools (for `none` and `[]` cases) and default tool's settings on the current stage.
         * @example "hop,cbridge"
         */
        allowBridges?: QuoteBridgesEnum[];
        /** List of exchanges that are allowed for this transaction. Retrieve the current catalog from the `/v1/tools` endpoint. Also values `all`, `none`, `default` and `[]` are acceptable and mean all tools of the current type (`all`), no tools (for `none` and `[]` cases) and default tool's settings on the current stage. */
        allowExchanges?: QuoteExchangesEnum[];
        /**
         * List of bridges that are not allowed for this transaction. Retrieve the current catalog from the `/v1/tools` endpoint. Also values `all`, `none`, `default` and `[]` are acceptable and mean all tools of the current type (`all`), no tools (for `none` and `[]` cases) and default tool's settings on the current stage.
         * @example "relay"
         */
        denyBridges?: QuoteBridgesEnum[];
        /** List of exchanges that are not allowed for this transaction. Retrieve the current catalog from the `/v1/tools` endpoint. Also values `all`, `none`, `default` and `[]` are acceptable and mean all tools of the current type (`all`), no tools (for `none` and `[]` cases) and default tool's settings on the current stage. */
        denyExchanges?: QuoteExchangesEnum[];
        /** List of bridges that should be preferred for this transaction. Retrieve the current catalog from the `/v1/tools` endpoint. Also values `all`, `none`, `default` and `[]` are acceptable and mean all tools of the current type (`all`), no tools (for `none` and `[]` cases) and default tool's settings on the current stage. */
        preferBridges?: QuoteBridgesEnum[];
        /** List of exchanges that should be preferred for this transaction. Retrieve the current catalog from the `/v1/tools` endpoint. Also values `all`, `none`, `default` and `[]` are acceptable and mean all tools of the current type (`all`), no tools (for `none` and `[]` cases) and default tool's settings on the current stage. */
        preferExchanges?: QuoteExchangesEnum[];
        /** Whether swaps or other contract calls should be allowed as part of the destination transaction of a bridge transfer. Separate swap transactions on the destination chain are not affected by this flag. By default, parameter is `true`. */
        allowDestinationCall?: boolean;
        /** The amount of the token to convert to gas on the destination side. */
        fromAmountForGas?: string;
        /** The price impact threshold above which routes are hidden. As an example, one should specify 0.15 (15%) to hide routes with more than 15% price impact. The default is 10%. */
        maxPriceImpact?: number;
        /** Timing setting to wait for a certain amount of swap rates. In the format `minWaitTime-${minWaitTimeMs}-${startingExpectedResults}-${reduceEveryMs}`. Please check [docs.li.fi](https://docs.li.fi) for more details. */
        swapStepTimingStrategies?: string[];
        /** Timing setting to wait for a certain amount of routes to be generated before chosing the best one. In the format `minWaitTime-${minWaitTimeMs}-${startingExpectedResults}-${reduceEveryMs}`. Please check [docs.li.fi](https://docs.li.fi) for more details. */
        routeTimingStrategies?: string[];
        /** Parameter to skip transaction simulation. The quote will be returned faster but the transaction gas limit won't be accurate. */
        skipSimulation?: boolean;
        /**
         * Pre-configured routing optimization preset. The preset value `stablecoin` is supported for requesting swap and/or bridging operations involving stablecoin tokens. Each preset provides optimized default settings for slippage, price impact, and tool preferences that can be overridden by custom configuration parameters set in the request.
         * @minLength 1
         * @maxLength 50
         * @pattern ^[a-zA-Z0-9-_]+$
         * @example "stablecoin"
         */
        preset?: string;
        /** Priority fee level for Solana Virtual Machine (SVM) transactions. */
        svmPriorityFeeLevel?: "NORMAL" | "FAST" | "ULTRA";
      },
      params: RequestParams = {},
    ) =>
      this.http.request<
        Step,
        {
          /**
           * The error message
           * @example "Unable to find a quote for the requested transfer"
           */
          message?: string;
          errors?: object;
        }
      >({
        path: `/v1/quote`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * @description This endpoint is an alternative to the `v1/quote` endpoint, taking a `toAmount` value rather than `fromAmount`. This endpoint will calculate an appropriate `fromAmount` based on the specified `toAmount`, and use this value to generate the quote data. This endpoint can be used to request a quote for a transfer of one token to another, cross chain or not. The endpoint returns a `Step` object which contains information about the estimated result as well as a `transactionRequest` which can directly be sent to your wallet. The estimated result can be found inside the `estimate`, containing the estimated required `fromAmount` of the sending `Token` to meet the `toAmountMin` of the receiving token, which is the guaranteed minimum value that the transfer will yield including slippage. If you want to learn more about how to use this endpoint please have a look at our [guide](/introduction/user-flows-and-examples/requesting-route-fetching-quote).
     *
     * @name QuoteToAmountList
     * @summary Get a quote for a token transfer
     * @request GET:/v1/quote/toAmount
     */
    quoteToAmountList: (
      query: {
        /**
         * The sending chain. Can be the chain id or chain key
         * @example "DAI"
         */
        fromChain: string;
        /**
         * The receiving chain. Can be the chain id or chain key
         * @example "POL"
         */
        toChain: string;
        /**
         * The token that should be transferred. Can be the address or the symbol
         * @example "0x4ecaba5870353805a9f068101a40e0f32ed605c6"
         */
        fromToken: string;
        /**
         * The token that should be transferred to. Can be the address or the symbol
         * @example "0x2791bca1f2de4661ed88a30c99a7a9449aa84174"
         */
        toToken: string;
        /**
         * The sending wallet address
         * @example "0x552008c0f6870c2f77e5cC1d2eb9bdff03e30Ea0"
         */
        fromAddress: string;
        /**
         * The receiving wallet address. If none is provided, the fromAddress will be used
         * @example "0x552008c0f6870c2f77e5cC1d2eb9bdff03e30Ea0"
         */
        toAddress?: string;
        /**
         * The amount that will be received including all decimals (e.g. 1000000 for 1 USDC (6 decimals))
         * @example "1000000"
         */
        toAmount: string;
        /** Which kind of route should be preferred **FASTEST**: This sorting criterion prioritizes routes with the shortest estimated execution time. Users who value speed and want their transactions to be completed as quickly as possible should choose the fastest routes. **CHEAPEST**: This criterion focuses on minimizing the cost of the transaction, whether in token amount or USD amount (USD amount minus gas cost). Users looking for the most economical option should choose the cheapest routes. */
        order?: "FASTEST" | "CHEAPEST";
        /**
         * The maximum allowed slippage for the transaction as a decimal value. 0.005 represents 0.5%.
         * @min 0
         * @max 1
         * @example 0.005
         */
        slippage?: number;
        /**
         * A string containing tracking information about the integrator of the API
         * @example "fee-demo"
         */
        integrator?: string;
        /**
         * The percent of the integrator's fee that is taken from every transaction. 0.02 represents 2%. The maximum fee amount should be less than 100%.
         * @min 0
         * @max 1
         * @exclusiveMax true
         * @example 0.02
         */
        fee?: number;
        /** A string containing tracking information about the referrer of the integrator */
        referrer?: string;
        /**
         * List of bridges that are allowed for this transaction. Retrieve the current catalog from the `/v1/tools` endpoint. Also values `all`, `none`, `default` and `[]` are acceptable and mean all tools of the current type (`all`), no tools (for `none` and `[]` cases) and default tool's settings on the current stage.
         * @example "hop,cbridge"
         */
        allowBridges?: QuoteBridgesEnum[];
        /** List of exchanges that are allowed for this transaction. Retrieve the current catalog from the `/v1/tools` endpoint. Also values `all`, `none`, `default` and `[]` are acceptable and mean all tools of the current type (`all`), no tools (for `none` and `[]` cases) and default tool's settings on the current stage. */
        allowExchanges?: QuoteExchangesEnum[];
        /**
         * List of bridges that are not allowed for this transaction. Retrieve the current catalog from the `/v1/tools` endpoint. Also values `all`, `none`, `default` and `[]` are acceptable and mean all tools of the current type (`all`), no tools (for `none` and `[]` cases) and default tool's settings on the current stage.
         * @example "relay"
         */
        denyBridges?: QuoteBridgesEnum[];
        /** List of exchanges that are not allowed for this transaction. Retrieve the current catalog from the `/v1/tools` endpoint. Also values `all`, `none`, `default` and `[]` are acceptable and mean all tools of the current type (`all`), no tools (for `none` and `[]` cases) and default tool's settings on the current stage. */
        denyExchanges?: QuoteExchangesEnum[];
        /** List of bridges that should be preferred for this transaction. Retrieve the current catalog from the `/v1/tools` endpoint. Also values `all`, `none`, `default` and `[]` are acceptable and mean all tools of the current type (`all`), no tools (for `none` and `[]` cases) and default tool's settings on the current stage. */
        preferBridges?: QuoteBridgesEnum[];
        /** List of exchanges that should be preferred for this transaction. Retrieve the current catalog from the `/v1/tools` endpoint. Also values `all`, `none`, `default` and `[]` are acceptable and mean all tools of the current type (`all`), no tools (for `none` and `[]` cases) and default tool's settings on the current stage. */
        preferExchanges?: QuoteExchangesEnum[];
        /** Whether swaps or other contract calls should be allowed as part of the destination transaction of a bridge transfer. Separate swap transactions on the destination chain are not affected by this flag. By default, parameter is `true`. */
        allowDestinationCall?: boolean;
        /** The price impact threshold above which routes are hidden. As an example, one should specify 0.15 (15%) to hide routes with more than 15% price impact. The default is 10%. */
        maxPriceImpact?: number;
        /** Timing setting to wait for a certain amount of swap rates. In the format `minWaitTime-${minWaitTimeMs}-${startingExpectedResults}-${reduceEveryMs}`. Please check [docs.li.fi](https://docs.li.fi) for more details. */
        swapStepTimingStrategies?: string[];
        /** Timing setting to wait for a certain amount of routes to be generated before chosing the best one. In the format `minWaitTime-${minWaitTimeMs}-${startingExpectedResults}-${reduceEveryMs}`. Please check [docs.li.fi](https://docs.li.fi) for more details. */
        routeTimingStrategies?: string[];
        /** Priority fee level for Solana Virtual Machine (SVM) transactions. */
        svmPriorityFeeLevel?: "NORMAL" | "FAST" | "ULTRA";
      },
      params: RequestParams = {},
    ) =>
      this.http.request<
        Step,
        {
          /**
           * The error message
           * @example "Unable to find a quote for the requested transfer"
           */
          message?: string;
          errors?: object;
        }
      >({
        path: `/v1/quote/toAmount`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * @description This endpoint has been deprecated in favour of /quote/contractCalls.
     *
     * @name QuoteContractCallCreate
     * @summary Perform a contract call across blockchains (BETA)
     * @request POST:/v1/quote/contractCall
     * @deprecated
     */
    quoteContractCallCreate: (
      data: ContractCallRequest,
      params: RequestParams = {},
    ) =>
      this.http.request<Tools, any>({
        path: `/v1/quote/contractCall`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description This endpoint can be used to bridge tokens, swap them and perform a number or arbitrary contract calls on the destination chain. You can find an example of it [here](https://github.com/lifinance/sdk/tree/main/examples). This functionality is currently in beta. While we've worked hard to ensure its stability and functionality, there might still be some rough edges.
     *
     * @name QuoteContractCallsCreate
     * @summary Perform multiple contract calls across blockchains (BETA)
     * @request POST:/v1/quote/contractCalls
     */
    quoteContractCallsCreate: (
      data: ContractCallsRequest,
      params: RequestParams = {},
    ) =>
      this.http.request<Tools, any>({
        path: `/v1/quote/contractCalls`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Cross chain transfers might take a while to complete. Waiting on the transaction on the sending chain doesn't help here. For this reason we build a simple endpoint that let's you check the status of your transfer. Important: The endpoint returns a `200` successful response even if the transaction can not be found. This behavior accounts for the case that the transaction hash is valid but the transaction has not been mined yet. While none of the parameters `fromChain`, `toChain` and `bridge` are required, passing the `fromChain` parameter will speed up the request and is therefore encouraged. If you want to learn more about how to use this endpoint please have a look at our [guide](/introduction/user-flows-and-examples/status-tracking).
     *
     * @name StatusList
     * @summary Check the status of a cross chain transfer
     * @request GET:/v1/status
     */
    statusList: (
      query: {
        /**
         * The transaction hash on the sending chain, destination chain or lifi step id
         * @example "0xe1ffdcf09d5aa92a2d89b1b39db3f8cadf09428a296cce0d5e387595ac83d08f"
         */
        txHash: string;
        /**
         * The bridging tool used for the transfer
         * @example "stargateV2"
         */
        bridge?: BridgesEnum;
        /**
         * The sending chain. Can be the chain id or chain key
         * @example "OPT"
         */
        fromChain?: string;
        /**
         * The receiving chain. Can be the chain id or chain key
         * @example "ARB"
         */
        toChain?: string;
      },
      params: RequestParams = {},
    ) =>
      this.http.request<StatusResponse, any>({
        path: `/v1/status`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * @description This endpoint can be used to request all integrator's collected fees data by tokens for all supported chains. The endpoint returns an `Integrator` object which contains the integrator id and an array of fee balances for all supported chains.
     *
     * @name IntegratorsDetail
     * @summary Get integrator's collected fees data for all supported chains
     * @request GET:/v1/integrators/{integratorId}
     */
    integratorsDetail: (integratorId: string, params: RequestParams = {}) =>
      this.http.request<IntegratorResponse, any>({
        path: `/v1/integrators/${integratorId}`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * @description This endpoint can be used to get transaction request for withdrawing integrator's collected fees the specified chain. If a list of token addresses is provided, the generated transaction will only withdraw the specified funds. If there is no collected fees for the provided token's addresses, the `400` error will be thrown. The endpoint returns a `IntegratorWithdrawalTransactionResponse` object which contains the transaction request.
     *
     * @name IntegratorsWithdrawDetail
     * @summary Get transaction request for withdrawing collected integrator's fees by chain
     * @request GET:/v1/integrators/{integratorId}/withdraw/{chainId}
     */
    integratorsWithdrawDetail: (
      integratorId: string,
      chainId: string,
      query?: {
        /**
         * Specify tokens from which funds should be withdraw
         * @example ["0x0000000000000000000000000000000000000000"]
         */
        tokenAddresses?: string[];
      },
      params: RequestParams = {},
    ) =>
      this.http.request<IntegratorWithdrawalResponse, any>({
        path: `/v1/integrators/${integratorId}/withdraw/${chainId}`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name DescriptionV1
     * @request DESCRIPTION:/v1/advanced/possibilities
     */
    descriptionV1: (params: RequestParams = {}) =>
      this.http.request<any, any>({
        path: `/v1/advanced/possibilities`,
        method: "DESCRIPTION",
        format: "json",
        ...params,
      }),

    /**
     * @description Get a set of current possibilities based on a request that specifies which chains, exchanges and bridges are preferred or unwanted. **Attention**: This request is more complex and intended to be used via our [JavaScript SDK](https://docs.li.fi/integrate-li.fi-js-sdk/install-li.fi-sdk).
     *
     * @tags advanced
     * @name AdvancedPossibilitiesCreate
     * @summary Get information about available services, chains and tokens
     * @request POST:/v1/advanced/possibilities
     * @deprecated
     */
    advancedPossibilitiesCreate: (
      data: PossibilitiesRequest,
      params: RequestParams = {},
    ) =>
      this.http.request<PossibilitiesResponse, any>({
        path: `/v1/advanced/possibilities`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description In order to execute any transfer, you must first request possible `Routes`. From the result set a `Route` can be selected and executed by retrieving the transaction for every included `Step` using the `/steps/transaction` endpoint. **Attention**: This request is more complex and intended to be used via our [JavaScript SDK](https://docs.li.fi/integrate-li.fi-js-sdk/install-li.fi-sdk).
     *
     * @tags advanced
     * @name AdvancedRoutesCreate
     * @summary Get a set of routes for a request that describes a transfer of tokens
     * @request POST:/v1/advanced/routes
     */
    advancedRoutesCreate: (data: RoutesRequest, params: RequestParams = {}) =>
      this.http.request<RoutesResponse, any>({
        path: `/v1/advanced/routes`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description This endpoint expects a full `Step` object which usually is retrieved by calling the `/advanced/routes` endpoint and selecting the most suitable `Route`. Afterwards the transaction for every required `Step` can be retrieved using this endpoint. **Attention**: This request is more complex and intended to be used via our [JavaScript SDK](https://docs.li.fi/integrate-li.fi-js-sdk/install-li.fi-sdk).
     *
     * @tags advanced
     * @name AdvancedStepTransactionCreate
     * @summary Populate a step with transaction data
     * @request POST:/v1/advanced/stepTransaction
     */
    advancedStepTransactionCreate: (
      data: Step,
      query?: {
        /** Parameter to skip transaction simulation. The quote will be returned faster but the transaction gas limit won't be accurate. */
        skipSimulation?: boolean;
        /** Mayan specific option to bridge from non-EVM chain to Hyperliquid */
        mayanNonEvmPermitSignature?: boolean;
        /** Priority fee level for Solana Virtual Machine (SVM) transactions. */
        svmPriorityFeeLevel?: "NORMAL" | "FAST" | "ULTRA";
      },
      params: RequestParams = {},
    ) =>
      this.http.request<Step, any>({
        path: `/v1/advanced/stepTransaction`,
        method: "POST",
        query: query,
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description If you want to learn more about how to use this endpoint please have a look at our [guide](/sdk/chains-tools).
     *
     * @name ChainsList
     * @summary Get information about all currently supported chains
     * @request GET:/v1/chains
     */
    chainsList: (
      query?: {
        /**
         * Restrict the resulting tokens to the given chainTypes.
         * @example "EVM,SVM"
         */
        chainTypes?: string;
      },
      params: RequestParams = {},
    ) =>
      this.http.request<ChainsResponse, any>({
        path: `/v1/chains`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * @description This endpoint gives information about all possible transfers between chains. `fromChain` and `toChain` are required. Additional filters such as token, bridge, and exchange can be used to narrow the result further. Information about which chains and tokens are supported can be taken from the response of the /v1/chains endpoint. Information about which bridges and exchanges are supported can be taken from the response of the `/v1/tools` endpoint.
     *
     * @name ConnectionsList
     * @summary Returns all possible connections between two chains.
     * @request GET:/v1/connections
     */
    connectionsList: (
      query: {
        /**
         * The chain that should be the start of the possible connections.
         * @example "POL"
         */
        fromChain: string;
        /** The chain that should be the end of the possible connections. */
        toChain: string;
        /**
         * Only return connections starting with this token.
         * @example "DAI"
         */
        fromToken?: string;
        /** Only return connections ending with this token. */
        toToken?: string;
        /**
         * Restrict the resulting tokens to the given chainTypes.
         * @example "EVM,SVM"
         */
        chainTypes?: string;
        /** List of bridges that are allowed for this transaction. Retrieve the current catalog from the `/v1/tools` endpoint. */
        allowBridges?: string[];
        /** List of bridges that are not allowed for this transaction. Retrieve the current catalog from the `/v1/tools` endpoint. */
        denyBridges?: string[];
        /** List of bridges that should be preferred for this transaction. Retrieve the current catalog from the `/v1/tools` endpoint. */
        preferBridges?: string[];
        /** List of exchanges that are allowed for this transaction. Retrieve the current catalog from the `/v1/tools` endpoint. */
        allowExchanges?: string[];
        /** List of exchanges that are not allowed for this transaction. Retrieve the current catalog from the `/v1/tools` endpoint. */
        denyExchanges?: string[];
        /** List of exchanges that should be preferred for this transaction. Retrieve the current catalog from the `/v1/tools` endpoint. */
        preferExchanges?: string[];
        /**
         * Whether connections that require chain switch should be included in the response.
         * @default true
         */
        allowSwitchChain?: boolean;
        /**
         * Whether connections that includes destination call should be included in the response.
         * @default true
         */
        allowDestinationCall?: boolean;
      },
      params: RequestParams = {},
    ) =>
      this.http.request<ConnectionsResponse, any>({
        path: `/v1/connections`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * @description This endpoint can be used to get information about the bridges and exchanges available trough our service
     *
     * @name ToolsList
     * @summary Get available bridges and exchanges
     * @request GET:/v1/tools
     */
    toolsList: (
      query?: {
        /** The ids of the chains that should be taken into consideration. */
        chains?: (string | number)[];
      },
      params: RequestParams = {},
    ) =>
      this.http.request<Tools, any>({
        path: `/v1/tools`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * @description This endpoint can be used to get the most recent gas prices for the enabled chains in the server.
     *
     * @tags gas
     * @name GasPricesList
     * @summary Get gas prices for enabled chains
     * @request GET:/v1/gas/prices
     */
    gasPricesList: (params: RequestParams = {}) =>
      this.http.request<GasPrice, any>({
        path: `/v1/gas/prices`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * @description This endpoint can be used to get the most recent gas prices for the supplied chainId.
     *
     * @tags gas
     * @name GasPricesDetail
     * @summary Get gas price for the specified chainId
     * @request GET:/v1/gas/prices/{chainId}
     */
    gasPricesDetail: (chainId: string, params: RequestParams = {}) =>
      this.http.request<GasPrice, any>({
        path: `/v1/gas/prices/${chainId}`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name GasStatusList
     * @summary Get status information about a lifuel transaction
     * @request GET:/v1/gas/status
     */
    gasStatusList: (
      query: {
        /**
         * The transaction hash that started the gas refilling process
         * @example "0x74546ce8aac58d33c212474293dcfeeadecef115847da75131a2ff6692e03b96"
         */
        txHash: string;
      },
      params: RequestParams = {},
    ) =>
      this.http.request<LIFuelStatus, any>({
        path: `/v1/gas/status`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name GasRefetchList
     * @summary In case a transaction was missed by a relayer, this endpoint can be used to force a tx to be re-fetched.
     * @request GET:/v1/gas/refetch
     * @deprecated
     */
    gasRefetchList: (
      query: {
        /**
         * The transaction hash that started the gas refilling process
         * @example "0x74546ce8aac58d33c212474293dcfeeadecef115847da75131a2ff6692e03b96"
         */
        txHash: string;
        /**
         * The chain where the deposit was originally made
         * @example "POL"
         */
        chainId: string;
      },
      params: RequestParams = {},
    ) =>
      this.http.request<LIFuelStatus, any>({
        path: `/v1/gas/refetch`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * @description This endpoint can be used to get all transactions for a wallet.
     *
     * @name AnalyticsWalletsDetail
     * @summary Get all transactions for a wallet
     * @request GET:/v1/analytics/wallets/{wallet_address}
     * @deprecated
     */
    analyticsWalletsDetail: (
      walletAddress: string,
      query: {
        /** Filter the transactions by integrator */
        integrator: string;
        /** A unix timestamp in seconds. No transaction older than this timestamp will be returned. If no value is passed, then the default value will be 30 days prior the current date. */
        fromTimestamp?: number;
        /** A unix timestamp in seconds. No transaction newer than this timestamp will be returned. */
        toTimestamp?: number;
      },
      params: RequestParams = {},
    ) =>
      this.http.request<void, any>({
        path: `/v1/analytics/wallets/${walletAddress}`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * @description Endpoint to retrieve a suggestion on how much gas is needed on the requested chain. The suggestion is based on the average price of 10 approvals and 10 uniswap based swaps via LI.FI on the specified chain. If `fromChain` and `fromToken` are specified, the result will contain information about how much `fromToken` amount the user has to send to receive the suggested gas amount on the requested chain.
     *
     * @name GasSuggestionDetail
     * @summary Get a gas suggestion for the specified chain
     * @request GET:/v1/gas/suggestion/{chain}
     */
    gasSuggestionDetail: (
      chain: string,
      query?: {
        /**
         * If `fromChain` and `fromToken` are specified, the result will contain information about how much `fromToken` amount the user has to send to receive the suggested gas amount on the requested chain.
         * @example 100
         */
        fromChain?: string;
        /**
         * If `fromChain` and `fromToken` are specified, the result will contain information about how much `fromToken` amount the user has to send to receive the suggested gas amount on the requested chain.
         * @example "xDai"
         */
        fromToken?: string;
      },
      params: RequestParams = {},
    ) =>
      this.http.request<any, any>({
        path: `/v1/gas/suggestion/${chain}`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * @description This endpoint allows to pass transaction call data. It will then parse the call data based on known and on-chain ABIs to provide a JSON overview of the internal transaction information.
     *
     * @name CalldataParseList
     * @summary Parse transaction call data (BETA)
     * @request GET:/v1/calldata/parse
     */
    calldataParseList: (
      query: {
        /** The chainId that the transaction is built for (or has been sent on) */
        chainId?: string;
        /** The call data to parse */
        callData: string;
      },
      params: RequestParams = {},
    ) =>
      this.http.request<any, any>({
        path: `/v1/calldata/parse`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * @description This endpoint can be used to retrieve a list of transfers filtered by certain properties. Returns a maximum of 1000 transfers.
     *
     * @name AnalyticsTransfersList
     * @summary Get a list of filtered transfers
     * @request GET:/v1/analytics/transfers
     */
    analyticsTransfersList: (
      query?: {
        /** The integrator string to filter by */
        integrator?: string;
        /** The sending OR receiving wallet address  */
        wallet?: string;
        /** The status of the transfers. Possible values are `ALL`, `DONE`, `PENDING`, and `FAILED`. The default is `DONE` */
        status?: string;
        /** The oldest timestamp that should be taken into consideration. Defaults to 30 days ago */
        fromTimestamp?: number;
        /** The newest timestamp that should be taken into consideration. Defaults to now */
        toTimestamp?: number;
        /** The chain where the transfer originates from. */
        fromChain?: string;
        /** The chain where the transfer ends. */
        toChain?: string;
        /** The token transferred from the originating chain. To use this parameter `fromChain` must be set. */
        fromToken?: string;
        /** The token received on the destination chain. To use this parameter `toChain` must be set. */
        toToken?: string;
      },
      params: RequestParams = {},
    ) =>
      this.http.request<
        {
          transfers?: StatusResponse[];
        },
        any
      >({
        path: `/v1/analytics/transfers`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * @description Calculates and returns the total received token amount per wallet address, per sending chain, within a specified time range, for a given receiving chain and receiving token. Only aggregates cross-chain transfers, meaning transfers with distinct sending and receiving chains.
     *
     * @name AnalyticsTransfersSummaryList
     * @summary Get the total amount of a token received on a specific chain, for cross-chain transfers.
     * @request GET:/v1/analytics/transfers/summary
     */
    analyticsTransfersSummaryList: (
      query: {
        /**
         * Pagination limit. Defines the maximum number of returned results.
         * @default 10
         */
        limit?: number;
        /** The next page cursor. Must come from the `next` field of the response of the previous request. */
        next?: string;
        /** The previous page cursor. Must come from the `previous` field of the response of the previous request. */
        previous?: string;
        /** A Unix timestamp in seconds marking the start of the query period, inclusive. Transactions older than this timestamp will not be included in the summary. */
        fromTimestamp: string;
        /** A Unix timestamp in seconds marking the end of the query period, inclusive. Transactions after this timestamp will not be included in the summary. **The maximum range supported by the endpoint is 30 days.** */
        toTimestamp: string;
        /** The ID, or key of the chain on the receiving side of the transfer. This parameter filters the summary to include only transfers received on the specified chain. */
        toChain: string;
        /** The address, or symbol of the token received in the transfers. This parameter filters the summary to include only transfers involving the specified token on the receiving chain. */
        toToken: number;
        /** The ID, or key of the chain on the sending side of the transfers. This parameter filters the summary to include only transfers sent from the specified chain. */
        fromChain?: number;
        /** The integrator string to filter transfers by. This parameter filters the summary to include only transfers for the given integrator. */
        integrator?: string;
      },
      params: RequestParams = {},
    ) =>
      this.http.request<
        PaginatedResult & {
          data?: TransfersSummaryResult[];
        },
        any
      >({
        path: `/v1/analytics/transfers/summary`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * @description Cross chain relay transfers might take a while to complete. Waiting on the transaction on the sending chain doesn't help here. For this reason we build a simple endpoint that let's you check the status of your transfer. Important: The endpoint returns a `200` successful response even if the transaction can not be found. This behavior accounts for the case that the transaction hash is valid but the transaction has not been mined yet. While non of the parameters `fromChain`, `toChain` and `bridge` are required, passing the `fromChain` parameter will speed up the request and is therefore encouraged. If you want to learn more about how to use this endpoint please have a look at our [guide](/introduction/user-flows-and-examples/status-tracking).
     *
     * @name RelayerStatusDetail
     * @request GET:/v1/relayer/status/{taskId}
     */
    relayerStatusDetail: (taskId: string, params: RequestParams = {}) =>
      this.http.request<RelayTransactionStatusResponse, any>({
        path: `/v1/relayer/status/${taskId}`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * @description This endpoint can be used to request a quote for a transfer of one token to another, cross chain or not. The endpoint returns a `Step` object which contains information about the estimated result as well as a `transactionRequest` which can directly be sent to your wallet. The estimated result can be found inside the `estimate`, containing the estimated `toAmount` of the requested `Token` and the `toAmountMin`, which is the guaranteed minimum value that the transfer will yield including slippage. If you want to learn more about how to use this endpoint please have a look at our [guide](/introduction/user-flows-and-examples/requesting-route-fetching-quote).
     *
     * @name RelayerQuoteList
     * @summary Get a quote for a relayed token transfer
     * @request GET:/v1/relayer/quote
     */
    relayerQuoteList: (
      query: {
        /**
         * The sending chain. Can be the chain id or chain key
         * @example "DAI"
         */
        fromChain: string;
        /**
         * The receiving chain. Can be the chain id or chain key
         * @example "POL"
         */
        toChain: string;
        /**
         * The token that should be transferred. Can be the address or the symbol
         * @example "0x4ecaba5870353805a9f068101a40e0f32ed605c6"
         */
        fromToken: string;
        /**
         * The token that should be transferred to. Can be the address or the symbol
         * @example "0x2791bca1f2de4661ed88a30c99a7a9449aa84174"
         */
        toToken: string;
        /**
         * The sending wallet address
         * @example "0x552008c0f6870c2f77e5cC1d2eb9bdff03e30Ea0"
         */
        fromAddress: string;
        /**
         * The receiving wallet address. If none is provided, the fromAddress will be used
         * @example "0x552008c0f6870c2f77e5cC1d2eb9bdff03e30Ea0"
         */
        toAddress?: string;
        /**
         * The amount that should be sent including all decimals (e.g. 1000000 for 1 USDC (6 decimals))
         * @example "1000000"
         */
        fromAmount: string;
        /** Which kind of route should be preferred **FASTEST**: This sorting criterion prioritizes routes with the shortest estimated execution time. Users who value speed and want their transactions to be completed as quickly as possible should choose the fastest routes. **CHEAPEST**: This criterion focuses on minimizing the cost of the transaction, whether in token amount or USD amount (USD amount minus gas cost). Users looking for the most economical option should choose the cheapest routes. */
        order?: "FASTEST" | "CHEAPEST";
        /**
         * The maximum allowed slippage for the transaction as a decimal value. 0.005 represents 0.5%.
         * @min 0
         * @max 1
         * @example 0.005
         */
        slippage?: number;
        /**
         * A string containing tracking information about the integrator of the API
         * @example "fee-demo"
         */
        integrator?: string;
        /**
         * The percent of the integrator's fee that is taken from every transaction. 0.02 represents 2%. The maximum fee amount should be less than 100%.
         * @min 0
         * @max 1
         * @exclusiveMax true
         * @example 0.02
         */
        fee?: number;
        /** A string containing tracking information about the referrer of the integrator */
        referrer?: string;
        /**
         * List of bridges that are allowed for this transaction. Retrieve the current catalog from the `/v1/tools` endpoint. Also values `all`, `none`, `default` and `[]` are acceptable and mean all tools of the current type (`all`), no tools (for `none` and `[]` cases) and default tool's settings on the current stage.
         * @example "hop,cbridge"
         */
        allowBridges?: QuoteBridgesEnum[];
        /** List of exchanges that are allowed for this transaction. Retrieve the current catalog from the `/v1/tools` endpoint. Also values `all`, `none`, `default` and `[]` are acceptable and mean all tools of the current type (`all`), no tools (for `none` and `[]` cases) and default tool's settings on the current stage. */
        allowExchanges?: QuoteExchangesEnum[];
        /**
         * List of bridges that are not allowed for this transaction. Retrieve the current catalog from the `/v1/tools` endpoint. Also values `all`, `none`, `default` and `[]` are acceptable and mean all tools of the current type (`all`), no tools (for `none` and `[]` cases) and default tool's settings on the current stage.
         * @example "relay"
         */
        denyBridges?: QuoteBridgesEnum[];
        /** List of exchanges that are not allowed for this transaction. Retrieve the current catalog from the `/v1/tools` endpoint. Also values `all`, `none`, `default` and `[]` are acceptable and mean all tools of the current type (`all`), no tools (for `none` and `[]` cases) and default tool's settings on the current stage. */
        denyExchanges?: QuoteExchangesEnum[];
        /** List of bridges that should be preferred for this transaction. Retrieve the current catalog from the `/v1/tools` endpoint. Also values `all`, `none`, `default` and `[]` are acceptable and mean all tools of the current type (`all`), no tools (for `none` and `[]` cases) and default tool's settings on the current stage. */
        preferBridges?: QuoteBridgesEnum[];
        /** List of exchanges that should be preferred for this transaction. Retrieve the current catalog from the `/v1/tools` endpoint. Also values `all`, `none`, `default` and `[]` are acceptable and mean all tools of the current type (`all`), no tools (for `none` and `[]` cases) and default tool's settings on the current stage. */
        preferExchanges?: QuoteExchangesEnum[];
        /** Whether swaps or other contract calls should be allowed as part of the destination transaction of a bridge transfer. Separate swap transactions on the destination chain are not affected by this flag. By default, parameter is `true`. */
        allowDestinationCall?: boolean;
        /** The amount of the token to convert to gas on the destination side. */
        fromAmountForGas?: string;
        /** The price impact threshold above which routes are hidden. As an example, one should specify 0.15 (15%) to hide routes with more than 15% price impact. The default is 10%. */
        maxPriceImpact?: number;
        /** Timing setting to wait for a certain amount of swap rates. In the format `minWaitTime-${minWaitTimeMs}-${startingExpectedResults}-${reduceEveryMs}`. Please check [docs.li.fi](https://docs.li.fi) for more details. */
        swapStepTimingStrategies?: string[];
        /** Timing setting to wait for a certain amount of routes to be generated before chosing the best one. In the format `minWaitTime-${minWaitTimeMs}-${startingExpectedResults}-${reduceEveryMs}`. Please check [docs.li.fi](https://docs.li.fi) for more details. */
        routeTimingStrategies?: string[];
        /** Parameter to skip transaction simulation. The quote will be returned faster but the transaction gas limit won't be accurate. */
        skipSimulation?: boolean;
      },
      params: RequestParams = {},
    ) =>
      this.http.request<
        RelayQuoteResponse,
        {
          /**
           * The error message
           * @example "Unable to find a quote for the requested transfer"
           */
          message?: string;
          errors?: object;
        }
      >({
        path: `/v1/relayer/quote`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * @description Submits a gasless transaction to the relayer for execution on-chain.
     *
     * @name RelayerRelayCreate
     * @summary Send a signed permit2 transaction to be dispatched by a transaction relayer
     * @request POST:/v1/relayer/relay
     */
    relayerRelayCreate: (
      data: RelayRequestSchema,
      params: RequestParams = {},
    ) =>
      this.http.request<RelayResponse, any>({
        path: `/v1/relayer/relay`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),
  };
  v2 = {
    /**
     * @description A paginated version of the `GET /v1/analytics/transfers endpoint`. This endpoint can be used to retrieve a list of transfers filtered by certain properties.
     *
     * @name AnalyticsTransfersList
     * @summary Get a paginated list of filtered transfers
     * @request GET:/v2/analytics/transfers
     */
    analyticsTransfersList: (
      query?: {
        /**
         * Pagination limit. Defines the maximum number of returned results.
         * @default 10
         */
        limit?: number;
        /** The next page cursor. Must come from the `next` field of the response of the previous request. */
        next?: string;
        /** The previous page cursor. Must come from the `previous` field of the response of the previous request. */
        previous?: string;
        /** Either a single integrator string, or an array of unique integrator strings to filter transfers by. */
        integrator?: string | string[];
        /** The sending OR receiving wallet address  */
        wallet?: string;
        /** The status of the transfers. Possible values are `ALL`, `DONE`, `PENDING`, and `FAILED`. The default is `DONE` */
        status?: string;
        /** The oldest timestamp that should be taken into consideration. Defaults to 30 days ago */
        fromTimestamp?: number;
        /** The newest timestamp that should be taken into consideration. Defaults to now */
        toTimestamp?: number;
        /** The chain where the transfer originates from. */
        fromChain?: string;
        /** The chain where the transfer ends. */
        toChain?: string;
        /** The token transferred from the originating chain. To use this parameter `fromChain` must be set. */
        fromToken?: string;
        /** The token received on the destination chain. To use this parameter `toChain` must be set. */
        toToken?: string;
      },
      params: RequestParams = {},
    ) =>
      this.http.request<
        PaginatedResult & {
          data?: StatusResponse[];
        },
        any
      >({
        path: `/v2/analytics/transfers`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),
  };
}
