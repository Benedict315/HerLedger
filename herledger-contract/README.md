# HerLedger Contract Workspace

HerLedger is a Stellar/Soroban financial-history protocol for women-owned
businesses. It records verifiable financial activity so that a business can
build a portable, auditable financial history from supported Stellar
transactions and selected attestations.

HerLedger is **not** a lender, credit-score provider, accounting system,
private Stellar transaction system, or automatic loan-approval system.

---

## Contracts

| Contract | Crate | Responsibility |
|---|---|---|
| `BusinessRegistry` | `contracts/business_registry` | Business registration, ownership, wallet association, and lifecycle |
| `FinancialLedger` | `contracts/financial_ledger` | Financial event recording, verification, disputes, and revocation |
| `AttestationRegistry` | `contracts/attestation_registry` | Authorised attesters and contextual claim lifecycle |

---

## Architecture Overview

```
BusinessRegistry          FinancialLedger           AttestationRegistry
─────────────────         ────────────────           ───────────────────
register_business   ───►  record_event         ◄───  create_attestation
update_metadata           verify_event               revoke_attestation
deactivate_business       dispute_event
get_business              resolve_dispute
get_business_by_wallet    revoke_event
                          get_event
                          get_business_events
                          add_supported_asset
                          remove_supported_asset
                          is_supported_asset
```

The three contracts are independently deployed and loosely coupled. The
HerLedger application/indexer is responsible for monitoring Stellar
transactions, checking transaction success and asset support, and invoking
the appropriate contract functions with the required authorisation.

**Stellar is the source of truth for underlying on-chain transaction activity.**
HerLedger adds application-level meaning and protocol state. The contracts do
not make off-chain RPC calls and do not independently query Stellar.

---

## Prerequisites

- Rust ≥ 1.84.0 with the `wasm32v1-none` target installed
- Stellar CLI 26.1.0

Install the WASM target:

```sh
rustup target add wasm32v1-none
```

Install the Stellar CLI:

```sh
cargo install --locked stellar-cli@26.1.0 --features opt
```

---

## Build

```sh
stellar contract build
```

WASM artifacts are written to `target/wasm32v1-none/release/`.

Or use the helper script:

```sh
bash scripts/build.sh
```

---

## Test

```sh
cargo test
```

Or use the helper script:

```sh
bash scripts/test.sh
```

---

## Contract Locations

```
contracts/
├── business_registry/src/lib.rs
├── financial_ledger/src/lib.rs
└── attestation_registry/src/lib.rs
```

---

## Deployment Overview

1. Ensure `cargo test`, `cargo fmt --check`, `cargo clippy`, and
   `stellar contract build` all pass.
2. Deploy to Stellar Testnet first using `stellar contract deploy`.
3. Record the deployed contract IDs.
4. Run integration smoke tests against Testnet.
5. Only after Testnet validation, prepare a Mainnet deployment plan.

Deployment addresses are runtime artifacts. No contract IDs are hardcoded in
this repository.

---

## Security Disclaimer

**These contracts have not been audited.**

This is an MVP implementation. Do not use in production without a
professional security audit. The contracts handle financial history records;
treat them as financial infrastructure and apply appropriate due diligence
before any real-value deployment.

No warranty is provided. See `LICENSE` for full terms.
