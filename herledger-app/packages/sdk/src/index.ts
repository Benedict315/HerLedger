// ---------------------------------------------------------------------------
// `@herledger/sdk` — convenience barrel re-exporting the full public surface.
//
// Prefer the tree-shakeable sub-path entries when you only need one slice:
//   - `@herledger/sdk/contracts` — contract clients, encoding, ABI types
//   - `@herledger/sdk/wallet`    — Freighter adapter
//   - `@herledger/sdk/rpc`       — RPC client + transaction lifecycle
//   - `@herledger/sdk/types`     — shared types
//   - `@herledger/sdk/errors`    — typed error classes
// ---------------------------------------------------------------------------

// Types
export * from "./types/index.js";

// Attester display-name registry (top-level utility, not a contract client)
export { KNOWN_ATTESTERS, resolveAttesterName } from "./attester-registry.js";
export type { AttesterRegistry, AttesterRegistryEntry } from "./attester-registry.js";

// Errors
export {
  WalletError,
  RpcError,
  ContractError,
  ValidationError,
  AuthenticationError,
} from "./errors/index.js";
export type { AppError } from "./errors/index.js";

// RPC
export * from "./rpc/index.js";

// Wallet
export * from "./wallet/index.js";

// Contracts (clients, encoding, registry, generated ABI types)
export * from "./contracts/index.js";
