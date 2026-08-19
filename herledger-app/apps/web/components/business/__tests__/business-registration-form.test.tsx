// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BusinessRegistrationForm } from "../business-registration-form";
import {
  MockSdkProvider,
  mockRegisterBusinessSuccess,
  mockRegisterBusinessThrows,
} from "@/tests/utils/mock-sdk-provider";

vi.mock("@herledger/config", () => ({
  getPublicEnv: () => ({
    NEXT_PUBLIC_STELLAR_NETWORK: "testnet",
    NEXT_PUBLIC_STELLAR_RPC_URL: "https://example-rpc.test",
    NEXT_PUBLIC_BUSINESS_REGISTRY_CONTRACT_ID: "CBUSINESSREGISTRY",
    NEXT_PUBLIC_FINANCIAL_LEDGER_CONTRACT_ID: "CFINANCIALLEDGER",
    NEXT_PUBLIC_ATTESTATION_REGISTRY_CONTRACT_ID: "CATTESTATIONREGISTRY",
  }),
}));

// WalletConnect itself talks to Freighter (browser extension) via @herledger/sdk.
// The wizard test doesn't need real wallet UI — stub it to a single button
// that fires onConnected synchronously, matching its real contract.
vi.mock("@/components/wallet/wallet-connect", () => ({
  WalletConnect: ({ onConnected }: { onConnected: (addr: string) => void }) => (
    <button type="button" onClick={() => onConnected("GABC123TESTWALLET")}>
      Connect Freighter wallet
    </button>
  ),
}));

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
});

function renderForm(overrides: Parameters<typeof MockSdkProvider>[0]["overrides"]) {
  return render(
    <MockSdkProvider overrides={overrides}>
      <BusinessRegistrationForm />
    </MockSdkProvider>
  );
}

describe("BusinessRegistrationForm", () => {
  it("renders the wallet step first, with only one step marked aria-current", () => {
    renderForm({});
    const current = screen.getAllByRole("listitem").filter((li) => li.getAttribute("aria-current") === "step");
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent("Connect wallet");
  });

  it("advances to the business details step after wallet connect", async () => {
    const user = userEvent.setup();
    renderForm({});

    await user.click(screen.getByRole("button", { name: /connect freighter wallet/i }));

    expect(screen.getByRole("heading", { name: /step 2: business details/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/business name/i)).toBeInTheDocument();
  });

  it("completes the full flow through to confirmation using MockSdkProvider", async () => {
    const user = userEvent.setup();
    renderForm({ registerBusiness: mockRegisterBusinessSuccess("tx-e2e-1") });

    await user.click(screen.getByRole("button", { name: /connect freighter wallet/i }));
    await user.type(screen.getByLabelText(/business name/i), "Acme Traders");
    await user.click(screen.getByRole("button", { name: /register on stellar/i }));

    await waitFor(() =>
      expect(screen.getByText(/business registered on stellar/i)).toBeInTheDocument()
    );
    expect(screen.getByText(/tx-e2e-1/)).toBeInTheDocument();
  });

  it("shows an error and a Try again control when registration fails", async () => {
    const user = userEvent.setup();
    renderForm({ registerBusiness: mockRegisterBusinessThrows("Simulated failure") });

    await user.click(screen.getByRole("button", { name: /connect freighter wallet/i }));
    await user.type(screen.getByLabelText(/business name/i), "Acme Traders");
    await user.click(screen.getByRole("button", { name: /register on stellar/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/simulated failure/i);
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("Try again returns to the business details step without losing the wallet connection", async () => {
    const user = userEvent.setup();
    renderForm({ registerBusiness: mockRegisterBusinessThrows() });

    await user.click(screen.getByRole("button", { name: /connect freighter wallet/i }));
    await user.type(screen.getByLabelText(/business name/i), "Acme Traders");
    await user.click(screen.getByRole("button", { name: /register on stellar/i }));
    await screen.findByRole("button", { name: /try again/i });

    await user.click(screen.getByRole("button", { name: /try again/i }));

    expect(screen.getByRole("heading", { name: /step 2: business details/i })).toBeInTheDocument();
    // No wallet-connect button re-appears — connection was preserved.
    expect(screen.queryByRole("button", { name: /connect freighter wallet/i })).not.toBeInTheDocument();
  });
});
