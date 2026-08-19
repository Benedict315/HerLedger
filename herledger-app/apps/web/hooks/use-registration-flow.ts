"use client";

import { useCallback, useReducer } from "react";
import { Account } from "@stellar/stellar-sdk";
import { getPublicEnv } from "@herledger/config";
import { registerCurrentNetworkAddresses, buildContractConfig } from "@herledger/sdk";
import type { StellarNetworkConfig, ContractConfig, NetworkId } from "@herledger/sdk";
import { useSdk } from "@/lib/sdk/sdk-context";

// ---------------------------------------------------------------------------
// useRegistrationFlow
//
// The multi-step state machine for business registration, extracted from
// BusinessRegistrationForm so it's independently unit-testable. The reducer
// (`registrationFlowReducer`) is exported directly so transition logic —
// including guards — can be tested without rendering React at all.
//
// Flow: wallet -> details -> submitting -> confirmed
//                                   \-> error -> (retry) -> details|wallet
// ---------------------------------------------------------------------------

export type RegistrationStep =
  | "wallet"
  | "details"
  | "submitting"
  | "confirmed"
  | "error";

export interface RegistrationFlowState {
  step: RegistrationStep;
  walletAddress: string | null;
  businessName: string;
  error: string | null;
  txHash: string | null;
}

export type RegistrationFlowAction =
  | { type: "WALLET_CONNECTED"; walletAddress: string }
  | { type: "BUSINESS_NAME_CHANGED"; businessName: string }
  | { type: "SUBMIT_STARTED" }
  | { type: "SUBMIT_SUCCEEDED"; txHash: string }
  | { type: "SUBMIT_FAILED"; error: string }
  | { type: "RETRY_REQUESTED" };

export const initialRegistrationFlowState: RegistrationFlowState = {
  step: "wallet",
  walletAddress: null,
  businessName: "",
  error: null,
  txHash: null,
};

/**
 * Pure state-machine reducer. No side effects, no async — safe to unit test
 * with plain `expect(reducer(state, action)).toEqual(...)` assertions.
 */
export function registrationFlowReducer(
  state: RegistrationFlowState,
  action: RegistrationFlowAction
): RegistrationFlowState {
  // Terminal-state guard: once confirmed, the flow is immutable. This is the
  // guard against "back-navigation into a completed step" called out in the
  // issue — no action can move state away from "confirmed".
  if (state.step === "confirmed") {
    return state;
  }

  switch (action.type) {
    case "WALLET_CONNECTED":
      // Guard: ignore stale/duplicate connect events fired while a
      // submission is already in flight.
      if (state.step === "submitting") return state;
      return { ...state, walletAddress: action.walletAddress, step: "details" };

    case "BUSINESS_NAME_CHANGED":
      // Guard: can't edit the name while a submission is in flight.
      if (state.step === "submitting") return state;
      return { ...state, businessName: action.businessName };

    case "SUBMIT_STARTED":
      // Guard: can only submit from "details", and only with a wallet
      // connected. Prevents skipping straight from "wallet" to "submitting".
      if (state.step !== "details" || !state.walletAddress) return state;
      return { ...state, step: "submitting", error: null };

    case "SUBMIT_SUCCEEDED":
      // Guard: only a submission actually in flight can resolve.
      if (state.step !== "submitting") return state;
      return { ...state, step: "confirmed", txHash: action.txHash, error: null };

    case "SUBMIT_FAILED":
      if (state.step !== "submitting") return state;
      return { ...state, step: "error", error: action.error };

    case "RETRY_REQUESTED":
      // Guard: only leave "error" via explicit retry. Lands back on
      // "details" if a wallet is still connected, else back to "wallet" —
      // never re-enters "submitting" or "confirmed" directly.
      if (state.step !== "error") return state;
      return { ...state, step: state.walletAddress ? "details" : "wallet", error: null };

    default:
      return state;
  }
}

function getStellarConfig(): StellarNetworkConfig {
  const env = getPublicEnv();
  return {
    network: env.NEXT_PUBLIC_STELLAR_NETWORK,
    rpcUrl: env.NEXT_PUBLIC_STELLAR_RPC_URL,
    horizonUrl: "",
    networkPassphrase:
      env.NEXT_PUBLIC_STELLAR_NETWORK === "mainnet"
        ? "Public Global Stellar Network ; September 2015"
        : "Test SDF Network ; September 2015",
  };
}

function getContractConfig(network: NetworkId): ContractConfig {
  const env = getPublicEnv();
  // HerLedger exposes one *_CONTRACT_ID per contract (no separate
  // *_CONTRACT_ID_MAINNET var yet — see registry.ts), so the same addresses
  // are used both to build the registry and to validate against it. This
  // still buys us the format check (looksLikeContractAddress) and a clear
  // ValidationError instead of a raw SDK failure if an env var is blank or
  // malformed; it doesn't (yet) protect against a *wrong* address, since
  // there's nothing independent to check it against until HerLedger has a
  // second, hard-coded address source (e.g. once mainnet is deployed).
  const addresses = {
    businessRegistryId: env.NEXT_PUBLIC_BUSINESS_REGISTRY_CONTRACT_ID,
    financialLedgerId: env.NEXT_PUBLIC_FINANCIAL_LEDGER_CONTRACT_ID,
    attestationRegistryId: env.NEXT_PUBLIC_ATTESTATION_REGISTRY_CONTRACT_ID,
  };
  const registry = registerCurrentNetworkAddresses(network, addresses);
  return buildContractConfig(registry, network, addresses);
}

function generateBusinessId(wallet: string, name: string): string {
  const input = `${wallet}:${name}:${Date.now()}`;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, "0");
  return hex.repeat(8);
}

function hashMetadata(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(64, "0");
}

export interface UseRegistrationFlowResult extends RegistrationFlowState {
  connectWallet: (walletAddress: string) => void;
  setBusinessName: (businessName: string) => void;
  submit: () => Promise<void>;
  retry: () => void;
}

export function useRegistrationFlow(): UseRegistrationFlowResult {
  const [state, dispatch] = useReducer(registrationFlowReducer, initialRegistrationFlowState);
  const sdk = useSdk();

  const connectWallet = useCallback((walletAddress: string) => {
    dispatch({ type: "WALLET_CONNECTED", walletAddress });
  }, []);

  const setBusinessName = useCallback((businessName: string) => {
    dispatch({ type: "BUSINESS_NAME_CHANGED", businessName });
  }, []);

  const retry = useCallback(() => {
    dispatch({ type: "RETRY_REQUESTED" });
  }, []);

  const submit = useCallback(async () => {
    // Mirrors the reducer's own guard so callers get a no-op instead of a
    // thrown error if they call submit() from the wrong step.
    if (state.step !== "details" || !state.walletAddress) return;

    dispatch({ type: "SUBMIT_STARTED" });

    try {
      const businessId = generateBusinessId(state.walletAddress, state.businessName);
      const metadataHash = hashMetadata(state.businessName);
      const stellarConfig = getStellarConfig();
      const contractConfig = getContractConfig(stellarConfig.network);
      const sourceAccount = new Account(state.walletAddress, "0");

      const result = await sdk.registerBusiness(
        {
          businessId,
          owner: state.walletAddress,
          wallet: state.walletAddress,
          metadataHash,
          sourceAccount,
        },
        stellarConfig,
        contractConfig
      );

      if (result.success) {
        dispatch({ type: "SUBMIT_SUCCEEDED", txHash: result.hash });

        await fetch("/api/business/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            businessId,
            walletAddress: state.walletAddress,
            displayName: state.businessName,
            metadataHash,
            txHash: result.hash,
          }),
        });
      } else {
        dispatch({
          type: "SUBMIT_FAILED",
          error: "Transaction did not succeed. Please try again.",
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Registration failed.";
      dispatch({ type: "SUBMIT_FAILED", error: message });
    }
  }, [sdk, state.step, state.walletAddress, state.businessName]);

  return { ...state, connectWallet, setBusinessName, submit, retry };
}
