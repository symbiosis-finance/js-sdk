# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

`symbiosis-js-sdk` — a TypeScript SDK for cross-chain swaps over the Symbiosis
protocol. Wraps [ethers v5](https://docs.ethers.io/v5/) to talk to EVM and
non-EVM chains (TON, Solana, Tron, Bitcoin/thorchain). Published to npm as a
dual ESM + CJS package (`dist/esm`, `dist/cjs`). Docs:
https://docs.symbiosis.finance/developer-tools/symbiosis-js-sdk

Entry point is the `Symbiosis` class (`src/crosschain/symbiosis.ts`), constructed
with an environment name and a client id: `new Symbiosis('mainnet', 'app-id')`.

## Commands

- `npm test` — run the test suite (vitest, `test/crosschain`). Run a single file
  with `npx vitest run test/crosschain/trade/validateCallData.test.ts`.
- `npm run build` — full dual build (clean + ESM + CJS).
- `npm run prettier` — check formatting; `npm run prettier:fix` — autofix.
- Type-check without emitting: `npx tsc --noEmit -p tsconfig.json`.

Node `>=18`. There is **no ESLint config** in the repo (an `eslint` binary exists
but has no config) — rely on `tsc` (strict) + Prettier for correctness/style, not
`eslint`.

## Before finishing a change

Run, in order: `npx tsc --noEmit -p tsconfig.json`, `npm test` (or the relevant
test file), and `npm run prettier` on touched files. tsconfig has
`noUnusedLocals`/`noUnusedParameters` on, so unused symbols are hard errors.

## Code style

Prettier config (`.prettierrc`): **4-space** indent, **no semicolons**, single
quotes, `printWidth: 120`, `trailingComma: es5`. Match surrounding code.

## Generated code — do not hand-edit

These directories/files are generated; edit the generator/source instead and
re-run the script:

- `src/crosschain/contracts/**` — TypeChain bindings from ABIs in
  `src/crosschain/abis/`. Regenerate: `npm run build-contracts`.
- `src/crosschain/api/*.generated.ts` — Swagger clients (thorchain, kyberswap).
  Regenerate: `npm run generate-thorchain-api` / `npm run generate-kyberswap-api`.
- `src/crosschain/config/cache/**` — built via `npm run build-config-cache`.

## Layout

- `src/crosschain/` — the core. Notable subdirs:
  - `trade/` — one module per liquidity source / DEX aggregator (`oneInchTrade`,
    `openOceanTrade`, `uniV2Trade`, `uniV3Trade`, `jupiterTrade`, `stonfiTrade`,
    `kyberSwapTrade`, …) plus shared helpers like `validateCallData.ts`.
  - `config/` — per-environment config (`mainnet.ts`, `testnet.ts`, `beta.ts`,
    `dev.ts`); includes RPC endpoints and per-chain token/contract addresses.
  - `swapExactIn/`, `waitForComplete/`, `chainUtils/`, `feeCall/`.
- `src/entities/` — domain types (`Token`, `TokenAmount`, `Percent`, `Pair`,
  `Route`, fractions, …).
- `test/crosschain/` — vitest tests mirroring the `src/crosschain` layout.

## Optimistic-quote validation (`src/crosschain/trade/validateCallData.ts`)

Aggregator trades (1inch, OpenOcean, …) simulate suspiciously-good quotes via
`eth_call` with state overrides that fund the executing address, to reject quotes
whose calldata can't actually execute on-chain. Non-obvious facts the code
encodes (learned from production incidents):

- Balance/allowance storage locations are **detected dynamically**: first via
  `eth_createAccessList` (which reveals the exact contract+slot a `balanceOf`/
  `allowance` call reads — this also handles eternal-storage tokens like KAON
  whose balances live in a separate storage contract), verified with a sentinel
  write; falls back to a linear scan of the token's own slots (`0..63` plus the
  ERC-7201 `openzeppelin.storage.ERC20` namespace base used by OZ v5 upgradeable
  tokens, e.g. oUSDT on Base). Layouts seen in the wild: OZ standard `0/1`,
  FiatTokenV2/native USDC `9/10`, Coinbase-bridged (USDbC on Base) `51/52`.
- The balance slot is funded with `2^255 - 1`, **not** `MAX_UINT256`.
  FiatTokenV2_2 (native USDC) packs a blacklist flag into the high bit of the
  balance slot, so a full-`0xff` value flags the sender as blacklisted and makes
  `transferFrom` revert (`SafeTransferFromFailed()`, selector `0xf4059071`).
- Reflection/fee tokens (`balanceOf` computed from shares, e.g. MCC, Wolf) and
  tokens whose balance can't be reproduced by writing one slot (e.g. SOLVE)
  legitimately end up `skipped` — a skip never rejects the quote.

## Versioning & release

Use npm's version command — it bumps `package.json` + `package-lock.json`,
commits with the version number as the message, and tags `v<version>`:

```bash
npm version patch   # or minor / major
```

Then push the commit and the tag to `main` (the primary branch):

```bash
git push origin main && git push origin v<version>
```

## Git etiquette

Commit/push only when asked. End commit messages with the
`Co-Authored-By: Claude …` trailer.
