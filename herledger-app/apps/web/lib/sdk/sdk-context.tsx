"use client";

import { createContext, useContext } from "react";
import type { Account } from "@stellar/stellar-sdk";
import { registerBusiness as realRegisterBusiness } from "@herledger/sdk";
import type {
  StellarNetworkConfig,
  ContractConfig,
  TransactionResult,
} from "@herledger/sdk";

// ---------------------------------------------------------------------------
// SdkContext
//
// Every SDK contract call a component needs is exposed here as a swappable
// function. Production code never sees a difference: the context's default
// value *is* the real SDK function, so components work correctly with zero
// setup. Tests swap in `MockSdkProvider` (apps/web/tests/utils) to intercept
// calls at this seam — no `vi.mock("@herledger/sdk")` module-mocking hacks,
// no fragile import-path stubbing. This keeps the mock boundary explicit and
// typed, and makes it trivial to add more SDK calls later (financial-ledger,
// attestation-registry, etc.) by extending SdkClient.
// ---------------------------------------------------------------------------

export interface RegisterBusinessParams {
  businessId: string;
  owner: string;
  wallet: string;
  metadataHash: string;
  sourceAccount: Account;
}

export interface SdkClient {
  registerBusiness: (
    params: RegisterBusinessParams,
    config: StellarNetworkConfig,
    contracts: ContractConfig
  ) => Promise<TransactionResult>;
}

/** The real SDK, wired up as the context's default so production needs no provider. */
export const defaultSdkClient: SdkClient = {
  registerBusiness: realRegisterBusiness,
};

export const SdkContext = createContext<SdkClient>(defaultSdkClient);

/** Consume the current SdkClient (real in prod, mocked under MockSdkProvider in tests). */
export function useSdk(): SdkClient {
  return useContext(SdkContext);
}
