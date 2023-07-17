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
// Create new Swapping instance
const swapping = symbiosis.bestPoolSwapping()

// Calculates fee for swapping between networks and get execute function
const { transactionRequest } = await swapping.exactIn({
    tokenAmountIn, // TokenAmount object
    tokenOut, // Token object
    from, // from account address
    to, // to account address
    revertableAddress, // account who can revert stucked transaction
    slippage, // slippage
    deadline // deadline date in seconds
})

// Send transactionRequest and get receipt
const receipt = ...

// Wait for transaction to be completed on destination chain
const log = await swapping.waitForComplete(receipt)
```

## Zapping to Symbiosis

Cross-chain zaps automate liquidity adding to the Symbiosis stable pools, DeFi protocols, NFT, etc.

```ts
// Create new Swapping instance
const swapping = symbiosis.newZapping(omniPoolConfig)

// Calculates fee for bridging between networks and get execute function
const { execute, fee, tokenAmountOut, route, priceImpact } = await swapping.exactIn({
    tokenAmountIn, // TokenAmount object
    from, // from account address
    to, // to account address
    revertableAddress, // account who can revert stucked transaction
    slippage, // slippage
    deadline, // deadline date in seconds
})
```

All next steps as in swapping example

## Bridging

Bridging allows you to swap stable tokens between chains.

```ts
// Create new Bridging instance
const bridging = symbiosis.newBridging()

// Calculates fee for bridging and get execute function
const { transactionRequest } = await bridging.exactIn({
    tokenAmountIn, // TokenAmount object
    tokenOut, // Token object
    to, // to account address
    revertableAddress // account who can revert stucked transaction
})

// Send transaction or get receipt
const receipt = ...

// Wait for transaction to be completed on recipient chain
const log = await bridging.waitForComplete(receipt)
```

### Revert stucked transaction:

```ts
// Create RevertPending instance
const revertPending = symbiosis.newRevertPending(
    request // PendingRequest object
)

// transactionRequest contains everything you need to send a transaction by yourself
const { transactionRequest } = await revertPending.revert()

... // Send transaction

// Wait for transaction to be completed on recipient chain
const log = await revertPending.waitForComplete()
```
