# @herledger/sdk

TypeScript SDK for HerLedger's Soroban contracts, wallet adapter, and
Stellar/Soroban RPC helpers.

- [`contracts/`](./src/contracts) — typed clients for BusinessRegistry,
  FinancialLedger, and AttestationRegistry, plus centralized XDR encoding.
- [`rpc/`](./src/rpc) — Soroban RPC client factory and the transaction
  lifecycle (simulate → prepare → submit → confirm).
- [`wallet/`](./src/wallet) — Freighter wallet adapter (signer only, not auth).
- [`types/`](./src/types) — shared application and network types.
- [`errors/`](./src/errors) — typed error classes with a `kind` discriminator.

## Transaction lifecycle

`submitAndWait` submits a signed transaction and polls until it is confirmed or
rejected. It implements the reliability behaviour recommended in the
[Stellar transaction-submission guide](https://developers.stellar.org/docs/build/guides/basics/submit-transaction).

### `TRY_AGAIN_LATER` back-off

When the Soroban RPC is congested, `sendTransaction` returns
`status: "TRY_AGAIN_LATER"`. `submitAndWait` retries these responses with
exponential back-off rather than failing immediately:

| Attempt | Delay |
| ------: | ----: |
| 1       | 1 s   |
| 2       | 2 s   |
| 3       | 4 s   |
| 4+      | 8 s   |

The retry delay is capped at 8 s, aligning with Stellar's ~5 s ledger close
time: after one or two ledger closes the mempool has usually drained. The total
wait budget defaults to 60 s and is configurable via `maxWaitMs`.

```ts
import { submitAndWait } from "@herledger/sdk";

const result = await submitAndWait(signedXdr, config, {
  maxWaitMs: 90_000,
  onRetry: ({ attempt, delayMs, status }) => {
    console.log(`Network busy (${status}) — retry ${attempt} in ${delayMs}ms`);
  },
});
```

`onRetry` receives `{ attempt, delayMs, status }` so callers can render progress
UI. An `AbortSignal` may be passed as `signal` to cancel an in-flight
submission.

### Fee-bump support

A transaction rejected with `tx_insufficient_fee` during congestion can be
recovered by wrapping it in a fee-bump envelope, where a separate `feeSource`
account pays a higher fee. The inner transaction is unchanged (same source,
sequence number, and signatures).

```ts
import { submitAndWait, submitWithFeeBump } from "@herledger/sdk";
import { TransactionBuilder } from "@stellar/stellar-sdk";

try {
  await submitAndWait(signedXdr, config);
} catch (err) {
  // Reconstruct the signed inner transaction, then bump its fee.
  const innerTx = TransactionBuilder.fromXDR(signedXdr, config.networkPassphrase);
  const result = await submitWithFeeBump(innerTx, feeSource, "10000000", config);
}
```

`submitWithFeeBump(innerTx, feeSource, maxFee, config, options?)` builds the
fee-bump envelope with `@stellar/stellar-sdk`'s
`TransactionBuilder.buildFeeBumpTransaction`, signs it with Freighter as
`feeSource`, then hands off to `submitAndWait`. `maxFee` is the maximum total
fee the fee source will pay, in stroops — the Stellar docs recommend `>= 10x`
the original fee.

### Simulation error validation

`simulateAndPrepare` validates the RPC simulation result before assembling a
transaction. If the simulation returns an error (e.g. a contract call failed,
or contract state changed between simulation and submission), it throws an
`RpcError` instead of submitting a transaction doomed to fail on-chain.

### Error codes

`RpcError` carries a machine-readable `code` in addition to the message:

| Code                     | Meaning                                              |
| ------------------------ | ---------------------------------------------------- |
| `SIMULATION_FAILED`      | `simulateTransaction` errored or rejected the call   |
| `SUBMIT_FAILED`          | `sendTransaction` threw a transport-level error      |
| `TRY_AGAIN_LATER_TIMEOUT`| congestion did not clear within `maxWaitMs`          |
| `POLL_FAILED`            | `getTransaction` threw while polling                 |
| `POLL_TIMEOUT`           | transaction did not confirm within `maxWaitMs`       |
| `ABORTED`                | the provided `AbortSignal` was aborted               |

```ts
import { RpcError } from "@herledger/sdk";

try {
  await submitAndWait(signedXdr, config);
} catch (err) {
  if (err instanceof RpcError && err.code === "TRY_AGAIN_LATER_TIMEOUT") {
    // Surface "network is congested, try again later".
  }
}
```
