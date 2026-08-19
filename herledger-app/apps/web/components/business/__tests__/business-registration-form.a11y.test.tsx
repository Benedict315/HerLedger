// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { BusinessRegistrationForm } from "../business-registration-form";
import { MockSdkProvider, mockRegisterBusinessThrows } from "@/tests/utils/mock-sdk-provider";

vi.mock("@herledger/config", () => ({
  getPublicEnv: () => ({
    NEXT_PUBLIC_STELLAR_NETWORK: "testnet",
    NEXT_PUBLIC_STELLAR_RPC_URL: "https://example-rpc.test",
    NEXT_PUBLIC_BUSINESS_REGISTRY_CONTRACT_ID: "CBUSINESSREGISTRY",
    NEXT_PUBLIC_FINANCIAL_LEDGER_CONTRACT_ID: "CFINANCIALLEDGER",
    NEXT_PUBLIC_ATTESTATION_REGISTRY_CONTRACT_ID: "CATTESTATIONREGISTRY",
  }),
}));

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

describe("BusinessRegistrationForm accessibility", () => {
  it("has no axe violations on the initial wallet step", async () => {
    const { container } = render(
      <MockSdkProvider>
        <BusinessRegistrationForm />
      </MockSdkProvider>
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("marks exactly the active step with aria-current='step'", async () => {
    const user = userEvent.setup();
    render(
      <MockSdkProvider>
        <BusinessRegistrationForm />
      </MockSdkProvider>
    );

    await user.click(screen.getByRole("button", { name: /connect freighter wallet/i }));

    const steps = screen.getAllByRole("listitem");
    const current = steps.filter((li) => li.getAttribute("aria-current") === "step");
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent("Business details");

    // The other two steps must NOT carry aria-current.
    const notCurrent = steps.filter((li) => li !== current[0]);
    for (const li of notCurrent) {
      expect(li).not.toHaveAttribute("aria-current");
    }
  });

  it("moves focus to the new step's heading on each forward transition", async () => {
    const user = userEvent.setup();
    render(
      <MockSdkProvider>
        <BusinessRegistrationForm />
      </MockSdkProvider>
    );

    await user.click(screen.getByRole("button", { name: /connect freighter wallet/i }));

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /step 2: business details/i })).toHaveFocus()
    );
  });

  it("announces the error via role=alert and has no axe violations on the error step", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <MockSdkProvider overrides={{ registerBusiness: mockRegisterBusinessThrows("Simulated failure") }}>
        <BusinessRegistrationForm />
      </MockSdkProvider>
    );

    await user.click(screen.getByRole("button", { name: /connect freighter wallet/i }));
    await user.type(screen.getByLabelText(/business name/i), "Acme Traders");
    await user.click(screen.getByRole("button", { name: /register on stellar/i }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/simulated failure/i);

    // Focus should also land on the error step's heading, not stay on the
    // now-unmounted submit button.
    expect(screen.getByRole("heading", { name: /registration failed/i })).toHaveFocus();

    expect(await axe(container)).toHaveNoViolations();
  });

  it("has no axe violations on the confirmation step", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <MockSdkProvider
        overrides={{
          registerBusiness: async () => ({ hash: "tx-a11y", success: true, ledger: 1 }),
        }}
      >
        <BusinessRegistrationForm />
      </MockSdkProvider>
    );

    await user.click(screen.getByRole("button", { name: /connect freighter wallet/i }));
    await user.type(screen.getByLabelText(/business name/i), "Acme Traders");
    await user.click(screen.getByRole("button", { name: /register on stellar/i }));

    await screen.findByText(/business registered on stellar/i);
    expect(await axe(container)).toHaveNoViolations();
  });
});
