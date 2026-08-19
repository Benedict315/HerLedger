import { test, expect } from "@playwright/test";

// ---------------------------------------------------------------------------
// Covers AttestationList rendering both Active and Revoked attestations.
//
// This intercepts /api/attestations rather than depending on a real
// Postgres + seeded session, so it's self-contained and deterministic.
// The Soroban RPC endpoint (used by the on-demand isValidAttestation
// re-check) is intercepted with a failure response — AttestationList is
// written to swallow RPC failures and keep showing the DB-indexed status
// rather than breaking the page (see revalidateAll's try/catch in
// components/attestations/attestation-list.tsx), so this also exercises
// that fallback path. Discrepancy-detection and resync logic itself is
// covered by the unit tests in lib/attestations/__tests__/reconcile.test.ts
// and app/api/attestations/__tests__/schema.test.ts — this spec is purely
// about what actually renders in a browser.
// ---------------------------------------------------------------------------

const FIXTURE_ATTESTATIONS = [
  {
    id: "att-active-1",
    attestationId: "a".repeat(64),
    eventId: "e".repeat(64),
    attesterAddress: "GACTIVEATTESTERADDRESSAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    claimHash: "c".repeat(64),
    claimDescription: "Invoice verified against bank statement",
    status: "Active",
    ledgerSequence: 100,
  },
  {
    id: "att-revoked-1",
    attestationId: "b".repeat(64),
    eventId: "f".repeat(64),
    attesterAddress: "GREVOKEDATTESTERADDRESSAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    claimHash: "d".repeat(64),
    claimDescription: null,
    status: "Revoked",
    ledgerSequence: 90,
  },
];

test.beforeEach(async ({ page, context }) => {
  // Satisfies middleware's cookie-presence check for /dashboard/*; the API
  // route itself is intercepted below rather than hitting real auth/DB.
  await context.addCookies([
    {
      name: "better-auth.session_token",
      value: "e2e-fixture-session",
      url: process.env.APP_URL ?? "http://localhost:3000",
    },
  ]);

  await page.route("**/api/attestations", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { attestations: FIXTURE_ATTESTATIONS }, error: null }),
    });
  });

  // Simulate an unreachable Soroban RPC — AttestationList must degrade
  // gracefully and keep showing DB-indexed statuses rather than erroring.
  await page.route(/soroban|stellar.*rpc/i, async (route) => {
    await route.abort("connectionrefused");
  });
});

test("renders both active and revoked attestations with correct status badges", async ({ page }) => {
  await page.goto("/dashboard/attestations");

  await expect(page.getByText("Status: Active")).toBeVisible();
  await expect(page.getByText("Status: Revoked")).toBeVisible();
  await expect(
    page.getByText("This attestation has been revoked and is preserved for historical reference.")
  ).toBeVisible();
});

test("renders claimDescription when present, falling back to a truncated claimHash otherwise", async ({
  page,
}) => {
  await page.goto("/dashboard/attestations");

  await expect(page.getByText("Invoice verified against bank statement")).toBeVisible();
  await expect(page.getByText(`${"d".repeat(16)}…`)).toBeVisible();
});

test("resolves an unknown attester address to a truncated display form", async ({ page }) => {
  await page.goto("/dashboard/attestations");

  // Neither fixture attester is in KNOWN_ATTESTERS, so both should render
  // truncated (first 6 chars + "…" + last 6 chars) rather than as a
  // 56-char raw address.
  await expect(page.getByText("GACTIV…AAAAAA")).toBeVisible();
});

test("attestations list links to the register-attester and create-attestation routes", async ({
  page,
}) => {
  await page.goto("/dashboard/attestations");

  await expect(page.getByRole("link", { name: "Register attester" })).toHaveAttribute(
    "href",
    "/dashboard/attestations/register"
  );
  await expect(page.getByRole("link", { name: "Create attestation" })).toHaveAttribute(
    "href",
    "/dashboard/attestations/create"
  );
});

// ---------------------------------------------------------------------------
// AttesterRegistrationForm / CreateAttestationForm both start by rendering
// WalletConnect, which calls out to the (absent, in CI) Freighter browser
// extension. No Freighter mock is set up here -- these specs only exercise
// the pre-wallet-connection render, which is what's reachable without one.
// The on-chain submission paths (registerAttester / createAttestation) are
// exercised by packages/sdk's own contract-client tests, not here.
// ---------------------------------------------------------------------------

test("register-attester page explains the admin-wallet requirement before connecting", async ({
  page,
}) => {
  await page.goto("/dashboard/attestations/register");

  await expect(page.getByRole("heading", { name: "Register attester" })).toBeVisible();
  await expect(page.getByText(/must be the contract admin/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Connect Freighter wallet" })).toBeVisible();
});

test("create-attestation page prompts for an attester wallet connection first", async ({ page }) => {
  await page.goto("/dashboard/attestations/create");

  await expect(page.getByRole("heading", { name: "Create attestation" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Connect Freighter wallet" })).toBeVisible();
});
