"use client";

import { useCallback, useReducer } from "react";
import { Account } from "@stellar/stellar-sdk";
import { useSdk } from "@/lib/sdk/sdk-context";
import { getStellarConfig, getContractConfig } from "@/lib/stellar/network";

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

export function registrationFlowReducer(
  state: RegistrationFlowState,
  action: RegistrationFlowAction
): RegistrationFlowState {
  if (state.step === "confirmed") {
    return state;
  }

  switch (action.type) {
    case "WALLET_CONNECTED":
      if (state.step === "submitting") return state;
      return { ...state, walletAddress: action.walletAddress, step: "details" };

    case "BUSINESS_NAME_CHANGED":
      if (state.step === "submitting") return state;
      return { ...state, businessName: action.businessName };

    case "SUBMIT_STARTED":
      if (state.step !== "details" || !state.walletAddress) return state;
      return { ...state, step: "submitting", error: null };

    case "SUBMIT_SUCCEEDED":
      if (state.step !== "submitting") return state;
      return { ...state, step: "confirmed", txHash: action.txHash, error: null };

    case "SUBMIT_FAILED":
      if (state.step !== "submitting") return state;
      return { ...state, step: "error", error: action.error };

    case "RETRY_REQUESTED":
      if (state.step !== "error") return state;
      return { ...state, step: state.walletAddress ? "details" : "wallet", error: null };

    default:
      return state;
  }
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
    if (state.step !== "details" || !state.walletAddress) return;

    dispatch({ type: "SUBMIT_STARTED" });

    try {
      const businessId = generateBusinessId(state.walletAddress, state.businessName);
      const metadataHash = hashMetadata(state.businessName);
      const stellarConfig = getStellarConfig();
      const contractConfig = getContractConfig();
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
