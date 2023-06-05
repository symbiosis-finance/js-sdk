# symbiosis-js-sdk

[![Build Status](https://drone.symbiosis.finance/api/badges/symbiosis-finance/sdk/status.svg)](https://drone.symbiosis.finance/symbiosis-finance/sdk)

## Docs

You can find js-sdk docs here - https://docs.symbiosis.finance/developer-tools/symbiosis-js-sdk

## Installation

```bash
npm i symbiosis-js-sdk
```

## Install dependencies

```bash
npm i
```

## Run tests

```bash
npm run test
```

## Upgrade version

For upgrade versions should be use [npm versions](https://docs.npmjs.com/cli/v8/commands/npm-version) command. Version will upgrade automatically.

```bash
npm version major|minor|patch
```

# How To Use

The current implementation use [ethers](https://docs.ethers.io/v5/) to interact with the Ethereum like blockchains.

## Init Symbiosis SDK

To work with Symbiosis SDK you should init `Symbiosis` instance with config (check `Config` type) and your `CLIENT_ID`.

```ts
import { Symbiosis } from 'symbiosis-js-sdk'

const symbiosis = new Symbiosis('mainnet', 'awesome-app')
```

## Swapping

A combination of uniswap and bridging allowing you to swap any supported tokens between networks.

```ts
const swapping = symbiosis.newSwapping()

// Response contains everything you need to send a transaction by yourself
const swappingResponse = await swapping.exactIn(
    tokenAmountIn, // TokenAmount object
    tokenOut, // Token object
    from, // from account address
    to, // to account address
    revertableAddress, // account who can revert stucked transaction
    slippage, // slippage
    deadline, // deadline date in seconds
    useAggregators // boolean (use 1inch or OpenOcean router for swaps. default = true)
)

// Send transaction using EVM or Tron client library.
const txHash = ...

// Wait for transaction to be completed on recipient chain
const recipientTxHash = await symbiosis.waitForComplete(tokenOut.chainId, txHash)
```

Full examples with `ethers.js` and `TronWeb` you can find in [examples](./examples/) folder.

## Zapping to Symbiosis

Cross-chain zaps automate liquidity adding to the Symbiosis stable pools, DeFi protocols, NFT, etc.

```ts
// Create new Swapping instance
const swapping = symbiosis.newZapping()

// Calculates fee for bridging between networks and get execute function
const { transactionRequest, fee, tokenAmountOut, route, priceImpact, type } = await swapping.exactIn(
    tokenAmountIn, // TokenAmount object
    poolAddress, // Stable pool address
    poolChainId, // Stable pool chain id
    from, // from account address
    to, // to account address
    revertableAddress, // account who can revert stucked transaction
    slippage, // slippage
    deadline, // deadline date in seconds
    useAggregators // boolean (use 1inch or OpenOcean router for swaps)
)
```

All next steps as in swapping example

## Zapping to Aave/Cream

Cross-chain zaps automate liquidity adding to the Symbiosis stable pools, DeFi protocols, NFT, etc.

```ts
// Create new Swapping instance
const swapping = symbiosis.newZappingAave()`or`
const swapping = symbiosis.newZappingCream()

// Calculates fee for bridging between networks and get execute function
const { transactionRequest, fee, tokenAmountOut, route, priceImpact, type } = await swapping.exactIn(
    tokenAmountIn, // TokenAmount object
    tokenOut, // Token object
    from, // from account address
    to, // to account address
    revertableAddress, // account who can revert stucked transaction
    slippage, // slippage
    deadline, // deadline date in seconds
    useAggregators // boolean (use 1inch or OpenOcean router for swaps)
)
```

All next steps as in swapping example

## Bridging

Bridging allows you to swap stable tokens between chains.

```ts
// Create new Bridging instance
const bridging = symbiosis.newBridging()

// Calculates fee and prepares calldata for bridging
const bridgingResponse = await bridging.exactIn(
    tokenAmountIn, // TokenAmount object
    tokenOut, // Token object
    to, // to account address
    revertableAddress // account who can revert stucked transaction
)

// Send transaction on sender chain using your client library (check swapping example)
const txHash = ...

// Wait for transaction to be completed on recipient chain
const recipientTxHash = await symbiosis.waitForComplete(tokenOut.chainId, txHash)
```

## Get stuck (pending) transactions and revert them

Sometimes relayers are unable to process your request for bridging. This could happen if you set the small/wrong fee or send the invalid calldata.

These requests can be found and cancelled.

### Find stuck transactions:

```ts
import { getPendingRequests } from 'symbiosis-js-sdk'

// Get get all pending requests from all chains
const pendingRequests = await symbiosis.getPendingRequests(
    address // Account address
)
```

### Revert stucked transaction:

```ts
const revertPending = symbiosis.newRevertPending(request)

// transactionRequest contains everything you need to send a transaction by yourself
const { transactionRequest } = await revertPending.revert()

... // Send transaction

// Wait for transaction to be completed on recipient chain
const log = await revertPending.waitForComplete()
```
