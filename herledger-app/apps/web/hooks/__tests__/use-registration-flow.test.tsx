// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { useRegistrationFlow } from "../use-registration-flow";
import {
  MockSdkProvider,
  mockRegisterBusinessSuccess,
  mockRegisterBusinessThrows,
  mockRegisterBusinessRejectedOnChain,
} from "@/tests/utils/mock-sdk-provider";

// `useRegistrationFlow` reads NEXT_PUBLIC_* env vars via getPublicEnv() and
// posts to /api/business/register on success — stub both so this stays a
// fast, network-free unit test of the hook's own state transitions.
vi.mock("@herledger/config", () => ({
  getPublicEnv: () => ({
    NEXT_PUBLIC_STELLAR_NETWORK: "testnet",
    NEXT_PUBLIC_STELLAR_RPC_URL: "https://example-rpc.test",
    NEXT_PUBLIC_BUSINESS_REGISTRY_CONTRACT_ID: "CBUSINESSREGISTRY",
    NEXT_PUBLIC_FINANCIAL_LEDGER_CONTRACT_ID: "CFINANCIALLEDGER",
    NEXT_PUBLIC_ATTESTATION_REGISTRY_CONTRACT_ID: "CATTESTATIONREGISTRY",
  }),
}));

function wrapper(overrides: Parameters<typeof MockSdkProvider>[0]["overrides"]) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <MockSdkProvider overrides={overrides}>{children}</MockSdkProvider>;
  };
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
  );
});

describe("useRegistrationFlow: happy path", () => {
  it("walks wallet -> details -> submitting -> confirmed", async () => {
    const { result } = renderHook(() => useRegistrationFlow(), {
      wrapper: wrapper({ registerBusiness: mockRegisterBusinessSuccess("tx-happy") }),
    });

    expect(result.current.step).toBe("wallet");

    act(() => result.current.connectWallet("GABC123"));
    expect(result.current.step).toBe("details");

    act(() => result.current.setBusinessName("Acme Traders"));
    expect(result.current.businessName).toBe("Acme Traders");

    act(() => {
      void result.current.submit();
    });
    expect(result.current.step).toBe("submitting");

    await waitFor(() => expect(result.current.step).toBe("confirmed"));
    expect(result.current.txHash).toBe("tx-happy");
    expect(result.current.error).toBeNull();
  });

  it("notifies the backend via fetch after a successful on-chain submission", async () => {
    const { result } = renderHook(() => useRegistrationFlow(), {
      wrapper: wrapper({ registerBusiness: mockRegisterBusinessSuccess("tx-2") }),
    });

    act(() => result.current.connectWallet("GABC123"));
    act(() => result.current.setBusinessName("Acme"));
    await act(async () => {
      await result.current.submit();
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/business/register",
      expect.objectContaining({ method: "POST" })
    );
  });
});

describe("useRegistrationFlow: error paths", () => {
  it("moves to error when the SDK call throws", async () => {
    const { result } = renderHook(() => useRegistrationFlow(), {
      wrapper: wrapper({ registerBusiness: mockRegisterBusinessThrows("network down") }),
    });

    act(() => result.current.connectWallet("GABC123"));
    act(() => result.current.setBusinessName("Acme"));
    await act(async () => {
      await result.current.submit();
    });

    expect(result.current.step).toBe("error");
    expect(result.current.error).toBe("network down");
  });

  it("moves to error when the transaction resolves but did not succeed", async () => {
    const { result } = renderHook(() => useRegistrationFlow(), {
      wrapper: wrapper({ registerBusiness: mockRegisterBusinessRejectedOnChain() }),
    });

    act(() => result.current.connectWallet("GABC123"));
    act(() => result.current.setBusinessName("Acme"));
    await act(async () => {
      await result.current.submit();
    });

    expect(result.current.step).toBe("error");
    expect(result.current.error).toMatch(/did not succeed/i);
  });

  it("retry() returns to details (wallet still connected) and clears the error", async () => {
    const { result } = renderHook(() => useRegistrationFlow(), {
      wrapper: wrapper({ registerBusiness: mockRegisterBusinessThrows() }),
    });

    act(() => result.current.connectWallet("GABC123"));
    act(() => result.current.setBusinessName("Acme"));
    await act(async () => {
      await result.current.submit();
    });
    expect(result.current.step).toBe("error");

    act(() => result.current.retry());
    expect(result.current.step).toBe("details");
    expect(result.current.error).toBeNull();
    expect(result.current.walletAddress).toBe("GABC123");
  });

  it("submit() is a no-op when called without a connected wallet", async () => {
    const registerBusiness = vi.fn();
    const { result } = renderHook(() => useRegistrationFlow(), {
      wrapper: wrapper({ registerBusiness }),
    });

    await act(async () => {
      await result.current.submit();
    });

    expect(registerBusiness).not.toHaveBeenCalled();
    expect(result.current.step).toBe("wallet");
  });
});
