// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";

// `mockPublicEnv` must be imported (and the vi.mock() below registered)
// BEFORE `../use-registration-flow` is imported: vi.mock() calls are
// hoisted above all imports, but import statements keep their own relative
// order, and use-registration-flow.ts statically imports "@herledger/config"
// itself. If that import ran first, the mock factory would try to read
// `mockPublicEnv` before its own import finished initializing (a TDZ
// ReferenceError) the moment use-registration-flow's module graph loads.
import { mockPublicEnv } from "@/tests/utils/mock-public-env";
import { TEST_WALLET_ADDRESS } from "@/tests/utils/mock-wallet";

// `useRegistrationFlow` reads NEXT_PUBLIC_* env vars via getPublicEnv() and
// posts to /api/business/register on success — stub both so this stays a
// fast, network-free unit test of the hook's own state transitions.
vi.mock("@herledger/config", () => ({
  getPublicEnv: mockPublicEnv,
}));

import { useRegistrationFlow } from "../use-registration-flow";
import {
  MockSdkProvider,
  mockRegisterBusinessSuccess,
  mockRegisterBusinessThrows,
  mockRegisterBusinessRejectedOnChain,
} from "@/tests/utils/mock-sdk-provider";

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

    act(() => result.current.connectWallet(TEST_WALLET_ADDRESS));
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

    act(() => result.current.connectWallet(TEST_WALLET_ADDRESS));
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

    act(() => result.current.connectWallet(TEST_WALLET_ADDRESS));
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

    act(() => result.current.connectWallet(TEST_WALLET_ADDRESS));
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

    act(() => result.current.connectWallet(TEST_WALLET_ADDRESS));
    act(() => result.current.setBusinessName("Acme"));
    await act(async () => {
      await result.current.submit();
    });
    expect(result.current.step).toBe("error");

    act(() => result.current.retry());
    expect(result.current.step).toBe("details");
    expect(result.current.error).toBeNull();
    expect(result.current.walletAddress).toBe(TEST_WALLET_ADDRESS);
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
