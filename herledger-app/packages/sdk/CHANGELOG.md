# Changelog

All notable changes to `@herledger/sdk` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Breaking vs. non-breaking changes are tracked with [Changesets](https://github.com/changesets/changesets)
via `pnpm changeset`.

## [Unreleased]

### Added

- Sub-path exports (`@herledger/sdk/contracts`, `@herledger/sdk/wallet`,
  `@herledger/sdk/rpc`, `@herledger/sdk/types`, `@herledger/sdk/errors`) so
  consumers can import a single slice of the SDK and let bundlers drop the
  rest. See `package.json` `exports` for the full map.
- Comprehensive JSDoc on every exported function, including `@param`,
  `@returns`, `@throws`, and a usage `@example`.

### Changed

- The root `@herledger/sdk` barrel now re-exports from the sub-path barrels
  (no public API change — existing imports keep working).

## [0.0.0] - Initial

Initial public API surface:

- Contract clients: `BusinessRegistry`, `FinancialLedger`, `AttestationRegistry`.
- XDR encoding/decoding helpers and the contract address registry.
- Soroban RPC client factory (`getSorobanRpcServer`, `getLatestLedger`) and
  the transaction lifecycle (`simulateAndPrepare`, `submitAndWait`).
- Freighter wallet adapter.
- Shared types and typed error classes.
