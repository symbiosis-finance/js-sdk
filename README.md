# symbiosis-js-sdk

[![Build Status](https://drone.symbiosis.finance/api/badges/symbiosis-finance/sdk/status.svg)](https://drone.symbiosis.finance/symbiosis-finance/sdk)

## Docs
You can find js-sdk docs here - https://sdk.symbiosis.finance/

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
// Create new Swapping instance
const swapping = symbiosis.newSwapping()

// Calculates fee for swapping between networks and get execute function
const { execute, fee, tokenAmountOut, route, priceImpact } = await swapping.exactIn(
    tokenAmountIn, // TokenAmount object
    tokenOut, // Token object
    from, // from account address
    to, // to account address
    revertableAddress, // account who can revert stucked transaction
    slippage, // slippage
    deadline, // deadline date in seconds
    use1Inch // boolean (use 1inch router for swaps. default = true)
)

// Execute transaction
const { response, waitForMined } = await execute(
    signer // ethers Signer instance to sign transaction
)

// Wait for transaction to be mined
const { receipt, waitForComplete } = await waitForMined()

// Wait for transaction to be completed on recipient chain
const log = await waitForComplete()
```

### Send swapping transaction manually

```ts
const swapping = symbiosis.newSwapping()

// transactionRequest contains everything you need to send a transaction by yourself
const { transactionRequest } = await swapping.exactIn(...)

// Send transaction or get receipt
const receipt = ...

// Wait for transaction to be completed on recipient chain
const log = await swapping.waitForComplete(receipt)
```


## Zapping to Symbiosis

Cross-chain zaps automate liquidity adding to the Symbiosis stable pools, DeFi protocols, NFT, etc. 

```ts
// Create new Swapping instance
const swapping = symbiosis.newZapping()

// Calculates fee for bridging between networks and get execute function
const { execute, fee, tokenAmountOut, route, priceImpact } = await swapping.exactIn(
    tokenAmountIn, // TokenAmount object
    poolAddress, // Stable pool address 
    poolChainId, // Stable pool chain id 
    from, // from account address
    to, // to account address
    revertableAddress, // account who can revert stucked transaction
    slippage, // slippage
    deadline, // deadline date in seconds
    use1Inch // boolean (use 1inch router for swaps)
)

```
All next steps as in swapping example

## Zapping to Aave/Cream

Cross-chain zaps automate liquidity adding to the Symbiosis stable pools, DeFi protocols, NFT, etc. 

```ts
// Create new Swapping instance
const swapping = symbiosis.newZappingAave()
`or`
const swapping = symbiosis.newZappingCream()

// Calculates fee for bridging between networks and get execute function
const { execute, fee, tokenAmountOut, route, priceImpact } = await swapping.exactIn(
    tokenAmountIn, // TokenAmount object
    tokenOut, // Token object
    from, // from account address
    to, // to account address
    revertableAddress, // account who can revert stucked transaction
    slippage, // slippage
    deadline, // deadline date in seconds
    use1Inch // boolean (use 1inch router for swaps)
)

```
All next steps as in swapping example

## Bridging

Bridging allows you to swap stable tokens between chains.

```ts
// Create new Bridging instance
const bridging = symbiosis.newBridging()

// Calculates fee for bridging and get execute function
const { execute, fee, tokenAmountOut } = await bridging.exactIn(
    tokenAmountIn, // TokenAmount object
    tokenOut, // Token object
    to, // to account address
    revertableAddress // account who can revert stucked transaction
)

// Execute transaction
const { response, waitForMined } = await execute(
    signer // ethers Signer instance to sign transaction
)

// Wait for transaction to be mined
const { receipt, waitForComplete } = await waitForMined()

// Wait for transaction to be completed on recipient chain
const log = await waitForComplete()
```

### Send bridging transaction manually

```ts
const bridging = symbiosis.newBridging()

// transactionRequest contains everything you need to send a transaction by yourself
const { transactionRequest } = await bridging.exactIn(...)

// Send transaction or get receipt
const receipt = ...

// Wait for transaction to be completed on recipient chain
const log = await bridging.waitForComplete(receipt)
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
// Create RevertPending instance
const revertPending = symbiosis.newRevertPending(
    request // PendingRequest object
)

// Calculates fee for revert and get execute function
const { fee, execute } = await revertPending.revert()

// Execute transaction using signer
const { waitForMined } = await execute(signer)

// Wait for transaction to be mined
const { receipt, waitForComplete } = await waitForMined()

// Wait for transaction to be fully reverted on original sender chain
const log = await waitForComplete()
```

### Send revert transaction manually

```ts
const revertPending = symbiosis.newRevertPending(request)

// transactionRequest contains everything you need to send a transaction by yourself
const { transactionRequest } = await revertPending.revert()

... // Send transaction

// Wait for transaction to be completed on recipient chain
const log = await revertPending.waitForComplete()
```
