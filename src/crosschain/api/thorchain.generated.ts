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

export interface Pool {
    /** @example "BTC.BTC" */
    asset: string
    /** @example "b" */
    short_code?: string
    /** @example "Available" */
    status: string
    /**
     * @format int64
     * @example 6
     */
    decimals?: number
    /** @example "101713319" */
    pending_inbound_asset: string
    /** @example "464993836" */
    pending_inbound_rune: string
    /** @example "3197744873" */
    balance_asset: string
    /** @example "13460619152985" */
    balance_rune: string
    /**
     * the USD (TOR) price of the asset in 1e8
     * @example "123456"
     */
    asset_tor_price: string
    /**
     * the total pool units, this is the sum of LP and synth units
     * @example "14694928607473"
     */
    pool_units: string
    /**
     * the total pool liquidity provider units
     * @example "14694928607473"
     */
    LP_units: string
    /**
     * the total synth units in the pool
     * @example "0"
     */
    synth_units: string
    /**
     * the total supply of synths for the asset
     * @example "0"
     */
    synth_supply: string
    /**
     * the balance of L1 asset deposited into the Savers Vault
     * @example "199998"
     */
    savers_depth: string
    /**
     * the number of units owned by Savers
     * @example "199998"
     */
    savers_units: string
    /**
     * the filled savers capacity in basis points, 4500/10000 = 45%
     * @example "4500"
     */
    savers_fill_bps: string
    /**
     * amount of remaining capacity in asset
     * @example "1000"
     */
    savers_capacity_remaining: string
    /**
     * whether additional synths cannot be minted
     * @example true
     */
    synth_mint_paused: boolean
    /**
     * the amount of synth supply remaining before the current max supply is reached
     * @example "123456"
     */
    synth_supply_remaining: string
    /**
     * the depth of the derived virtual pool relative to L1 pool (in basis points)
     * @example "123456"
     */
    derived_depth_bps: string
    /**
     * indicates if the pool can be used for swaps
     * @example false
     */
    trading_halted?: boolean
    /**
     * 24h volume in asset
     * @example "123456"
     */
    volume_asset?: string
    /**
     * 24h volume in rune
     * @example "123456"
     */
    volume_rune?: string
}

export interface DerivedPool {
    /** @example "BTC.BTC" */
    asset: string
    /** @example "Available" */
    status: string
    /**
     * @format int64
     * @example 6
     */
    decimals?: number
    /** @example "3197744873" */
    balance_asset: string
    /** @example "13460619152985" */
    balance_rune: string
    /**
     * the depth of the derived virtual pool relative to L1 pool (in basis points)
     * @example "123456"
     */
    derived_depth_bps: string
}

export interface POL {
    /**
     * total amount of RUNE deposited into the pools
     * @example "857134475040"
     */
    rune_deposited: string
    /**
     * total amount of RUNE withdrawn from the pools
     * @example "0"
     */
    rune_withdrawn: string
    /**
     * total value of protocol's LP position in RUNE value
     * @example "21999180112172346"
     */
    value: string
    /**
     * profit and loss of protocol owned liquidity
     * @example "21999180112172346"
     */
    pnl: string
    /**
     * current amount of rune deposited
     * @example "21999180112172346"
     */
    current_deposit: string
}

export interface RUNEProvider {
    /** @example "THOR.RUNE" */
    rune_address: string
    /** @example "1234" */
    units: string
    /** @example "123456" */
    value: string
    /** @example "123456" */
    pnl: string
    /** @example "6677" */
    deposit_amount: string
    /** @example "5443" */
    withdraw_amount: string
    /**
     * @format int64
     * @example 82745
     */
    last_deposit_height: number
    /**
     * @format int64
     * @example 82745
     */
    last_withdraw_height: number
}

export interface LiquidityProviderSummary {
    /** @example "BTC.BTC" */
    asset: string
    /** @example "thor1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" */
    rune_address?: string
    /** @example "bc1qn9esxuw8ca7ts8l6w66kdh800s09msvutydc46" */
    asset_address?: string
    /**
     * @format int64
     * @example 82745
     */
    last_add_height?: number
    /**
     * @format int64
     * @example 82745
     */
    last_withdraw_height?: number
    /** @example "0" */
    units: string
    /** @example "0" */
    pending_rune: string
    /** @example "242000000" */
    pending_asset: string
    /** @example "C4C876802xxxxxxxxxxBC408829878446A37011EBBA0C5CAA3DD64A548879CB228" */
    pending_tx_id?: string
    /** @example "0" */
    rune_deposit_value: string
    /** @example "0" */
    asset_deposit_value: string
}

export interface LiquidityProvider {
    /** @example "BTC.BTC" */
    asset: string
    /** @example "thor1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" */
    rune_address?: string
    /** @example "bc1qn9esxuw8ca7ts8l6w66kdh800s09msvutydc46" */
    asset_address?: string
    /**
     * @format int64
     * @example 82745
     */
    last_add_height?: number
    /**
     * @format int64
     * @example 82745
     */
    last_withdraw_height?: number
    /** @example "0" */
    units: string
    /** @example "0" */
    pending_rune: string
    /** @example "242000000" */
    pending_asset: string
    /** @example "C4C876802xxxxxxxxxxBC408829878446A37011EBBA0C5CAA3DD64A548879CB228" */
    pending_tx_id?: string
    /** @example "0" */
    rune_deposit_value: string
    /** @example "0" */
    asset_deposit_value: string
    /** @example "0" */
    rune_redeem_value?: string
    /** @example "0" */
    asset_redeem_value?: string
    /** @example "0" */
    luvi_deposit_value?: string
    /** @example "0" */
    luvi_redeem_value?: string
    /** @example "0" */
    luvi_growth_pct?: string
}

export interface CodesResponse {
    codes?: Code[]
}

export interface Code {
    /** @example "a70d5005130246ff44470494ed5cb63d7c9ddffebda8e556e56d11c2057b0820" */
    code?: string
    deployers?: string[]
    /** @example "https://gitlab.com/thorchain/rujira/-/tree/main/contracts/rujira-merge" */
    origin?: string
}

export interface OraclePricesResponse {
    prices?: OraclePrice[]
}

export interface OraclePriceResponse {
    price?: object
}

export interface OraclePrice {
    /** @example "BTC" */
    symbol?: string
    /** @example "105126.5321" */
    amount?: string
}

export interface TCYStakerSummary {
    /** @example "0" */
    amount: string
}

export interface TCYStaker {
    /** @example "thor1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" */
    address?: string
    /** @example "0" */
    amount: string
}

export interface TCYClaimerSummary {
    /** @example "0" */
    amount: string
    /** @example "BTC.BTC" */
    asset: string
}

export interface TCYClaimer {
    /** @example "thor1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" */
    l1_address?: string
    /** @example "0" */
    amount: string
    /** @example "BTC.BTC" */
    asset: string
}

export interface Saver {
    /** @example "BTC.BTC" */
    asset: string
    /** @example "bc1qn9esxuw8ca7ts8l6w66kdh800s09msvutydc46" */
    asset_address: string
    /**
     * @format int64
     * @example 82745
     */
    last_add_height?: number
    /**
     * @format int64
     * @example 82745
     */
    last_withdraw_height?: number
    /** @example "0" */
    units: string
    /** @example "0" */
    asset_deposit_value: string
    /** @example "0" */
    asset_redeem_value: string
    /** @example "0.02" */
    growth_pct: string
}

export interface Coin {
    /** @example "BTC.BTC" */
    asset: string
    /** @example "100000" */
    amount: string
    /**
     * @format int64
     * @example 6
     */
    decimals?: number
}

export interface Vault {
    /** @format int64 */
    block_height?: number
    pub_key?: string
    pub_key_eddsa?: string
    coins: Coin[]
    type?: 'AsgardVault' | 'YggdrasilVault'
    status: string
    /** @format int64 */
    status_since?: number
    /** the list of node public keys which are members of the vault */
    membership?: string[]
    chains?: string[]
    /** @format int64 */
    inbound_tx_count?: number
    /** @format int64 */
    outbound_tx_count?: number
    pending_tx_block_heights?: number[]
    routers: VaultRouter[]
    addresses: VaultAddress[]
    frozen?: string[]
}

export interface YggdrasilVault {
    /** @format int64 */
    block_height?: number
    pub_key?: string
    coins: Coin[]
    type?: 'AsgardVault' | 'YggdrasilVault'
    /** @format int64 */
    status_since?: number
    /** the list of node public keys which are members of the vault */
    membership?: string[]
    chains?: string[]
    /** @format int64 */
    inbound_tx_count?: number
    /** @format int64 */
    outbound_tx_count?: number
    pending_tx_block_heights?: number[]
    routers: VaultRouter[]
    status: string
    /**
     * current node bond
     * @example "123456789"
     */
    bond: string
    /**
     * value in rune of the vault's assets
     * @example "83456789"
     */
    total_value: string
    addresses: VaultAddress[]
}

export interface VaultRouter {
    /** @example "ETH" */
    chain?: string
    /** @example "0x3624525075b88B24ecc29CE226b0CEc1fFcB6976" */
    router?: string
}

export interface VaultAddress {
    /** @example "BTC" */
    chain: string
    /** @example "bc1qd45uzetakjvdy5ynjjyp4nlnj89am88e4e5jeq" */
    address: string
}

export interface VaultInfo {
    /** @example "thorpub1addwnpepq068dr0x7ue973drmq4eqmzhcq3650n7nx5fhgn9gl207luxp6vaklu52tc" */
    pub_key: string
    /** @example "thorpub1addwnpepq068dr0x7ue973drmq4eqmzhcq3650n7nx5fhgn9gl207luxp6vaklu52tc" */
    pub_key_eddsa?: string
    routers: VaultRouter[]
    /** the list of node public keys which are members of the vault */
    membership?: string[]
}

export interface StreamingSwap {
    /**
     * the hash of a transaction
     * @example "CF524818D42B63D25BBA0CCC4909F127CAA645C0F9CD07324F2824CC151A64C7"
     */
    tx_id?: string
    /**
     * how often each swap is made, in blocks
     * @format int64
     */
    interval?: number
    /**
     * the total number of swaps in a streaming swaps
     * @format int64
     */
    quantity?: number
    /**
     * the amount of swap attempts so far
     * @format int64
     */
    count?: number
    /**
     * the block height of the latest swap
     * @format int64
     */
    last_height?: number
    /**
     * the total number of tokens the swapper wants to receive of the output asset
     * @example "100"
     */
    trade_target: string
    /**
     * the asset to be swapped from
     * @example "BTC.BTC"
     */
    source_asset?: string
    /**
     * the asset to be swapped to
     * @example "ETH.ETH"
     */
    target_asset?: string
    /**
     * the destination address to receive the swap output
     * @example "0x66fb1cd65b97fa40457b90b7d1ca6b92cb64b32b"
     */
    destination?: string
    /**
     * the number of input tokens the swapper has deposited
     * @example "100"
     */
    deposit: string
    /**
     * the amount of input tokens that have been swapped so far
     * @example "100"
     */
    in: string
    /**
     * the amount of output tokens that have been swapped so far
     * @example "100"
     */
    out: string
    /** the list of swap indexes that failed */
    failed_swaps?: number[]
    /** the list of reasons that sub-swaps have failed */
    failed_swap_reasons?: string[]
}

export interface Tx {
    /** @example "CF524818D42B63D25BBA0CCC4909F127CAA645C0F9CD07324F2824CC151A64C7" */
    id?: string
    /** @example "BTC" */
    chain?: string
    /** @example "bcrt1q0s4mg25tu6termrk8egltfyme4q7sg3h8kkydt" */
    from_address?: string
    /** @example "bcrt1qf3s7q037eancht7sg0aj995dht25rwrnqsf45e" */
    to_address?: string
    coins: Coin[]
    gas: Coin[]
    /** @example "ADD:BTC.BTC:thor1zupk5lmc84r2dh738a9g3zscavannjy3nzplwt" */
    memo?: string
}

export interface InboundAddress {
    /** @example "BTC" */
    chain?: string
    /** @example "thorpub1addwnpepq2jqhv5rdqlkusfxy05stfzcgslhhz5qh8pxetw5ry2aa6awgdh3shq8s82" */
    pub_key?: string
    /** @example "bc1qn9esxuw8ca7ts8l6w66kdh800s09msvutydc46" */
    address?: string
    /** @example "0xD37BbE5744D730a1d98d8DC97c42F0Ca46aD7146" */
    router?: string
    /**
     * Returns true if trading is unavailable for this chain, either because trading is halted globally or specifically for this chain
     * @example false
     */
    halted: boolean
    /**
     * Returns true if trading is paused globally
     * @example false
     */
    global_trading_paused: boolean
    /**
     * Returns true if trading is paused for this chain
     * @example false
     */
    chain_trading_paused: boolean
    /**
     * Returns true if LP actions are paused for this chain
     * @example false
     */
    chain_lp_actions_paused: boolean
    /**
     * The chain's observed fee rate in 1e8 format, before the 1.5x that makes an outbound more likely to have a sufficient gas rate.  Used by validators to check whether they need to report a fee change.
     * @example "114"
     */
    observed_fee_rate?: string
    /**
     * The minimum fee rate used by vaults to send outbound TXs. The actual fee rate may be higher. For EVM chains this is returned in gwei (1e9).
     * @example "216"
     */
    gas_rate?: string
    /**
     * Units of the gas_rate.
     * @example "satsperbyte"
     */
    gas_rate_units?: string
    /**
     * Avg size of outbound TXs on each chain. For UTXO chains it may be larger than average, as it takes into account vault consolidation txs, which can have many vouts
     * @example "1000"
     */
    outbound_tx_size?: string
    /**
     * The total outbound fee charged to the user for outbound txs in the gas asset of the chain.  Can be observed_fee_rate * 1.5 * outbound_tx_size or else kept to an equivalent of Mimir key MinimumL1OutboundFeeUSD.
     * @example "216000"
     */
    outbound_fee?: string
    /**
     * Defines the minimum transaction size for the chain in base units (sats, wei, uatom). Transactions with asset amounts lower than the dust_threshold are ignored.
     * @example "10000"
     */
    dust_threshold?: string
}

export interface LastBlock {
    chain: string
    /** @format int64 */
    last_observed_in: number
    /** @format int64 */
    last_signed_out: number
    /** @format int64 */
    thorchain: number
}

export interface ObservedTx {
    tx: Tx
    /** @example "thorpub1addwnpepq27ck6u44zl8qqdnmzjjc8rg72amrxrsp42p9vd7kt6marhy6ww76z8shwe" */
    observed_pub_key?: string
    /** @example "thorpub1addwnpepq27ck6u44zl8qqdnmzjjc8rg72amrxrsp42p9vd7kt6marhy6ww76z8shwe" */
    observed_pub_key_eddsa?: string
    /**
     * the block height on the external source chain when the transaction was observed, not provided if chain is THOR
     * @format int64
     * @example 7581334
     */
    external_observed_height?: number
    /**
     * the block height on the external source chain when confirmation counting will be complete, not provided if chain is THOR
     * @format int64
     * @example 7581334
     */
    external_confirmation_delay_height?: number
    /**
     * the outbound aggregator to use, will also match a suffix
     * @example "0x69800327b38A4CeF30367Dec3f64c2f2386f3848"
     */
    aggregator?: string
    /**
     * the aggregator target asset provided to transferOutAndCall
     * @example "0x0a44986b70527154e9F4290eC14e5f0D1C861822"
     */
    aggregator_target?: string
    /**
     * the aggregator target asset limit provided to transferOutAndCall
     * @example "0x0a44986b70527154e9F4290eC14e5f0D1C861822"
     */
    aggregator_target_limit?: string
    signers?: string[]
    /**
     * @format int64
     * @example 10000
     */
    keysign_ms?: number
    out_hashes?: string[]
    /** @example "done" */
    status?: 'done' | 'incomplete'
}

export interface OutboundFee {
    /**
     * the asset to display the outbound fee for
     * @example "ETH.ETH"
     */
    asset: string
    /**
     * the asset's outbound fee, in (1e8-format) units of the asset
     * @example "300000"
     */
    outbound_fee: string
    /**
     * Total RUNE the network has withheld as fees to later cover gas costs for this asset's outbounds
     * @example "30000000000000"
     */
    fee_withheld_rune?: string
    /**
     * Total RUNE the network has spent to reimburse gas costs for this asset's outbounds
     * @example "20000000000000"
     */
    fee_spent_rune?: string
    /**
     * amount of RUNE by which the fee_withheld_rune exceeds the fee_spent_rune
     * @example "10000000000000"
     */
    surplus_rune?: string
    /**
     * dynamic multiplier basis points, based on the surplus_rune, affecting the size of the outbound_fee
     * @example "15000"
     */
    dynamic_multiplier_basis_points?: string
}

export interface MsgSwap {
    tx: Tx
    /**
     * the asset to be swapped to
     * @example "ETH.ETH"
     */
    target_asset: string
    /**
     * the destination address to receive the swap output
     * @example "0x66fb1cd65b97fa40457b90b7d1ca6b92cb64b32b"
     */
    destination?: string
    /** the minimum amount of output asset to receive (else cancelling and refunding the swap) */
    trade_target: string
    /**
     * the affiliate address which will receive any affiliate fee
     * @example "thor1f3s7q037eancht7sg0aj995dht25rwrnu4ats5"
     */
    affiliate_address?: string
    /** the affiliate fee in basis points */
    affiliate_basis_points: string
    /** the signer (sender) of the transaction */
    signer?: string
    /** the contract address if an aggregator is specified for a non-THORChain SwapOut */
    aggregator?: string
    /** the desired output asset of the aggregator SwapOut */
    aggregator_target_address?: string
    /** the minimum amount of SwapOut asset to receive (else cancelling the SwapOut and receiving THORChain's output) */
    aggregator_target_limit?: string
    /** market if immediately completed or refunded, limit if held until fulfillable */
    swap_type?: string
    /**
     * number of swaps to execute in a streaming swap
     * @format int64
     */
    stream_quantity?: number
    /**
     * the interval (in blocks) to execute the streaming swap
     * @format int64
     */
    stream_interval?: number
    /**
     * the initial block height when the streaming swap was first queued
     * @format int64
     */
    initial_block_height?: number
    /** State tracking for swap execution */
    state?: SwapState
    /** the version of the swap (v1 or v2) */
    version?: string
    /**
     * the index of the swap in the batch
     * @format int32
     */
    index?: number
}

/** State tracking for swap execution */
export interface SwapState {
    /**
     * the interval for streaming swaps
     * @format int64
     */
    interval?: number
    /**
     * the number of swaps to execute
     * @format int64
     */
    quantity?: number
    /**
     * time to live
     * @format int64
     */
    ttl?: number
    /**
     * number of swaps executed
     * @format int64
     */
    count?: number
    /**
     * last height when a swap was executed
     * @format int64
     */
    last_height?: number
    /** total deposit amount */
    deposit?: string
    /** amount withdrawn */
    withdrawn?: string
    /** total amount swapped in */
    in?: string
    /** total amount swapped out */
    out?: string
    /** list of failed swap indices */
    failed_swaps?: number[]
    /** reasons for failed swaps */
    failed_swap_reasons?: string[]
}

export interface TxOutItem {
    /**
     * @format int64
     * @example 1234
     */
    height?: number
    /** @example "208BF0ACD78C89A0534B0457BA0867B101961A2319C1E49DD28676526904BBEA" */
    in_hash?: string
    /** @example "0D0B2FDB6DAD6E5FD3C5E46D39128F9DA15E96F0B2CC054CE059EA3532B150FB" */
    out_hash?: string
    /** @example "ETH" */
    chain: string
    /** @example "0x66fb1cd65b97fa40457b90b7d1ca6b92cb64b32b" */
    to_address: string
    /** @example "thorpub1addwnpepqt45wmsxj29xpgdrdsvg2h3dx68qeapgykw3hlyj6vuds2r0pnkwx5gt9m4" */
    vault_pub_key?: string
    /** @example "thorpub1addwnpepqt45wmsxj29xpgdrdsvg2h3dx68qeapgykw3hlyj6vuds2r0pnkwx5gt9m4" */
    vault_pub_key_eddsa?: string
    coin: Coin
    max_gas: Coin[]
    /** @format int64 */
    gas_rate?: number
    /** @example "OUT:208BF0ACD78C89A0534B0457BA0867B101961A2319C1E49DD28676526904BBEA" */
    memo?: string
    /** @example "=:BTC.BTC:bc1q0lwf0ycw4gkh8v6y8g9yqwxvqnvm24kvdezgpg" */
    original_memo?: string
    /**
     * whitelisted DEX Aggregator contract address
     * @example "0xe4ddca21881bac219af7f217703db0475d2a9f02"
     */
    aggregator?: string
    /**
     * target asset for the aggregator contract to attempt a swap to
     * @example "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
     */
    aggregator_target_asset?: string
    /**
     * the minimum number of tokens the swapper wants to receive of the output asset
     * @example "100"
     */
    aggregator_target_limit?: string
    /**
     * clout spent in RUNE for the outbound
     * @example "1234"
     */
    clout_spent?: string
}

export interface TssMetric {
    address?: string
    /** @format int64 */
    tss_time?: number
}

export interface TssKeysignMetric {
    tx_id?: string
    node_tss_times: TssMetric[]
}

export interface Node {
    /** @example "thor1f3s7q037eancht7sg0aj995dht25rwrnu4ats5" */
    node_address: string
    /** @example "Active" */
    status: 'Active' | 'Whitelisted' | 'Standby' | 'Disabled'
    /** NodePubKeySet */
    pub_key_set: {
        /** @example "thorpub1addwnpepq27ck6u44zl8qqdnmzjjc8rg72amrxrsp42p9vd7kt6marhy6ww76z8shwe" */
        secp256k1?: string
        /** @example "thorpub1addwnpepq27ck6u44zl8qqdnmzjjc8rg72amrxrsp42p9vd7kt6marhy6ww76z8shwe" */
        ed25519?: string
    }
    /**
     * the consensus pub key for the node
     * @example "thor104gsqwta048e80j909g6y9kkqdjrw0lff866ew"
     */
    validator_cons_pub_key: string
    /**
     * the P2PID (:6040/p2pid endpoint) of the node
     * @example "16Uiu2HAmRgsiryer3pWCPJz18PQZDFFs1GBqCPGGJczrQXdoTBMk"
     */
    peer_id: string
    /**
     * the block height at which the node became active
     * @format int64
     * @example 123456
     */
    active_block_height: number
    /**
     * the block height of the current provided information for the node
     * @format int64
     * @example 100000
     */
    status_since: number
    /** @example "thor1f3s7q037eancht7sg0aj995dht25rwrnu4ats5" */
    node_operator_address: string
    /**
     * current node bond
     * @example "123456789"
     */
    total_bond: string
    /** NodeBondProviders */
    bond_providers: {
        /** node operator fee in basis points */
        node_operator_fee: string
        /** all the bond providers for the node */
        providers: {
            bond_address?: string
            bond?: string
        }[]
    }
    /** the set of vault public keys of which the node is a member */
    signer_membership: string[]
    requested_to_leave: boolean
    /** indicates whether the node has been forced to leave by the network, typically via ban */
    forced_to_leave: boolean
    /**
     * @format int64
     * @example 0
     */
    leave_height: number
    /** @example "10.20.30.40" */
    ip_address: string
    /**
     * the currently set version of the node
     * @example "0.35.0"
     */
    version: string
    /**
     * the accumulated slash points, reset at churn but excessive slash points may carry over
     * @format int64
     * @example 42
     */
    slash_points: number
    /** NodeJail */
    jail: {
        /**
         * @format int64
         * @example 1234
         */
        release_height?: number
        reason?: string
    }
    /** @example "123456" */
    current_award: string
    /** the last observed heights for all chain by the node */
    observe_chains: {
        /** @example "BTC" */
        chain: string
        /**
         * @format int64
         * @example 2000000
         */
        height: number
    }[]
    /**
     * indicates whether the node is in maintenance mode
     * @example false
     */
    maintenance: boolean
    /**
     * the number of recent blocks the node has missed signing
     * @format int64
     */
    missing_blocks: number
    /** NodePreflightStatus */
    preflight_status: {
        /**
         * the next status of the node
         * @example "Ready"
         */
        status: string
        /**
         * the reason for the transition to the next status
         * @example "OK"
         */
        reason: string
        /**
         * @format int64
         * @example 0
         */
        code: number
    }
}

export interface KeygenMetric {
    pub_key?: string
    node_tss_times: {
        address?: string
        tss_time?: string
    }[]
}

export interface ThornameAlias {
    /** @example "BTC" */
    chain?: string
    /** @example "bc1qn9esxuw8ca7ts8l6w66kdh800s09msvutydc46" */
    address?: string
}

export interface Thorname {
    /** @example "thor" */
    name?: string
    /**
     * @format int64
     * @example 1234
     */
    expire_block_height?: number
    /** @example "thor1f3s7q037eancht7sg0aj995dht25rwrnu4ats5" */
    owner?: string
    /** @example "BTC.BTC" */
    preferred_asset: string
    /**
     * Amount of RUNE currently needed to trigger a preferred asset swap.
     * @example "500"
     */
    preferred_asset_swap_threshold_rune?: string
    /**
     * Amount of RUNE currently accrued by this thorname in affiliate fees waiting to be swapped to preferred asset.
     * @example "100"
     */
    affiliate_collector_rune?: string
    aliases: ThornameAlias[]
}

export interface QuoteFees {
    /**
     * the target asset used for all fees
     * @example "ETH.ETH"
     */
    asset: string
    /**
     * affiliate fee in the target asset
     * @example "1234"
     */
    affiliate?: string
    /**
     * outbound fee in the target asset
     * @example "1234"
     */
    outbound?: string
    /**
     * liquidity fees paid to pools in the target asset
     * @example "1234"
     */
    liquidity: string
    /**
     * total fees in the target asset
     * @example "9876"
     */
    total: string
    /**
     * the swap slippage in basis points
     * @format int64
     */
    slippage_bps: number
    /**
     * total basis points in fees relative to amount out
     * @format int64
     */
    total_bps: number
}

export interface BlockTx {
    /** @example "223BF64D4A01074DC523A80E76B9BBC786C791FB0A1893AC5B14866356FCFD6C" */
    hash: string
    tx: Record<string, any>
    result: {
        /**
         * @format int64
         * @example 0
         */
        code?: number
        /** @example "" */
        data?: string
        /** @example "not enough gas" */
        log?: string
        /** @example "" */
        info?: string
        /** @example "100" */
        gas_wanted?: string
        /** @example "100" */
        gas_used?: string
        events?: Record<string, string>[] | null
        /** @example "ibc" */
        codespace?: string
    }
}

export interface UpgradeProposal {
    /**
     * the name of the upgrade
     * @example "scheduled upgrade 1"
     */
    name: string
    /**
     * the block height at which the upgrade will occur
     * @format int64
     * @example 1234
     */
    height: number
    /**
     * the description of the upgrade, typically json with URLs to binaries for use with automation tools
     * @example "{"binaries":{"linux/amd64":"https://link.to.binary.amd64","linux/arm64":"https://link.to.binary.arm64"}}"
     */
    info: string
    /**
     * whether the upgrade has been approved by the active validators
     * @example true
     */
    approved?: boolean
    /**
     * the percentage of active validators that have approved the upgrade
     * @example "0.8"
     */
    approved_percent?: string
    /**
     * the amount of additional active validators required to reach quorum for the upgrade
     * @format int64
     * @example 20
     */
    validators_to_quorum?: number
    /** the list of node addresses that have approved the upgrade */
    approvers?: string[]
    /** the list of node addresses that have rejected the upgrade */
    rejecters?: string[]
}

export interface UpgradeVote {
    /**
     * the node address of the voter
     * @example "thor1f3s7q037eancht7sg0aj995dht25rwrnu4ats5"
     */
    node_address: string
    /**
     * the vote cast by the node
     * @example "approve"
     */
    vote: 'approve' | 'reject'
}

export interface Account {
    /** @example "/cosmos.auth.v1beta1.BaseAccount" */
    type?: string
    /** @example "thor1f3s7q037eancht7sg0aj995dht25rwrnu4ats5" */
    address?: string
    /** @example "thorpub1addwnpepq27ck6u44zl8qqdnmzjjc8rg72amrxrsp42p9vd7kt6marhy6ww76z8shwe" */
    pubkey?: string
    /**
     * @format int64
     * @example 1234
     */
    sequence?: number
    /**
     * @format int64
     * @example 1234
     */
    account_number?: number
}

export interface Amount {
    denom: string
    amount: string
}

export interface AccountResponse {
    result?: {
        value?: Account
    }
}

export interface BalancesResponse {
    result?: Amount[]
}

export type PoolResponse = Pool

export type PoolsResponse = Pool[]

/** PoolSlipResponse */
export type PoolSlipResponse = {
    /** @example "BTC.BTC" */
    asset: string
    /**
     * Pool slip for this asset's pool for the current height
     * @format int64
     * @example 5
     */
    pool_slip: number
    /**
     * Number of stored pool slips contributing to the current stored rollup
     * @format int64
     * @example 300
     */
    rollup_count: number
    /**
     * Median of rollup snapshots over a long period
     * @format int64
     * @example 1500
     */
    long_rollup: number
    /**
     * Stored sum of pool slips over a number of previous block heights
     * @format int64
     * @example 1500
     */
    rollup: number
    /**
     * Summed pool slips over a number of previous block heights, to checksum the stored rollup
     * @format int64
     * @example 1500
     */
    summed_rollup?: number
}[]

export type DerivedPoolResponse = DerivedPool

export type DerivedPoolsResponse = DerivedPool[]

export interface RUNEPoolResponse {
    pol: POL
    providers: {
        /**
         * the units of RUNEPool owned by providers (including pending)
         * @example "123456"
         */
        units: string
        /**
         * the units of RUNEPool owned by providers that remain pending
         * @example "123456"
         */
        pending_units: string
        /**
         * the amount of RUNE pending
         * @example "123456"
         */
        pending_rune: string
        /**
         * the value of the provider share of the RUNEPool (includes pending RUNE)
         * @example "123456"
         */
        value: string
        /**
         * the profit and loss of the provider share of the RUNEPool
         * @example "123456"
         */
        pnl: string
        /**
         * the current RUNE deposited by providers
         * @example "123456"
         */
        current_deposit: string
    }
    reserve: {
        /**
         * the units of RUNEPool owned by the reserve
         * @example "123456"
         */
        units: string
        /**
         * the value of the reserve share of the RUNEPool
         * @example "123456"
         */
        value: string
        /**
         * the profit and loss of the reserve share of the RUNEPool
         * @example "123456"
         */
        pnl: string
        /**
         * the current RUNE deposited by the reserve
         * @example "123456"
         */
        current_deposit: string
    }
}

export type RUNEProviderResponse = RUNEProvider

export type RUNEProvidersResponse = RUNEProvider[]

export type LiquidityProvidersResponse = LiquidityProviderSummary[]

export type LiquidityProviderResponse = LiquidityProvider

export type TCYStakersResponse = TCYStakerSummary[]

export type TCYStakerResponse = TCYStaker

export type TCYClaimersResponse = TCYClaimerSummary[]

export type TCYClaimerResponse = TCYClaimer

export type SaverResponse = Saver

export type SaversResponse = Saver[]

export interface TxResponse {
    observed_tx?: ObservedTx
    /**
     * the thorchain height at which the inbound reached consensus
     * @format int64
     * @example 7581321
     */
    consensus_height?: number
    /**
     * the thorchain height at which the outbound was finalised
     * @format int64
     * @example 7581334
     */
    finalised_height?: number
    /**
     * the thorchain height for which the outbound was scheduled
     * @format int64
     * @example 1234
     */
    outbound_height?: number
    keysign_metric?: TssKeysignMetric
}

export interface TxDetailsResponse {
    /** @example "CF524818D42B63D25BBA0CCC4909F127CAA645C0F9CD07324F2824CC151A64C7" */
    tx_id?: string
    tx: ObservedTx
    txs: ObservedTx[]
    actions: TxOutItem[]
    out_txs: Tx[]
    /**
     * the thorchain height at which the inbound reached consensus
     * @format int64
     * @example 7581321
     */
    consensus_height?: number
    /**
     * the thorchain height at which the outbound was finalised
     * @format int64
     * @example 7581334
     */
    finalised_height?: number
    /** @example false */
    updated_vault?: boolean
    /** @example false */
    reverted?: boolean
    /**
     * the thorchain height for which the outbound was scheduled
     * @format int64
     * @example 1234
     */
    outbound_height?: number
}

export interface TxSignersResponse {
    /** @example "CF524818D42B63D25BBA0CCC4909F127CAA645C0F9CD07324F2824CC151A64C7" */
    tx_id?: string
    tx: ObservedTx
    txs: ObservedTx[]
    actions: TxOutItem[]
    out_txs: Tx[]
    /**
     * the thorchain height at which the inbound reached consensus
     * @format int64
     * @example 7581321
     */
    consensus_height?: number
    /**
     * the thorchain height at which the outbound was finalised
     * @format int64
     * @example 7581334
     */
    finalised_height?: number
    /** @example false */
    updated_vault?: boolean
    /** @example false */
    reverted?: boolean
    /**
     * the thorchain height for which the outbound was scheduled
     * @format int64
     * @example 1234
     */
    outbound_height?: number
}

export interface TxStagesResponse {
    /** InboundObservedStage */
    inbound_observed: {
        /**
         * returns true if any nodes have observed the transaction (to be deprecated in favour of counts)
         * @example false
         */
        started?: boolean
        /**
         * number of signers for pre-confirmation-counting observations
         * @format int64
         * @example 80
         */
        pre_confirmation_count?: number
        /**
         * number of signers for final observations, after any confirmation counting complete
         * @format int64
         * @example 80
         */
        final_count: number
        /**
         * returns true if no transaction observation remains to be done
         * @example false
         */
        completed: boolean
    }
    /** InboundConfirmationCountedStage */
    inbound_confirmation_counted?: {
        /**
         * the THORChain block height when confirmation counting began
         * @format int64
         * @example 1234
         */
        counting_start_height?: number
        /**
         * the external source chain for which confirmation counting takes place
         * @example "BTC"
         */
        chain?: string
        /**
         * the block height on the external source chain when the transaction was observed
         * @format int64
         * @example 16042625
         */
        external_observed_height?: number
        /**
         * the block height on the external source chain when confirmation counting will be complete
         * @format int64
         * @example 16042626
         */
        external_confirmation_delay_height?: number
        /**
         * the estimated remaining seconds before confirmation counting completes
         * @format int64
         * @example 600
         */
        remaining_confirmation_seconds?: number
        /**
         * returns true if no transaction confirmation counting remains to be done
         * @example false
         */
        completed: boolean
    }
    /** InboundFinalisedStage */
    inbound_finalised?: {
        /**
         * returns true if the inbound transaction has been finalised (THORChain agreeing it exists)
         * @example false
         */
        completed: boolean
    }
    /** SwapStatus */
    swap_status?: {
        /**
         * true when awaiting a swap
         * @example false
         */
        pending: boolean
        /** StreamingStatus */
        streaming?: {
            /**
             * how often each swap is made, in blocks
             * @format int64
             */
            interval: number
            /**
             * the total number of swaps in a streaming swaps
             * @format int64
             */
            quantity: number
            /**
             * the amount of swap attempts so far
             * @format int64
             */
            count: number
        }
    }
    /** SwapFinalisedStage */
    swap_finalised?: {
        /**
         * (to be deprecated in favor of swap_status) returns true if an inbound transaction's swap (successful or refunded) is no longer pending
         * @example false
         */
        completed: boolean
    }
    /** OutboundDelayStage */
    outbound_delay?: {
        /**
         * the number of remaining THORChain blocks the outbound will be delayed
         * @format int64
         * @example 5
         */
        remaining_delay_blocks?: number
        /**
         * the estimated remaining seconds of the outbound delay before it will be sent
         * @format int64
         * @example 30
         */
        remaining_delay_seconds?: number
        /**
         * returns true if no transaction outbound delay remains
         * @example false
         */
        completed: boolean
    }
    /** OutboundSignedStage */
    outbound_signed?: {
        /**
         * THORChain height for which the external outbound is scheduled
         * @format int64
         * @example 1234
         */
        scheduled_outbound_height?: number
        /**
         * THORChain blocks since the scheduled outbound height
         * @format int64
         * @example 1234
         */
        blocks_since_scheduled?: number
        /**
         * returns true if an external transaction has been signed and broadcast (and observed in its mempool)
         * @example false
         */
        completed: boolean
    }
}

export interface TxStatusResponse {
    tx?: Tx
    planned_out_txs?: {
        /** @example "BTC" */
        chain: string
        /** @example "bcrt1qf3s7q037eancht7sg0aj995dht25rwrnqsf45e" */
        to_address: string
        coin: Coin
        /**
         * returns true if the planned transaction has a refund memo
         * @example false
         */
        refund: boolean
    }[]
    out_txs?: Tx[]
    stages: TxStagesResponse
}

export type NodeResponse = Node

export type NodesResponse = Node[]

export type StreamingSwapsResponse = StreamingSwap[]

export type StreamingSwapResponse = StreamingSwap

export type YggdrasilVaultsResponse = YggdrasilVault[]

export type VaultsResponse = Vault[]

export type VaultResponse = Vault

export interface VaultPubkeysResponse {
    asgard: VaultInfo[]
    yggdrasil: VaultInfo[]
    inactive: VaultInfo[]
}

export interface VaultSolvencyResponse {
    assets: VaultSolvencyAsset[]
}

export interface VaultSolvencyAsset {
    /**
     * Asset identifier
     * @example "BTC.BTC"
     */
    asset: string
    /**
     * Solvency amount for the asset. Positive values indicate over-solvency, negative values indicate under-solvency.
     * @example "1000000000"
     */
    amount: string
}

export interface NetworkResponse {
    /**
     * total amount of RUNE awarded to node operators
     * @example "857134475040"
     */
    bond_reward_rune: string
    /**
     * total bonded RUNE
     * @example "0"
     */
    total_bond_units: string
    /**
     * RUNE in Available pools (equal in value to the Assets in those pools)
     * @example "4785723312627752"
     */
    available_pools_rune: string
    /**
     * RUNE value of Layer 1 Assets in vaults
     * @example "5792105087034476"
     */
    vaults_liquidity_rune: string
    /**
     * effective security bond used to determine maximum pooled RUNE
     * @example "0"
     */
    effective_security_bond: string
    /**
     * total reserve RUNE
     * @example "21999180112172346"
     */
    total_reserve: string
    /**
     * Returns true if there exist RetiringVaults which have not finished migrating funds to new ActiveVaults
     * @example false
     */
    vaults_migrating: boolean
    /**
     * Sum of the gas the network has spent to send outbounds
     * @example "1000000000"
     */
    gas_spent_rune: string
    /**
     * Sum of the gas withheld from users to cover outbound gas
     * @example "1500000000"
     */
    gas_withheld_rune: string
    /**
     * Current outbound fee multiplier, in basis points
     * @example "15000"
     */
    outbound_fee_multiplier?: string
    /**
     * the outbound transaction fee in rune, converted from the NativeOutboundFeeUSD mimir (after USD fees are enabled)
     * @example "100000000"
     */
    native_outbound_fee_rune: string
    /**
     * the native transaction fee in rune, converted from the NativeTransactionFeeUSD mimir (after USD fees are enabled)
     * @example "100000000"
     */
    native_tx_fee_rune: string
    /**
     * the thorname register fee in rune, converted from the TNSRegisterFeeUSD mimir (after USD fees are enabled)
     * @example "1000000000"
     */
    tns_register_fee_rune: string
    /**
     * the thorname fee per block in rune, converted from the TNSFeePerBlockUSD mimir (after USD fees are enabled)
     * @example "20"
     */
    tns_fee_per_block_rune: string
    /**
     * the rune price in tor
     * @example "10"
     */
    rune_price_in_tor: string
    /**
     * the tor price in rune
     * @example "10"
     */
    tor_price_in_rune: string
    /**
     * indicates if all anchor chains are halted (true), or at least one anchor chain is available (false)
     * @example false
     */
    tor_price_halted: boolean
}

export type OutboundFeesResponse = OutboundFee[]

export type InboundAddressesResponse = InboundAddress[]

export type LastBlockResponse = LastBlock[]

export interface VersionResponse {
    /**
     * current version
     * @example "0.17.0"
     */
    current: string
    /**
     * next version (minimum version for a node to become Active)
     * @example "0.18.0"
     */
    next: string
    /**
     * height at which the minimum joining version last changed
     * @format int64
     * @example 2000000
     */
    next_since_height?: number
    /**
     * querier version
     * @example "0.16.0"
     */
    querier: string
}

export type UpgradeProposalsResponse = UpgradeProposal[]

export type UpgradeProposalResponse = UpgradeProposal

export type UpgradeVotesResponse = UpgradeVote[]

export interface ConstantsResponse {
    /** @example {"AsgardSize":40} */
    int_64_values?: Record<string, string>
    /** @example {"StrictBondLiquidityRatio":true} */
    bool_values?: Record<string, string>
    /** @example {"DefaultPoolStatus":"Staged"} */
    string_values?: Record<string, string>
}

export interface BanResponse {
    /** @example "thor1f3s7q037eancht7sg0aj995dht25rwrnu4ats5" */
    node_address?: string
    /** @format int64 */
    block_height?: number
    signers?: string[]
}

export interface QueueResponse {
    /**
     * @format int64
     * @example 0
     */
    swap: number
    /**
     * number of signed outbound tx in the queue
     * @format int64
     * @example 10
     */
    outbound: number
    /**
     * @format int64
     * @example 0
     */
    internal: number
    /** scheduled outbound value in RUNE */
    scheduled_outbound_value: string
    /** scheduled outbound clout in RUNE */
    scheduled_outbound_clout: string
}

export type SwapQueueResponse = MsgSwap[]

export interface SwapDetailsResponse {
    swap?: MsgSwap
    /**
     * Current status of the swap
     * @example "queued"
     */
    status?: string
    /**
     * Type of queue the swap is in
     * @example "advanced"
     */
    queue_type?: string
}

export interface LimitSwapWithDetails {
    swap?: MsgSwap
    /**
     * The ratio threshold for this limit swap
     * @example "1234567890123456789"
     */
    ratio?: string
    /**
     * Number of blocks since the swap was created
     * @format int64
     * @example 150
     */
    blocks_since_created?: number
    /**
     * Number of blocks until the swap expires
     * @format int64
     * @example 14850
     */
    time_to_expiry_blocks?: number
    /**
     * Unix timestamp when the swap was created
     * @format int64
     * @example 1699123456
     */
    created_timestamp?: number
}

export interface PaginationMeta {
    /**
     * Number of items skipped
     * @format int64
     * @example 0
     */
    offset?: number
    /**
     * Number of items returned
     * @format int64
     * @example 100
     */
    limit?: number
    /**
     * Total number of items available
     * @format int64
     * @example 1247
     */
    total?: number
    /**
     * Whether there are more items after this page
     * @example true
     */
    has_next?: boolean
    /**
     * Whether there are items before this page
     * @example false
     */
    has_prev?: boolean
}

export interface LimitSwapsResponse {
    /** Array of limit swaps with details */
    limit_swaps?: LimitSwapWithDetails[]
    pagination?: PaginationMeta
}

export interface AssetPairSummary {
    /**
     * Source asset identifier
     * @example "BTC.BTC"
     */
    source_asset?: string
    /**
     * Target asset identifier
     * @example "ETH.ETH"
     */
    target_asset?: string
    /**
     * Number of limit swaps for this asset pair
     * @format int64
     * @example 456
     */
    count?: number
    /**
     * Total USD value of limit swaps for this asset pair
     * @example "4500000.00"
     */
    total_value_usd?: string
}

export interface LimitSwapsSummaryResponse {
    /**
     * Total number of limit swaps
     * @format int64
     * @example 1247
     */
    total_limit_swaps?: number
    /**
     * Total USD value of all limit swaps
     * @example "12450000.50"
     */
    total_value_usd?: string
    /** Summary statistics by asset pair */
    asset_pairs?: AssetPairSummary[]
    /**
     * Age in blocks of the oldest limit swap
     * @format int64
     * @example 14999
     */
    oldest_swap_blocks?: number
    /**
     * Average age in blocks of all limit swaps
     * @format int64
     * @example 7500
     */
    average_age_blocks?: number
}

export type OutboundResponse = TxOutItem[]

export type ScheduledResponse = TxOutItem[]

export interface KeysignResponse {
    /** KeysignInfo */
    keysign: {
        /**
         * the block(s) in which a tx out item is scheduled to be signed and moved from the scheduled outbound queue to the outbound queue
         * @format int64
         */
        height?: number
        tx_array: TxOutItem[]
    }
    signature: string
}

export interface KeygenResponse {
    /** KeygenBlock */
    keygen_block: {
        /**
         * the height of the keygen block
         * @format int64
         */
        height?: number
        keygens: {
            id?: string
            type?: string
            members?: string[]
        }[]
    }
    signature: string
}

export type KeygenMetricsResponse = KeygenMetric[]

export interface MetricsResponse {
    keygen?: KeygenMetricsResponse
    /** KeysignMetrics */
    keysign?: {
        tx_id?: string
        node_tss_times?: TssMetric[]
    }
}

export type ThornameResponse = Thorname

export interface SwapperCloutResponse {
    /**
     * address associated with this clout account
     * @example "bc1...."
     */
    address: string
    /** clout score, which is the amount of rune spent on swap fees */
    score?: string
    /** amount of clout that has been reclaimed in total over time (observed clout spent) */
    reclaimed?: string
    /** amount of clout that has been spent in total over time */
    spent?: string
    /**
     * last block height that clout was spent
     * @format int64
     */
    last_spent_height?: number
    /**
     * last block height that clout was reclaimed
     * @format int64
     */
    last_reclaim_height?: number
}

export interface TradeUnitResponse {
    /**
     * trade account asset with "~" separator
     * @example "BTC~BTC"
     */
    asset: string
    /** total units of trade asset */
    units: string
    /** total depth of trade asset */
    depth: string
}

export type TradeUnitsResponse = TradeUnitResponse[]

export interface TradeAccountResponse {
    /**
     * trade account asset with "~" separator
     * @example "BTC~BTC"
     */
    asset: string
    /** units of trade asset belonging to this owner */
    units: string
    /** thor address of trade account owner */
    owner: string
    /**
     * last thorchain height trade assets were added to trade account
     * @format int64
     */
    last_add_height?: number
    /**
     * last thorchain height trade assets were withdrawn from trade account
     * @format int64
     */
    last_withdraw_height?: number
}

export type TradeAccountsResponse = TradeAccountResponse[]

export interface SecuredAssetResponse {
    /**
     * secured account asset with "-" separator
     * @example "BTC-BTC"
     */
    asset: string
    /** total share tokens issued for the asset */
    supply: string
    /** total deposits of the asset */
    depth: string
}

export type SecuredAssetsResponse = SecuredAssetResponse[]

/** @example {"NODEOPERATORFEE":2000,"NUMBEROFNEWNODESPERCHURN":2} */
export type MimirResponse = Record<string, string>

export interface InvariantResponse {
    /**
     * The name of the invariant.
     * @example "asgard"
     */
    invariant: string
    /**
     * Returns true if the invariant is broken.
     * @example false
     */
    broken: boolean
    /**
     * Informative message about the invariant result.
     * @example ["insolvent: 200000rune","oversolvent: 1btc/btc"]
     */
    msg: string[]
}

export interface InvariantsResponse {
    invariants?: string[]
}

export interface MimirNodesResponse {
    mimirs?: {
        key?: string
        /** @format int64 */
        value?: number
        signer?: string
    }[]
}

export type ExportResponse = object

export interface BlockResponse {
    id: {
        /** @example "112BC173FD838FB68EB43476816CD7B4C6661B6884A9E357B417EE957E1CF8F7" */
        hash: string
        parts: {
            /**
             * @format int64
             * @example 1
             */
            total: number
            /** @example "38D4B26B5B725C4F13571EFE022C030390E4C33C8CF6F88EDD142EA769642DBD" */
            hash: string
        }
    }
    header: {
        version: {
            /** @example "10" */
            block: string
            /** @example "0" */
            app: string
        }
        /** @example "cosmoshub-2" */
        chain_id: string
        /**
         * @format int64
         * @example 123
         */
        height: number
        /** @example "2019-04-22T17:01:51.701356223Z" */
        time: string
        last_block_id: {
            /** @example "112BC173FD838FB68EB43476816CD7B4C6661B6884A9E357B417EE957E1CF8F7" */
            hash: string
            parts: {
                /**
                 * @format int64
                 * @example 1
                 */
                total: number
                /** @example "38D4B26B5B725C4F13571EFE022C030390E4C33C8CF6F88EDD142EA769642DBD" */
                hash: string
            }
        }
        /** @example "21B9BC845AD2CB2C4193CDD17BFC506F1EBE5A7402E84AD96E64171287A34812" */
        last_commit_hash: string
        /** @example "970886F99E77ED0D60DA8FCE0447C2676E59F2F77302B0C4AA10E1D02F18EF73" */
        data_hash: string
        /** @example "D658BFD100CA8025CFD3BECFE86194322731D387286FBD26E059115FD5F2BCA0" */
        validators_hash: string
        /** @example "D658BFD100CA8025CFD3BECFE86194322731D387286FBD26E059115FD5F2BCA0" */
        next_validators_hash: string
        /** @example "0F2908883A105C793B74495EB7D6DF2EEA479ED7FC9349206A65CB0F9987A0B8" */
        consensus_hash: string
        /** @example "223BF64D4A01074DC523A80E76B9BBC786C791FB0A1893AC5B14866356FCFD6C" */
        app_hash: string
        /** @example "" */
        last_results_hash: string
        /** @example "" */
        evidence_hash: string
        /** @example "D540AB022088612AC74B287D076DBFBC4A377A2E" */
        proposer_address: string
    }
    finalize_block_events: Record<string, string>[]
    begin_block_events: Record<string, string>[]
    end_block_events: Record<string, string>[]
    txs: BlockTx[] | null
}

export interface BaseQuoteResponse {
    /**
     * the inbound address for the transaction on the source chain
     * @example "bc1qjk3xzu5slu7mtmc8jc9yed3zqvkhkttm700g9a"
     */
    inbound_address?: string
    /**
     * the approximate number of source chain blocks required before processing
     * @format int64
     */
    inbound_confirmation_blocks?: number
    /**
     * the approximate seconds for block confirmations required before processing
     * @format int64
     */
    inbound_confirmation_seconds?: number
    /**
     * the number of thorchain blocks the outbound will be delayed
     * @format int64
     */
    outbound_delay_blocks?: number
    /**
     * the approximate seconds for the outbound delay before it will be sent
     * @format int64
     */
    outbound_delay_seconds?: number
    fees?: QuoteFees
    /**
     * the EVM chain router contract address
     * @example "0x3624525075b88B24ecc29CE226b0CEc1fFcB6976"
     */
    router?: string
    /**
     * expiration timestamp in unix seconds
     * @format int64
     * @example 1671660285
     */
    expiry?: number
    /**
     * static warning message
     * @example "Do not cache this response. Do not send funds after the expiry."
     */
    warning?: string
    /**
     * chain specific quote notes
     * @example "Transfer the inbound_address the asset with the memo. Do not use multi-in, multi-out transactions."
     */
    notes?: string
    /**
     * Defines the minimum transaction size for the chain in base units (sats, wei, uatom). Transactions with asset amounts lower than the dust_threshold are ignored.
     * @example "10000"
     */
    dust_threshold?: string
    /**
     * The recommended minimum inbound amount for this transaction type & inbound asset. Sending less than this amount could result in failed refunds.
     * @example "15000"
     */
    recommended_min_amount_in?: string
    /**
     * the recommended gas rate to use for the inbound to ensure timely confirmation
     * @example "10"
     */
    recommended_gas_rate?: string
    /**
     * the units of the recommended gas rate
     * @example "gwei"
     */
    gas_rate_units?: string
}

export interface QuoteSwapResponse {
    '<<'?: any
    /**
     * generated memo for the swap
     * @example "=:ETH.ETH:0x1c7b17362c84287bd1184447e6dfeaf920c31bbe:1440450000:thor17gw75axcnr8747pkanye45pnrwk7p9c3cqncsv:100"
     */
    memo?: string
    /**
     * the amount of the target asset the user can expect to receive after fees
     * @example "10000"
     */
    expected_amount_out: string
    /**
     * the maximum amount of trades a streaming swap can do for a trade
     * @format int64
     * @example 10
     */
    max_streaming_quantity?: number
    /**
     * the number of blocks the streaming swap will execute over
     * @format int64
     * @example 100
     */
    streaming_swap_blocks?: number
    /**
     * approx the number of seconds the streaming swap will execute over
     * @format int64
     * @example 600
     */
    streaming_swap_seconds?: number
    /**
     * total number of seconds a swap is expected to take (inbound conf + streaming swap + outbound delay)
     * @format int64
     * @example 600
     */
    total_swap_seconds?: number
}

export interface QuoteLimitResponse {
    '<<'?: any
    /**
     * generated memo for the limit order
     * @example "=:ETH.ETH:0x1c7b17362c84287bd1184447e6dfeaf920c31bbe:1440450000:thor17gw75axcnr8747pkanye45pnrwk7p9c3cqncsv:100"
     */
    memo?: string
    /**
     * the amount of the target asset the user can expect to receive after fees
     * @example "10000"
     */
    expected_amount_out: string
    /**
     * the block height when the limit order will expire
     * @format int64
     * @example 1000000
     */
    order_expiry_block: number
    /**
     * the timestamp when the limit order will expire
     * @format int64
     * @example 1671660285
     */
    order_expiry_timestamp: number
    /**
     * the recommended minimum amount in for the limit order
     * @example "10000"
     */
    recommended_min_amount_in?: string
    /**
     * the EVM chain router contract address
     * @example "0x3624525075b88B24ecc29CE226b0CEc1fFcB6976"
     */
    router?: string
    /**
     * the dust threshold for the source chain
     * @example "10000"
     */
    dust_threshold?: string
    /**
     * notes about the limit order
     * @example "Transfer to the inbound_address the asset with the memo. Do not use multi-in, multi-out transactions."
     */
    notes?: string
    /**
     * the recommended gas rate to use for the inbound to ensure timely confirmation
     * @example "20000000000"
     */
    recommended_gas_rate?: string
    /**
     * the units of the recommended gas rate
     * @example "gwei"
     */
    gas_rate_units?: string
    /**
     * the inbound address for the transaction on the source chain
     * @example "bc1qjk3xzu5slu7mtmc8jc9yed3zqvkhkttm700g9a"
     */
    inbound_address: string
}

export interface QuoteSaverDepositResponse {
    '<<'?: any
    /**
     * generated memo for the deposit
     * @example "+:ETH/ETH::thor17gw75axcnr8747pkanye45pnrwk7p9c3cqncsv:100"
     */
    memo: string
    /**
     * same as expected_amount_deposit, to be deprecated in favour of expected_amount_deposit
     * @example "10000"
     */
    expected_amount_out?: string
    /**
     * the amount of the target asset the user can expect to deposit after fees
     * @example "10000"
     */
    expected_amount_deposit: string
}

export interface QuoteSaverWithdrawResponse {
    '<<'?: any
    /**
     * generated memo for the withdraw, the client can use this OR send the dust amount
     * @example "-:ETH.ETH:0x1c7b17362c84287bd1184447e6dfeaf920c31bbe:1440450000:thor17gw75axcnr8747pkanye45pnrwk7p9c3cqncsv:100"
     */
    memo: string
    /**
     * the dust amount of the target asset the user should send to initialize the withdraw, the client can send this OR provide the memo
     * @example "10000"
     */
    dust_amount: string
    /**
     * the amount of the target asset the user can expect to withdraw after fees in 1e8 decimals
     * @example "10000"
     */
    expected_amount_out: string
}

export interface ReferenceMemoResponse {
    /**
     * the asset for which this reference memo is valid
     * @example "BTC.BTC"
     */
    asset: string
    /**
     * the original memo that was registered for memoless transactions
     * @example "=:ETH.ETH:0x1c7b17362c84287bd1184447e6dfeaf920c31bbe:1000:0:100"
     */
    memo: string
    /**
     * the reference number used to identify this memo
     * @example "20002"
     */
    reference: string
    /**
     * the block height when this reference memo was registered
     * @example "12345678"
     */
    height: string
    /**
     * the transaction hash where this reference memo was registered
     * @example "AF524818D42B63D25BBA0CCC4909F127CAA645C0F9CD07324F2824CC151A64C8"
     */
    registration_hash: string
    /**
     * the address that registered this reference memo
     * @example "thor1zupk5lmc84r2dh738a9g3zscavannjy3nzplwt"
     */
    registered_by: string
    /**
     * list of transaction hashes that have used this reference memo
     * @example ["AF524818D42B63D25BBA0CCC4909F127CAA645C0F9CD07324F2824CC151A64C8","BF524818D42B63D25BBA0CCC4909F127CAA645C0F9CD07324F2824CC151A64C9"]
     */
    used_by_txs: string[]
}

export interface ReferenceMemoPreflightResponse {
    /**
     * the reference ID that would be generated from the amount
     * @example "20002"
     */
    reference: string
    /**
     * whether this reference is currently available (not registered or expired)
     * @example true
     */
    available: boolean
    /**
     * whether a new registration can be made with this reference
     * @example true
     */
    can_register: boolean
    /**
     * block height when current registration expires (0 if available)
     * @example "0"
     */
    expires_at: string
    /**
     * the currently registered memo (only present if not available)
     * @example "=:ETH.ETH:0x1c7b17362c84287bd1184447e6dfeaf920c31bbe"
     */
    memo?: string
    /**
     * the number of times this reference has been used
     * @example "0"
     */
    usage_count: string
    /**
     * the maximum number of times this reference can be used (0 = unlimited)
     * @example "0"
     */
    max_use: string
}

export interface LockedSupply {
    /**
     * RUNE locked in the reserve module
     * @format int64
     * @example 10000000000
     */
    reserve?: number
}

export interface SupplyResponse {
    /**
     * circulating RUNE supply
     * @format int64
     * @example 30000000000
     */
    circulating: number
    locked?: LockedSupply
    /**
     * total RUNE supply
     * @format int64
     * @example 50000000000
     */
    total: number
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
    public baseUrl: string = 'https://gateway.liquify.com/chain/thorchain_api'
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
 * @title Thornode API
 * @version 3.16.4
 * @baseUrl https://gateway.liquify.com/chain/thorchain_api
 * @contact <devs@thorchain.org>
 *
 * Thornode REST API.
 */
export class Api<SecurityDataType extends unknown> {
    http: HttpClient<SecurityDataType>

    constructor(http: HttpClient<SecurityDataType>) {
        this.http = http
    }

    auth = {
        /**
         * @description Returns account information for the provided address.
         *
         * @tags Auth
         * @name Account
         * @request GET:/auth/accounts/{address}
         */
        account: (
            address: string,
            query?: {
                /**
                 * optional block height, defaults to current tip
                 * @format int64
                 * @min 0
                 */
                height?: number
            },
            params: RequestParams = {}
        ) =>
            this.http.request<AccountResponse, any>({
                path: `/auth/accounts/${address}`,
                method: 'GET',
                query: query,
                format: 'json',
                ...params,
            }),
    }
    bank = {
        /**
         * @description Returns balances for the provided address.
         *
         * @tags Bank
         * @name Balances
         * @request GET:/bank/balances/{address}
         */
        balances: (
            address: string,
            query?: {
                /**
                 * optional block height, defaults to current tip
                 * @format int64
                 * @min 0
                 */
                height?: number
            },
            params: RequestParams = {}
        ) =>
            this.http.request<BalancesResponse, any>({
                path: `/bank/balances/${address}`,
                method: 'GET',
                query: query,
                format: 'json',
                ...params,
            }),
    }
    thorchain = {
        /**
         * No description
         *
         * @tags Health
         * @name Ping
         * @request GET:/thorchain/ping
         */
        ping: (params: RequestParams = {}) =>
            this.http.request<
                {
                    /** @example "pong" */
                    ping?: string
                },
                any
            >({
                path: `/thorchain/ping`,
                method: 'GET',
                format: 'json',
                ...params,
            }),

        /**
         * @description Returns the pool information for the provided asset.
         *
         * @tags Pools
         * @name Pool
         * @request GET:/thorchain/pool/{asset}
         */
        pool: (
            asset: string,
            query?: {
                /**
                 * optional block height, defaults to current tip
                 * @format int64
                 * @min 0
                 */
                height?: number
            },
            params: RequestParams = {}
        ) =>
            this.http.request<PoolResponse, any>({
                path: `/thorchain/pool/${asset}`,
                method: 'GET',
                query: query,
                format: 'json',
                ...params,
            }),

        /**
         * @description Returns the pool information for all assets.
         *
         * @tags Pools
         * @name Pools
         * @request GET:/thorchain/pools
         */
        pools: (
            query?: {
                /**
                 * optional block height, defaults to current tip
                 * @format int64
                 * @min 0
                 */
                height?: number
            },
            params: RequestParams = {}
        ) =>
            this.http.request<PoolsResponse, any>({
                path: `/thorchain/pools`,
                method: 'GET',
                query: query,
                format: 'json',
                ...params,
            }),

        /**
         * @description Returns the pool slip information for the provided asset.
         *
         * @tags PoolSlip
         * @name Poolslip
         * @request GET:/thorchain/slip/{asset}
         */
        poolslip: (
            asset: string,
            query?: {
                /**
                 * optional block height, defaults to current tip
                 * @format int64
                 * @min 0
                 */
                height?: number
            },
            params: RequestParams = {}
        ) =>
            this.http.request<PoolSlipResponse, any>({
                path: `/thorchain/slip/${asset}`,
                method: 'GET',
                query: query,
                format: 'json',
                ...params,
            }),

        /**
         * @description Returns the pool slip information for all Available Layer 1 pool assets.
         *
         * @tags PoolSlip
         * @name Poolslips
         * @request GET:/thorchain/slips
         */
        poolslips: (
            query?: {
                /**
                 * optional block height, defaults to current tip
                 * @format int64
                 * @min 0
                 */
                height?: number
            },
            params: RequestParams = {}
        ) =>
            this.http.request<PoolSlipResponse, any>({
                path: `/thorchain/slips`,
                method: 'GET',
                query: query,
                format: 'json',
                ...params,
            }),

        /**
         * @description Returns the pool information for the provided derived asset.
         *
         * @tags Pools
         * @name Dpool
         * @request GET:/thorchain/dpool/{asset}
         */
        dpool: (
            asset: string,
            query?: {
                /**
                 * optional block height, defaults to current tip
                 * @format int64
                 * @min 0
                 */
                height?: number
            },
            params: RequestParams = {}
        ) =>
            this.http.request<DerivedPoolResponse, any>({
                path: `/thorchain/dpool/${asset}`,
                method: 'GET',
                query: query,
                format: 'json',
                ...params,
            }),

        /**
         * @description Returns the pool information for all derived assets.
         *
         * @tags Pools
         * @name Dpools
         * @request GET:/thorchain/dpools
         */
        dpools: (
            query?: {
                /**
                 * optional block height, defaults to current tip
                 * @format int64
                 * @min 0
                 */
                height?: number
            },
            params: RequestParams = {}
        ) =>
            this.http.request<DerivedPoolsResponse, any>({
                path: `/thorchain/dpools`,
                method: 'GET',
                query: query,
                format: 'json',
                ...params,
            }),

        /**
         * @description Returns the liquidity provider information for an address and asset.
         *
         * @tags Liquidity Providers
         * @name LiquidityProvider
         * @request GET:/thorchain/pool/{asset}/liquidity_provider/{address}
         */
        liquidityProvider: (
            asset: string,
            address: string,
            query?: {
                /**
                 * optional block height, defaults to current tip
                 * @format int64
                 * @min 0
                 */
                height?: number
            },
            params: RequestParams = {}
        ) =>
            this.http.request<LiquidityProviderResponse, any>({
                path: `/thorchain/pool/${asset}/liquidity_provider/${address}`,
                method: 'GET',
                query: query,
                format: 'json',
                ...params,
            }),

        /**
         * @description Returns all liquidity provider information for an asset.
         *
         * @tags Liquidity Providers
         * @name LiquidityProviders
         * @request GET:/thorchain/pool/{asset}/liquidity_providers
         */
        liquidityProviders: (
            asset: string,
            query?: {
                /**
                 * optional block height, defaults to current tip
                 * @format int64
                 * @min 0
                 */
                height?: number
            },
            params: RequestParams = {}
        ) =>
            this.http.request<LiquidityProvidersResponse, any>({
                path: `/thorchain/pool/${asset}/liquidity_providers`,
                method: 'GET',
                query: query,
                format: 'json',
                ...params,
            }),

        /**
         * @description Returns all whitelisted contract codes
         *
         * @tags Codes
         * @name Codes
         * @request GET:/thorchain/codes
         */
        codes: (
            query?: {
                /**
                 * optional block height, defaults to current tip
                 * @format int64
                 * @min 0
                 */
                height?: number
            },
            params: RequestParams = {}
        ) =>
            this.http.request<CodesResponse, any>({
                path: `/thorchain/codes`,
                method: 'GET',
                query: query,
                format: 'json',
                ...params,
            }),

        /**
         * @description Returns oracle price for a symbol.
         *
         * @tags Oracle
         * @name OraclePrice
         * @request GET:/thorchain/oracle/price/{symbol}
         */
        oraclePrice: (
            symbol: string,
            query?: {
                /**
                 * optional block height, defaults to current tip
                 * @format int64
                 * @min 0
                 */
                height?: number
            },
            params: RequestParams = {}
        ) =>
            this.http.request<OraclePriceResponse, any>({
                path: `/thorchain/oracle/price/${symbol}`,
                method: 'GET',
                query: query,
                format: 'json',
                ...params,
            }),

        /**
         * @description Returns all available oracle prices.
         *
         * @tags Oracle
         * @name OraclePrices
         * @request GET:/thorchain/oracle/prices
         */
        oraclePrices: (
            query?: {
                /**
                 * optional block height, defaults to current tip
                 * @format int64
                 * @min 0
                 */
                height?: number
            },
            params: RequestParams = {}
        ) =>
            this.http.request<OraclePricesResponse, any>({
                path: `/thorchain/oracle/prices`,
                method: 'GET',
                query: query,
                format: 'json',
                ...params,
            }),

        /**
         * @description Returns the tcy staker information for an address.
         *
         * @tags TCY Stakers
         * @name TcyStaker
         * @request GET:/thorchain/tcy_staker/{address}
         */
        tcyStaker: (
            address: string,
            query?: {
                /**
                 * optional block height, defaults to current tip
                 * @format int64
                 * @min 0
                 */
                height?: number
            },
            params: RequestParams = {}
        ) =>
            this.http.request<TCYStakerResponse, any>({
                path: `/thorchain/tcy_staker/${address}`,
                method: 'GET',
                query: query,
                format: 'json',
                ...params,
            }),

        /**
         * @description Returns all tcy stakers information.
         *
         * @tags TCY Stakers
         * @name TcyStakers
         * @request GET:/thorchain/tcy_stakers
         */
        tcyStakers: (
            query?: {
                /**
                 * optional block height, defaults to current tip
                 * @format int64
                 * @min 0
                 */
                height?: number
            },
            params: RequestParams = {}
        ) =>
            this.http.request<TCYStakersResponse, any>({
                path: `/thorchain/tcy_stakers`,
                method: 'GET',
                query: query,
                format: 'json',
                ...params,
            }),

        /**
         * @description Returns the tcy claimer information for an address.
         *
         * @tags TCY Claimers
         * @name TcyClaimer
         * @request GET:/thorchain/tcy_claimer/{address}
         */
        tcyClaimer: (
            address: string,
            query?: {
                /**
                 * optional block height, defaults to current tip
                 * @format int64
                 * @min 0
                 */
                height?: number
            },
            params: RequestParams = {}
        ) =>
            this.http.request<TCYClaimerResponse, any>({
                path: `/thorchain/tcy_claimer/${address}`,
                method: 'GET',
                query: query,
                format: 'json',
                ...params,
            }),

        /**
         * @description Returns all tcy claimers information.
         *
         * @tags TCY Claimers
         * @name TcyClaimers
         * @request GET:/thorchain/tcy_claimers
         */
        tcyClaimers: (
            query?: {
                /**
                 * optional block height, defaults to current tip
                 * @format int64
                 * @min 0
                 */
                height?: number
            },
            params: RequestParams = {}
        ) =>
            this.http.request<TCYClaimersResponse, any>({
                path: `/thorchain/tcy_claimers`,
                method: 'GET',
                query: query,
                format: 'json',
                ...params,
            }),

        /**
         * @description Returns the pool information for the RUNE pool.
         *
         * @tags RUNE Pool
         * @name RunePool
         * @request GET:/thorchain/runepool
         */
        runePool: (
            query?: {
                /**
                 * optional block height, defaults to current tip
                 * @format int64
                 * @min 0
                 */
                height?: number
            },
            params: RequestParams = {}
        ) =>
            this.http.request<RUNEPoolResponse, any>({
                path: `/thorchain/runepool`,
                method: 'GET',
                query: query,
                format: 'json',
                ...params,
            }),

        /**
         * @description Returns the RUNE Provider information for an address.
         *
         * @tags RUNE Pool
         * @name RuneProvider
         * @request GET:/thorchain/rune_provider/{address}
         */
        runeProvider: (
            address: string,
            query?: {
                /**
                 * optional block height, defaults to current tip
                 * @format int64
                 * @min 0
                 */
                height?: number
            },
            params: RequestParams = {}
        ) =>
            this.http.request<RUNEProviderResponse, any>({
                path: `/thorchain/rune_provider/${address}`,
                method: 'GET',
                query: query,
                format: 'json',
                ...params,
            }),

        /**
         * @description Returns all RUNE Providers.
         *
         * @tags RUNE Pool
         * @name RuneProviders
         * @request GET:/thorchain/rune_providers
         */
        runeProviders: (
            query?: {
                /**
                 * optional block height, defaults to current tip
                 * @format int64
                 * @min 0
                 */
                height?: number
            },
            params: RequestParams = {}
        ) =>
            this.http.request<RUNEProvidersResponse, any>({
                path: `/thorchain/rune_providers`,
                method: 'GET',
                query: query,
                format: 'json',
                ...params,
            }),

        /**
         * @description Returns the saver position given then savers pool and address.
         *
         * @tags Savers
         * @name Saver
         * @request GET:/thorchain/pool/{asset}/saver/{address}
         */
        saver: (
            asset: string,
            address: string,
            query?: {
                /**
                 * optional block height, defaults to current tip
                 * @format int64
                 * @min 0
                 */
                height?: number
            },
            params: RequestParams = {}
        ) =>
            this.http.request<SaverResponse, any>({
                path: `/thorchain/pool/${asset}/saver/${address}`,
                method: 'GET',
                query: query,
                format: 'json',
                ...params,
            }),

        /**
         * @description Returns all savers for the savers pool.
         *
         * @tags Savers
         * @name Savers
         * @request GET:/thorchain/pool/{asset}/savers
         */
        savers: (
            asset: string,
            query?: {
                /**
                 * optional block height, defaults to current tip
                 * @format int64
                 * @min 0
                 */
                height?: number
            },
            params: RequestParams = {}
        ) =>
            this.http.request<SaversResponse, any>({
                path: `/thorchain/pool/${asset}/savers`,
                method: 'GET',
                query: query,
                format: 'json',
                ...params,
            }),

        /**
         * @description Returns the observed transaction for a provided inbound or outbound hash.
         *
         * @tags Transactions
         * @name Tx
         * @request GET:/thorchain/tx/{hash}
         */
        tx: (
            hash: string,
            query?: {
                /**
                 * optional block height, defaults to current tip
                 * @format int64
                 * @min 0
                 */
                height?: number
            },
            params: RequestParams = {}
        ) =>
            this.http.request<TxResponse, any>({
                path: `/thorchain/tx/${hash}`,
                method: 'GET',
                query: query,
                format: 'json',
                ...params,
            }),

        /**
         * @description Deprecated - migrate to /thorchain/tx/details.
         *
         * @tags Transactions
         * @name TxSignersOld
         * @request GET:/thorchain/tx/{hash}/signers
         */
        txSignersOld: (
            hash: string,
            query?: {
                /**
                 * optional block height, defaults to current tip
                 * @format int64
                 * @min 0
                 */
                height?: number
            },
            params: RequestParams = {}
        ) =>
            this.http.request<TxSignersResponse, any>({
                path: `/thorchain/tx/${hash}/signers`,
                method: 'GET',
                query: query,
                format: 'json',
                ...params,
            }),

        /**
         * @description Returns the signers for a provided inbound or outbound hash.
         *
         * @tags Transactions
         * @name TxSigners
         * @request GET:/thorchain/tx/details/{hash}
         */
        txSigners: (
            hash: string,
            query?: {
                /**
                 * optional block height, defaults to current tip
                 * @format int64
                 * @min 0
                 */
                height?: number
            },
            params: RequestParams = {}
        ) =>
            this.http.request<TxDetailsResponse, any>({
                path: `/thorchain/tx/details/${hash}`,
                method: 'GET',
                query: query,
                format: 'json',
                ...params,
            }),

        /**
         * @description Returns the processing stages of a provided inbound hash.
         *
         * @tags Transactions
         * @name TxStages
         * @request GET:/thorchain/tx/stages/{hash}
         */
        txStages: (
            hash: string,
            query?: {
                /**
                 * optional block height, defaults to current tip
                 * @format int64
                 * @min 0
                 */
                height?: number
            },
            params: RequestParams = {}
        ) =>
            this.http.request<TxStagesResponse, any>({
                path: `/thorchain/tx/stages/${hash}`,
                method: 'GET',
                query: query,
                format: 'json',
                ...params,
            }),

        /**
         * @description Returns the status of a provided inbound hash.
         *
         * @tags Transactions
         * @name TxStatus
         * @request GET:/thorchain/tx/status/{hash}
         */
        txStatus: (
            hash: string,
            query?: {
                /**
                 * optional block height, defaults to current tip
                 * @format int64
                 * @min 0
                 */
                height?: number
            },
            params: RequestParams = {}
        ) =>
            this.http.request<TxStatusResponse, any>({
                path: `/thorchain/tx/status/${hash}`,
                method: 'GET',
                query: query,
                format: 'json',
                ...params,
            }),

        /**
         * @description Returns node information for the provided node address.
         *
         * @tags Nodes
         * @name Node
         * @request GET:/thorchain/node/{address}
         */
        node: (
            address: string,
            query?: {
                /**
                 * optional block height, defaults to current tip
                 * @format int64
                 * @min 0
                 */
                height?: number
            },
            params: RequestParams = {}
        ) =>
            this.http.request<NodeResponse, any>({
                path: `/thorchain/node/${address}`,
                method: 'GET',
                query: query,
                format: 'json',
                ...params,
            }),

        /**
         * @description Returns node information for all registered validators.
         *
         * @tags Nodes
         * @name Nodes
         * @request GET:/thorchain/nodes
         */
        nodes: (
            query?: {
                /**
                 * optional block height, defaults to current tip
                 * @format int64
                 * @min 0
                 */
                height?: number
            },
            params: RequestParams = {}
        ) =>
            this.http.request<NodesResponse, any>({
                path: `/thorchain/nodes`,
                method: 'GET',
                query: query,
                format: 'json',
                ...params,
            }),

        /**
         * @description Returns current asgard vaults.
         *
         * @tags Vaults
         * @name Asgard
         * @request GET:/thorchain/vaults/asgard
         */
        asgard: (
            query?: {
                /**
                 * optional block height, defaults to current tip
                 * @format int64
                 * @min 0
                 */
                height?: number
            },
            params: RequestParams = {}
        ) =>
            this.http.request<VaultsResponse, any>({
                path: `/thorchain/vaults/asgard`,
                method: 'GET',
                query: query,
                format: 'json',
                ...params,
            }),

        /**
         * @description Returns current yggdrasil vaults.
         *
         * @tags Vaults
         * @name Yggdrasil
         * @request GET:/thorchain/vaults/yggdrasil
         */
        yggdrasil: (
            query?: {
                /**
                 * optional block height, defaults to current tip
                 * @format int64
                 * @min 0
                 */
                height?: number
            },
            params: RequestParams = {}
        ) =>
            this.http.request<YggdrasilVaultsResponse, any>({
                path: `/thorchain/vaults/yggdrasil`,
                method: 'GET',
                query: query,
                format: 'json',
                ...params,
            }),

        /**
         * @description Returns the vault for the provided pubkey.
         *
         * @tags Vaults
         * @name Vault
         * @request GET:/thorchain/vault/{pubkey}
         */
        vault: (
            pubkey: string,
            query?: {
                /**
                 * optional block height, defaults to current tip
                 * @format int64
                 * @min 0
                 */
                height?: number
            },
            params: RequestParams = {}
        ) =>
            this.http.request<VaultResponse, any>({
                path: `/thorchain/vault/${pubkey}`,
                method: 'GET',
                query: query,
                format: 'json',
                ...params,
            }),

        /**
         * @description Returns all pubkeys for current vaults.
         *
         * @tags Vaults
         * @name VaultPubkeys
         * @request GET:/thorchain/vaults/pubkeys
         */
        vaultPubkeys: (
            query?: {
                /**
                 * optional block height, defaults to current tip
                 * @format int64
                 * @min 0
                 */
                height?: number
            },
            params: RequestParams = {}
        ) =>
            this.http.request<VaultPubkeysResponse, any>({
                path: `/thorchain/vaults/pubkeys`,
                method: 'GET',
                query: query,
                format: 'json',
                ...params,
            }),

        /**
         * @description Returns aggregate vault solvency showing over-solvent or under-solvent amounts per asset.
         *
         * @tags Vaults
         * @name VaultSolvency
         * @request GET:/thorchain/vaults/solvency
         */
        vaultSolvency: (
            query?: {
                /**
                 * optional block height, defaults to current tip
                 * @format int64
                 * @min 0
                 */
                height?: number
            },
            params: RequestParams = {}
        ) =>
            this.http.request<VaultSolvencyResponse, any>({
                path: `/thorchain/vaults/solvency`,
                method: 'GET',
                query: query,
                format: 'json',
                ...params,
            }),

        /**
         * @description Returns network overview statistics.
         *
         * @tags Network
         * @name Network
         * @request GET:/thorchain/network
         */
        network: (
            query?: {
                /**
                 * optional block height, defaults to current tip
                 * @format int64
                 * @min 0
                 */
                height?: number
            },
            params: RequestParams = {}
        ) =>
            this.http.request<NetworkResponse, any>({
                path: `/thorchain/network`,
                method: 'GET',
                query: query,
                format: 'json',
                ...params,
            }),

        /**
         * @description Returns the last block information for all chains.
         *
         * @tags Network
         * @name OutboundFees
         * @request GET:/thorchain/outbound_fees
         */
        outboundFees: (
            query?: {
                /**
                 * optional block height, defaults to current tip
                 * @format int64
                 * @min 0
                 */
                height?: number
            },
            params: RequestParams = {}
        ) =>
            this.http.request<OutboundFeesResponse, any>({
                path: `/thorchain/outbound_fees`,
                method: 'GET',
                query: query,
                format: 'json',
                ...params,
            }),

        /**
         * @description Returns the outbound fee information for the provided asset.
         *
         * @tags Network
         * @name OutboundFeeAsset
         * @request GET:/thorchain/outbound_fee/{asset}
         */
        outboundFeeAsset: (
            asset: string,
            query?: {
                /**
                 * optional block height, defaults to current tip
                 * @format int64
                 * @min 0
                 */
                height?: number
            },
            params: RequestParams = {}
        ) =>
            this.http.request<OutboundFeesResponse, any>({
                path: `/thorchain/outbound_fee/${asset}`,
                method: 'GET',
                query: query,
                format: 'json',
                ...params,
            }),

        /**
         * @description Returns the set of asgard addresses that should be used for inbound transactions.
         *
         * @tags Network
         * @name InboundAddresses
         * @request GET:/thorchain/inbound_addresses
         */
        inboundAddresses: (
            query?: {
                /**
                 * optional block height, defaults to current tip
                 * @format int64
                 * @min 0
                 */
                height?: number
            },
            params: RequestParams = {}
        ) =>
            this.http.request<InboundAddressesResponse, any>({
                path: `/thorchain/inbound_addresses`,
                method: 'GET',
                query: query,
                format: 'json',
                ...params,
            }),

        /**
         * @description Returns the last block information for all chains.
         *
         * @tags Network
         * @name Lastblock
         * @request GET:/thorchain/lastblock
         */
        lastblock: (
            query?: {
                /**
                 * optional block height, defaults to current tip
                 * @format int64
                 * @min 0
                 */
                height?: number
            },
            params: RequestParams = {}
        ) =>
            this.http.request<LastBlockResponse, any>({
                path: `/thorchain/lastblock`,
                method: 'GET',
                query: query,
                format: 'json',
                ...params,
            }),

        /**
         * @description Returns the last block information for the provided chain.
         *
         * @tags Network
         * @name LastblockChain
         * @request GET:/thorchain/lastblock/{chain}
         */
        lastblockChain: (
            chain: string,
            query?: {
                /**
                 * optional block height, defaults to current tip
                 * @format int64
                 * @min 0
                 */
                height?: number
            },
            params: RequestParams = {}
        ) =>
            this.http.request<LastBlockResponse, any>({
                path: `/thorchain/lastblock/${chain}`,
                method: 'GET',
                query: query,
                format: 'json',
                ...params,
            }),

        /**
         * @description Returns the network's current THORNode version, the network's next THORNode version, and the querier's THORNode version.
         *
         * @tags Network
         * @name Version
         * @request GET:/thorchain/version
         */
        version: (
            query?: {
                /**
                 * optional block height, defaults to current tip
                 * @format int64
                 * @min 0
                 */
                height?: number
            },
            params: RequestParams = {}
        ) =>
            this.http.request<VersionResponse, any>({
                path: `/thorchain/version`,
                method: 'GET',
                query: query,
                format: 'json',
                ...params,
            }),

        /**
         * @description Returns the current upgrade proposals.
         *
         * @tags Network
         * @name UpgradeProposals
         * @request GET:/thorchain/upgrade_proposals
         */
        upgradeProposals: (
            query?: {
                /**
                 * optional block height, defaults to current tip
                 * @format int64
                 * @min 0
                 */
                height?: number
            },
            params: RequestParams = {}
        ) =>
            this.http.request<UpgradeProposalsResponse, any>({
                path: `/thorchain/upgrade_proposals`,
                method: 'GET',
                query: query,
                format: 'json',
                ...params,
            }),

        /**
         * @description Returns the upgrade proposal for the provided name.
         *
         * @tags Network
         * @name UpgradeProposal
         * @request GET:/thorchain/upgrade_proposal/{name}
         */
        upgradeProposal: (
            name: string,
            query?: {
                /**
                 * optional block height, defaults to current tip
                 * @format int64
                 * @min 0
                 */
                height?: number
            },
            params: RequestParams = {}
        ) =>
            this.http.request<UpgradeProposalResponse, any>({
                path: `/thorchain/upgrade_proposal/${name}`,
                method: 'GET',
                query: query,
                format: 'json',
                ...params,
            }),

        /**
         * @description Returns the upgrade votes for the provided name.
         *
         * @tags Network
         * @name UpgradeVotes
         * @request GET:/thorchain/upgrade_votes/{name}
         */
        upgradeVotes: (
            name: string,
            query?: {
                /**
                 * optional block height, defaults to current tip
                 * @format int64
                 * @min 0
                 */
                height?: number
            },
            params: RequestParams = {}
        ) =>
            this.http.request<UpgradeVotesResponse, any>({
                path: `/thorchain/upgrade_votes/${name}`,
                method: 'GET',
                query: query,
                format: 'json',
                ...params,
            }),

        /**
         * @description Returns constant configuration, can be overridden by mimir.
         *
         * @tags Network
         * @name Constants
         * @request GET:/thorchain/constants
         */
        constants: (
            query?: {
                /**
                 * optional block height, defaults to current tip
                 * @format int64
                 * @min 0
                 */
                height?: number
            },
            params: RequestParams = {}
        ) =>
            this.http.request<ConstantsResponse, any>({
                path: `/thorchain/constants`,
                method: 'GET',
                query: query,
                format: 'json',
                ...params,
            }),

        /**
         * @description Returns a boolean indicating whether the chain is in ragnarok.
         *
         * @tags Network
         * @name Ragnarok
         * @request GET:/thorchain/ragnarok
         */
        ragnarok: (
            query?: {
                /**
                 * optional block height, defaults to current tip
                 * @format int64
                 * @min 0
                 */
                height?: number
            },
            params: RequestParams = {}
        ) =>
            this.http.request<boolean, any>({
                path: `/thorchain/ragnarok`,
                method: 'GET',
                query: query,
                format: 'json',
                ...params,
            }),

        /**
         * @description Returns the ban status for the provided node address.
         *
         * @tags Network
         * @name Ban
         * @request GET:/thorchain/ban/{address}
         */
        ban: (
            address: string,
            query?: {
                /**
                 * optional block height, defaults to current tip
                 * @format int64
                 * @min 0
                 */
                height?: number
            },
            params: RequestParams = {}
        ) =>
            this.http.request<BanResponse, any>({
                path: `/thorchain/ban/${address}`,
                method: 'GET',
                query: query,
                format: 'json',
                ...params,
            }),

        /**
         * @description Returns the state of a streaming swap
         *
         * @tags StreamingSwap
         * @name StreamSwap
         * @request GET:/thorchain/swap/streaming/{hash}
         */
        streamSwap: (
            hash: string,
            query?: {
                /**
                 * optional block height, defaults to current tip
                 * @format int64
                 * @min 0
                 */
                height?: number
            },
            params: RequestParams = {}
        ) =>
            this.http.request<StreamingSwapResponse, any>({
                path: `/thorchain/swap/streaming/${hash}`,
                method: 'GET',
                query: query,
                format: 'json',
                ...params,
            }),

        /**
         * @description Returns the state of all streaming swaps
         *
         * @tags StreamingSwap
         * @name StreamSwaps
         * @request GET:/thorchain/swaps/streaming
         */
        streamSwaps: (
            query?: {
                /**
                 * optional block height, defaults to current tip
                 * @format int64
                 * @min 0
                 */
                height?: number
            },
            params: RequestParams = {}
        ) =>
            this.http.request<StreamingSwapsResponse, any>({
                path: `/thorchain/swaps/streaming`,
                method: 'GET',
                query: query,
                format: 'json',
                ...params,
            }),

        /**
         * @description Returns the clout score of an address
         *
         * @tags Clout
         * @name SwapperClout
         * @request GET:/thorchain/clout/swap/{address}
         */
        swapperClout: (
            address: string,
            query?: {
                /**
                 * optional block height, defaults to current tip
                 * @format int64
                 * @min 0
                 */
                height?: number
            },
            params: RequestParams = {}
        ) =>
            this.http.request<SwapperCloutResponse, any>({
                path: `/thorchain/clout/swap/${address}`,
                method: 'GET',
                query: query,
                format: 'json',
                ...params,
            }),

        /**
         * @description Returns the total units and depth of a trade asset
         *
         * @tags TradeUnit
         * @name TradeUnit
         * @request GET:/thorchain/trade/unit/{asset}
         */
        tradeUnit: (
            asset: string,
            query?: {
                /**
                 * optional block height, defaults to current tip
                 * @format int64
                 * @min 0
                 */
                height?: number
            },
            params: RequestParams = {}
        ) =>
            this.http.request<TradeUnitResponse, any>({
                path: `/thorchain/trade/unit/${asset}`,
                method: 'GET',
                query: query,
                format: 'json',
                ...params,
            }),

        /**
         * @description Returns the total units and depth for each trade asset
         *
         * @tags TradeUnits
         * @name TradeUnits
         * @request GET:/thorchain/trade/units
         */
        tradeUnits: (
            query?: {
                /**
                 * optional block height, defaults to current tip
                 * @format int64
                 * @min 0
                 */
                height?: number
            },
            params: RequestParams = {}
        ) =>
            this.http.request<TradeUnitsResponse, any>({
                path: `/thorchain/trade/units`,
                method: 'GET',
                query: query,
                format: 'json',
                ...params,
            }),

        /**
         * @description Returns the units and depth of a trade account
         *
         * @tags TradeAccount
         * @name TradeAccount
         * @request GET:/thorchain/trade/account/{address}
         */
        tradeAccount: (
            address: string,
            query?: {
                /**
                 * optional block height, defaults to current tip
                 * @format int64
                 * @min 0
                 */
                height?: number
            },
            params: RequestParams = {}
        ) =>
            this.http.request<TradeAccountResponse, any>({
                path: `/thorchain/trade/account/${address}`,
                method: 'GET',
                query: query,
                format: 'json',
                ...params,
            }),

        /**
         * @description Returns all trade accounts for an asset
         *
         * @tags TradeAccounts
         * @name TradeAccounts
         * @request GET:/thorchain/trade/accounts/{asset}
         */
        tradeAccounts: (
            asset: string,
            query?: {
                /**
                 * optional block height, defaults to current tip
                 * @format int64
                 * @min 0
                 */
                height?: number
            },
            params: RequestParams = {}
        ) =>
            this.http.request<TradeAccountsResponse, any>({
                path: `/thorchain/trade/accounts/${asset}`,
                method: 'GET',
                query: query,
                format: 'json',
                ...params,
            }),

        /**
         * @description Returns the total size and ratio of a secured asset
         *
         * @tags SecuredAsset
         * @name SecuredAsset
         * @request GET:/thorchain/securedasset/{asset}
         */
        securedAsset: (
            asset: string,
            query?: {
                /**
                 * optional block height, defaults to current tip
                 * @format int64
                 * @min 0
                 */
                height?: number
            },
            params: RequestParams = {}
        ) =>
            this.http.request<SecuredAssetResponse, any>({
                path: `/thorchain/securedasset/${asset}`,
                method: 'GET',
                query: query,
                format: 'json',
                ...params,
            }),

        /**
         * @description Returns the total size and ratio of all secured asset
         *
         * @tags SecuredAssets
         * @name SecuredAssets
         * @request GET:/thorchain/securedassets
         */
        securedAssets: (
            query?: {
                /**
                 * optional block height, defaults to current tip
                 * @format int64
                 * @min 0
                 */
                height?: number
            },
            params: RequestParams = {}
        ) =>
            this.http.request<SecuredAssetsResponse, any>({
                path: `/thorchain/securedassets`,
                method: 'GET',
                query: query,
                format: 'json',
                ...params,
            }),

        /**
         * @description Returns detailed information about a specific swap including its state.
         *
         * @tags Swap
         * @name SwapDetails
         * @request GET:/thorchain/queue/swap/details/{tx_id}
         */
        swapDetails: (
            txId: string,
            query?: {
                /**
                 * optional block height, defaults to current tip
                 * @format int64
                 * @min 0
                 */
                height?: number
            },
            params: RequestParams = {}
        ) =>
            this.http.request<SwapDetailsResponse, void>({
                path: `/thorchain/queue/swap/details/${txId}`,
                method: 'GET',
                query: query,
                format: 'json',
                ...params,
            }),

        /**
         * @description Returns queue statistics.
         *
         * @tags Queue
         * @name Queue
         * @request GET:/thorchain/queue
         */
        queue: (
            query?: {
                /**
                 * optional block height, defaults to current tip
                 * @format int64
                 * @min 0
                 */
                height?: number
            },
            params: RequestParams = {}
        ) =>
            this.http.request<QueueResponse, any>({
                path: `/thorchain/queue`,
                method: 'GET',
                query: query,
                format: 'json',
                ...params,
            }),

        /**
         * @description Returns the swap queue.
         *
         * @tags Queue
         * @name QueueSwap
         * @request GET:/thorchain/queue/swap
         */
        queueSwap: (
            query?: {
                /**
                 * optional block height, defaults to current tip
                 * @format int64
                 * @min 0
                 */
                height?: number
            },
            params: RequestParams = {}
        ) =>
            this.http.request<SwapQueueResponse, any>({
                path: `/thorchain/queue/swap`,
                method: 'GET',
                query: query,
                format: 'json',
                ...params,
            }),

        /**
         * @description Returns limit swaps with pagination and filtering.
         *
         * @tags Queue
         * @name LimitSwaps
         * @request GET:/thorchain/queue/limit_swaps
         */
        limitSwaps: (
            query?: {
                /**
                 * optional block height, defaults to current tip
                 * @format int64
                 * @min 0
                 */
                height?: number
                /**
                 * Number of items to skip
                 * @default 0
                 */
                offset?: number
                /**
                 * Number of items to return
                 * @max 1000
                 * @default 100
                 */
                limit?: number
                /** Filter by source asset (e.g., "BTC.BTC") */
                source_asset?: string
                /** Filter by target asset (e.g., "ETH.ETH") */
                target_asset?: string
                /** Filter by sender address */
                sender?: string
                /**
                 * Sort by field
                 * @default "ratio"
                 */
                sort_by?: 'ratio' | 'age' | 'amount' | 'created_height'
                /**
                 * Sort order
                 * @default "asc"
                 */
                sort_order?: 'asc' | 'desc'
            },
            params: RequestParams = {}
        ) =>
            this.http.request<LimitSwapsResponse, any>({
                path: `/thorchain/queue/limit_swaps`,
                method: 'GET',
                query: query,
                format: 'json',
                ...params,
            }),

        /**
         * @description Returns limit swaps summary statistics.
         *
         * @tags Queue
         * @name LimitSwapsSummary
         * @request GET:/thorchain/queue/limit_swaps/summary
         */
        limitSwapsSummary: (
            query?: {
                /**
                 * optional block height, defaults to current tip
                 * @format int64
                 * @min 0
                 */
                height?: number
                /** Filter by source asset (e.g., "BTC.BTC") */
                source_asset?: string
                /** Filter by target asset (e.g., "ETH.ETH") */
                target_asset?: string
            },
            params: RequestParams = {}
        ) =>
            this.http.request<LimitSwapsSummaryResponse, any>({
                path: `/thorchain/queue/limit_swaps/summary`,
                method: 'GET',
                query: query,
                format: 'json',
                ...params,
            }),

        /**
         * @description Returns the scheduled queue.
         *
         * @tags Queue
         * @name QueueScheduled
         * @request GET:/thorchain/queue/scheduled
         */
        queueScheduled: (
            query?: {
                /**
                 * optional block height, defaults to current tip
                 * @format int64
                 * @min 0
                 */
                height?: number
            },
            params: RequestParams = {}
        ) =>
            this.http.request<ScheduledResponse, any>({
                path: `/thorchain/queue/scheduled`,
                method: 'GET',
                query: query,
                format: 'json',
                ...params,
            }),

        /**
         * @description Returns the outbound queue including estimated RUNE values.
         *
         * @tags Queue
         * @name QueueOutbound
         * @request GET:/thorchain/queue/outbound
         */
        queueOutbound: (
            query?: {
                /**
                 * optional block height, defaults to current tip
                 * @format int64
                 * @min 0
                 */
                height?: number
            },
            params: RequestParams = {}
        ) =>
            this.http.request<OutboundResponse, any>({
                path: `/thorchain/queue/outbound`,
                method: 'GET',
                query: query,
                format: 'json',
                ...params,
            }),

        /**
         * @description Returns keysign information for the provided height - the height being the first block a tx out item appears in the signed-but-unobserved outbound queue.
         *
         * @tags TSS
         * @name Keysign
         * @request GET:/thorchain/keysign/{height}
         */
        keysign: (height: number, params: RequestParams = {}) =>
            this.http.request<KeysignResponse, any>({
                path: `/thorchain/keysign/${height}`,
                method: 'GET',
                format: 'json',
                ...params,
            }),

        /**
         * @description Returns keysign information for the provided height and pubkey - the height being the block at which a tx out item is scheduled to be signed and moved from the scheduled outbound queue to the outbound queue.
         *
         * @tags TSS
         * @name KeysignPubkey
         * @request GET:/thorchain/keysign/{height}/{pubkey}
         */
        keysignPubkey: (height: number, pubkey: string, params: RequestParams = {}) =>
            this.http.request<KeysignResponse, any>({
                path: `/thorchain/keysign/${height}/${pubkey}`,
                method: 'GET',
                format: 'json',
                ...params,
            }),

        /**
         * @description Returns keygen information for the provided height and pubkey - the pubkey being of one of the members of a keygen block for that height
         *
         * @tags TSS
         * @name KeygenPubkey
         * @request GET:/thorchain/keygen/{height}/{pubkey}
         */
        keygenPubkey: (height: number, pubkey: string, params: RequestParams = {}) =>
            this.http.request<KeygenResponse, any>({
                path: `/thorchain/keygen/${height}/${pubkey}`,
                method: 'GET',
                format: 'json',
                ...params,
            }),

        /**
         * @description Returns keygen and keysign metrics for current vaults.
         *
         * @tags TSS
         * @name Metrics
         * @request GET:/thorchain/metrics
         */
        metrics: (
            query?: {
                /**
                 * optional block height, defaults to current tip
                 * @format int64
                 * @min 0
                 */
                height?: number
            },
            params: RequestParams = {}
        ) =>
            this.http.request<MetricsResponse, any>({
                path: `/thorchain/metrics`,
                method: 'GET',
                query: query,
                format: 'json',
                ...params,
            }),

        /**
         * @description Returns keygen metrics for the provided vault pubkey.
         *
         * @tags TSS
         * @name MetricsKeygen
         * @request GET:/thorchain/metric/keygen/{pubkey}
         */
        metricsKeygen: (
            pubkey: string,
            query?: {
                /**
                 * optional block height, defaults to current tip
                 * @format int64
                 * @min 0
                 */
                height?: number
            },
            params: RequestParams = {}
        ) =>
            this.http.request<KeygenMetricsResponse, any>({
                path: `/thorchain/metric/keygen/${pubkey}`,
                method: 'GET',
                query: query,
                format: 'json',
                ...params,
            }),

        /**
         * @description Returns addresses registered to the provided thorname.
         *
         * @tags Thornames
         * @name Thorname
         * @request GET:/thorchain/thorname/{name}
         */
        thorname: (
            name: string,
            query?: {
                /**
                 * optional block height, defaults to current tip
                 * @format int64
                 * @min 0
                 */
                height?: number
            },
            params: RequestParams = {}
        ) =>
            this.http.request<ThornameResponse, any>({
                path: `/thorchain/thorname/${name}`,
                method: 'GET',
                query: query,
                format: 'json',
                ...params,
            }),

        /**
         * @description Returns current active mimir configuration.
         *
         * @tags Mimir
         * @name Mimir
         * @request GET:/thorchain/mimir
         */
        mimir: (
            query?: {
                /**
                 * optional block height, defaults to current tip
                 * @format int64
                 * @min 0
                 */
                height?: number
            },
            params: RequestParams = {}
        ) =>
            this.http.request<MimirResponse, any>({
                path: `/thorchain/mimir`,
                method: 'GET',
                query: query,
                format: 'json',
                ...params,
            }),

        /**
         * @description Returns current active mimir configuration for the provided key.
         *
         * @tags Mimir
         * @name MimirKey
         * @request GET:/thorchain/mimir/key/{key}
         */
        mimirKey: (
            key: string,
            query?: {
                /**
                 * optional block height, defaults to current tip
                 * @format int64
                 * @min 0
                 */
                height?: number
            },
            params: RequestParams = {}
        ) =>
            this.http.request<number, any>({
                path: `/thorchain/mimir/key/${key}`,
                method: 'GET',
                query: query,
                format: 'json',
                ...params,
            }),

        /**
         * @description Returns current admin mimir configuration.
         *
         * @tags Mimir
         * @name MimirAdmin
         * @request GET:/thorchain/mimir/admin
         */
        mimirAdmin: (
            query?: {
                /**
                 * optional block height, defaults to current tip
                 * @format int64
                 * @min 0
                 */
                height?: number
            },
            params: RequestParams = {}
        ) =>
            this.http.request<MimirResponse, any>({
                path: `/thorchain/mimir/admin`,
                method: 'GET',
                query: query,
                format: 'json',
                ...params,
            }),

        /**
         * @description Returns current node mimir votes.
         *
         * @tags Mimir
         * @name MimirNodes
         * @request GET:/thorchain/mimir/nodes_all
         */
        mimirNodes: (
            query?: {
                /**
                 * optional block height, defaults to current tip
                 * @format int64
                 * @min 0
                 */
                height?: number
            },
            params: RequestParams = {}
        ) =>
            this.http.request<MimirNodesResponse, any>({
                path: `/thorchain/mimir/nodes_all`,
                method: 'GET',
                query: query,
                format: 'json',
                ...params,
            }),

        /**
         * @description Returns current node mimir configuration for the provided node address.
         *
         * @tags Mimir
         * @name MimirNode
         * @request GET:/thorchain/mimir/node/{address}
         */
        mimirNode: (
            address: string,
            query?: {
                /**
                 * optional block height, defaults to current tip
                 * @format int64
                 * @min 0
                 */
                height?: number
            },
            params: RequestParams = {}
        ) =>
            this.http.request<MimirResponse, any>({
                path: `/thorchain/mimir/node/${address}`,
                method: 'GET',
                query: query,
                format: 'json',
                ...params,
            }),

        /**
         * @description Returns the memoless transaction memo for the provided asset and reference number.
         *
         * @tags Reference Memos
         * @name ReferenceMemo
         * @request GET:/thorchain/memo/{asset}/{reference}
         */
        referenceMemo: (
            asset: string,
            reference: string,
            query?: {
                /**
                 * optional block height, defaults to current tip
                 * @format int64
                 * @min 0
                 */
                height?: number
            },
            params: RequestParams = {}
        ) =>
            this.http.request<ReferenceMemoResponse, any>({
                path: `/thorchain/memo/${asset}/${reference}`,
                method: 'GET',
                query: query,
                format: 'json',
                ...params,
            }),

        /**
         * @description Returns the memoless transaction memo for the provided reference hash.
         *
         * @tags Reference Memos
         * @name ReferenceMemoByHash
         * @request GET:/thorchain/memo/{hash}
         */
        referenceMemoByHash: (
            hash: string,
            query?: {
                /**
                 * optional block height, defaults to current tip
                 * @format int64
                 * @min 0
                 */
                height?: number
            },
            params: RequestParams = {}
        ) =>
            this.http.request<ReferenceMemoResponse, any>({
                path: `/thorchain/memo/${hash}`,
                method: 'GET',
                query: query,
                format: 'json',
                ...params,
            }),

        /**
         * @description Pre-flight check for memoless transactions. Returns what reference would be extracted from the amount and whether it's available for registration.
         *
         * @tags Reference Memos
         * @name ReferenceMemoCheck
         * @request GET:/thorchain/memo/check/{asset}/{amount}
         */
        referenceMemoCheck: (
            asset: string,
            amount: string,
            query?: {
                /**
                 * optional block height, defaults to current tip
                 * @format int64
                 * @min 0
                 */
                height?: number
            },
            params: RequestParams = {}
        ) =>
            this.http.request<ReferenceMemoPreflightResponse, any>({
                path: `/thorchain/memo/check/${asset}/${amount}`,
                method: 'GET',
                query: query,
                format: 'json',
                ...params,
            }),

        /**
         * @description Provide a quote estimate for the provided swap.
         *
         * @tags Quote
         * @name Quoteswap
         * @request GET:/thorchain/quote/swap
         */
        quoteswap: (
            query?: {
                /**
                 * optional block height, defaults to current tip
                 * @format int64
                 * @min 0
                 */
                height?: number
                /**
                 * the source asset
                 * @example "BTC.BTC"
                 */
                from_asset?: string
                /**
                 * the target asset
                 * @example "ETH.ETH"
                 */
                to_asset?: string
                /**
                 * the source asset amount in 1e8 decimals
                 * @format int64
                 * @example 1000000
                 */
                amount?: number
                /**
                 * the destination address, required to generate memo
                 * @example "0x1c7b17362c84287bd1184447e6dfeaf920c31bbe"
                 */
                destination?: string
                /**
                 * the refund address, refunds will be sent here if the swap fails
                 * @example "0x1c7b17362c84287bd1184447e6dfeaf920c31bbe"
                 */
                refund_address?: string
                /**
                 * the interval in which streaming swaps are swapped
                 * @format int64
                 * @example 10
                 */
                streaming_interval?: number
                /**
                 * the quantity of swaps within a streaming swap
                 * @format int64
                 * @example 10
                 */
                streaming_quantity?: number
                /**
                 * the maximum basis points from the current feeless swap price to set the limit in the generated memo
                 * @format int64
                 * @example 100
                 */
                tolerance_bps?: number
                /**
                 * the maximum basis points of tolerance for pool price movements to set the limit in the generated memo
                 * @format int64
                 * @example 100
                 */
                liquidity_tolerance_bps?: number
                /**
                 * the affiliate fee in basis points
                 * @format int64
                 * @example 100
                 */
                affiliate_bps?: number
                /**
                 * the affiliate (address or thorname)
                 * @example "t"
                 */
                affiliate?: string
            },
            params: RequestParams = {}
        ) =>
            this.http.request<QuoteSwapResponse, any>({
                path: `/thorchain/quote/swap`,
                method: 'GET',
                query: query,
                format: 'json',
                ...params,
            }),

        /**
         * @description Provide a limit order quote and memo for the provided limit order
         *
         * @tags Limit Order
         * @name Quotelimit
         * @request GET:/thorchain/quote/limit
         */
        quotelimit: (
            query?: {
                /**
                 * optional block height, defaults to current tip
                 * @format int64
                 * @min 0
                 */
                height?: number
                /**
                 * the source asset
                 * @example "BTC.BTC"
                 */
                from_asset?: string
                /**
                 * the target asset
                 * @example "ETH.ETH"
                 */
                to_asset?: string
                /**
                 * the source asset amount in 1e8 decimals
                 * @format int64
                 * @example 1000000
                 */
                amount?: number
                /**
                 * the destination address, required to generate memo
                 * @example "0x1c7b17362c84287bd1184447e6dfeaf920c31bbe"
                 */
                destination?: string
                /**
                 * the refund address, refunds will be sent here if the swap fails
                 * @example "0x1c7b17362c84287bd1184447e6dfeaf920c31bbe"
                 */
                refund_address?: string
                /**
                 * the custom TTL in blocks for limit orders
                 * @format int64
                 * @example 10
                 */
                custom_ttl?: number
                /**
                 * the quantity of swaps within a streaming swap
                 * @format int64
                 * @example 10
                 */
                streaming_quantity?: number
                /**
                 * the affiliate fee in basis points
                 * @format int64
                 * @example 100
                 */
                affiliate_bps?: number
                /**
                 * the affiliate (address or thorname)
                 * @example "t"
                 */
                affiliate?: string
            },
            params: RequestParams = {}
        ) =>
            this.http.request<QuoteLimitResponse, any>({
                path: `/thorchain/quote/limit`,
                method: 'GET',
                query: query,
                format: 'json',
                ...params,
            }),

        /**
         * @description Returns result of running the given invariant.
         *
         * @tags Invariants
         * @name Invariant
         * @request GET:/thorchain/invariant/{invariant}
         */
        invariant: (
            invariant: string,
            query?: {
                /**
                 * optional block height, defaults to current tip
                 * @format int64
                 * @min 0
                 */
                height?: number
            },
            params: RequestParams = {}
        ) =>
            this.http.request<InvariantResponse, any>({
                path: `/thorchain/invariant/${invariant}`,
                method: 'GET',
                query: query,
                format: 'json',
                ...params,
            }),

        /**
         * @description Returns a list of available invariants.
         *
         * @tags Invariants
         * @name Invariants
         * @request GET:/thorchain/invariants
         */
        invariants: (
            query?: {
                /**
                 * optional block height, defaults to current tip
                 * @format int64
                 * @min 0
                 */
                height?: number
            },
            params: RequestParams = {}
        ) =>
            this.http.request<InvariantsResponse, any>({
                path: `/thorchain/invariants`,
                method: 'GET',
                query: query,
                format: 'json',
                ...params,
            }),

        /**
         * @description Returns verbose details of the block.
         *
         * @tags Block
         * @name Block
         * @request GET:/thorchain/block
         */
        block: (
            query?: {
                /**
                 * optional block height, defaults to current tip
                 * @format int64
                 * @min 0
                 */
                height?: number
            },
            params: RequestParams = {}
        ) =>
            this.http.request<BlockResponse, any>({
                path: `/thorchain/block`,
                method: 'GET',
                query: query,
                format: 'json',
                ...params,
            }),

        /**
         * @description Returns genesis export
         *
         * @tags Export
         * @name Export
         * @request GET:/thorchain/export
         */
        export: (params: RequestParams = {}) =>
            this.http.request<ExportResponse, any>({
                path: `/thorchain/export`,
                method: 'GET',
                format: 'json',
                ...params,
            }),

        /**
         * @description Returns the RUNE supply breakdown.
         *
         * @tags Supply
         * @name Supply
         * @request GET:/thorchain/supply
         */
        supply: (
            query?: {
                /**
                 * optional block height, defaults to current tip
                 * @format int64
                 * @min 0
                 */
                height?: number
            },
            params: RequestParams = {}
        ) =>
            this.http.request<SupplyResponse, any>({
                path: `/thorchain/supply`,
                method: 'GET',
                query: query,
                format: 'json',
                ...params,
            }),

        /**
         * @description Returns a single supply value as plain text for CoinMarketCap integration.
         *
         * @tags Supply
         * @name SupplyCmc
         * @request GET:/thorchain/supply/cmc
         */
        supplyCmc: (
            query: {
                /** The asset to query supply for (default rune). */
                asset?: 'rune' | 'tcy'
                /** The type of supply value to return. */
                type: 'circulating' | 'total' | 'locked' | 'staked'
            },
            params: RequestParams = {}
        ) =>
            this.http.request<number, any>({
                path: `/thorchain/supply/cmc`,
                method: 'GET',
                query: query,
                ...params,
            }),
    }
}
