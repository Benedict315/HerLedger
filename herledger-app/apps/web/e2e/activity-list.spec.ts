import { test, expect } from "@playwright/test";

// ---------------------------------------------------------------------------
// Verifies the ActivityList virtualization path: when a page is larger than
// the 100-row threshold, only the visible rows (+ overscan) are rendered into
// the DOM rather than the whole page. The API is intercepted with a
// deterministic list so the assertion runs without Postgres/Stellar.
// ---------------------------------------------------------------------------

function makeEvent(index: number) {
  const id = `evt-${index}`;
  return {
    id,
    eventId: id,
    eventType: "PaymentReceived",
    assetAddress: "native",
    amount: (10_000_000n + BigInt(index)).toString(),
    status: "Verified",
    stellarReference: `0x${id.padStart(62, "0")}`,
    ledgerSequence: 100_000 - index,
  };
}

test.beforeEach(async ({ page, context }) => {
  await context.addCookies([
    {
      name: "better-auth.session_token",
      value: "e2e-fixture-session",
      url: process.env.APP_URL ?? "http://localhost:3000",
    },
  ]);

  // Serve a page of exactly the requested size so the page-size selector is
  // the only thing that changes how many rows the component has to render.
  await page.route("**/api/activity/recent*", async (route) => {
    const url = new URL(route.request().url());
    const limit = Number(url.searchParams.get("limit") ?? "20");
    const events = Array.from({ length: limit }, (_, i) => makeEvent(i));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: { events, pagination: { offset: 0, limit, count: limit } },
        error: null,
      }),
    });
  });

  // Keep the SSE stream quiet so no overlay events interfere with the count.
  await page.route("**/api/events/stream", async (route) => {
    await route.fulfill({
      status: 200,
      headers: { "Content-Type": "text/event-stream" },
      body: "",
    });
  });
});

test("virtualizes large pages so the DOM row count stays bounded", async ({ page }) => {
  await page.goto("/dashboard/activity");

  // Default page size (20) renders the plain table.
  await expect(page.getByRole("table", { name: "Financial activity" })).toBeVisible();

  // Grow the page past the virtualization threshold.
  await page.selectOption("#activity-page-size", "200");

  // The virtualized container uses role="table" (a div) and renders only the
  // visible + overscan rows, never the full 200.
  await expect(page.locator('div[role="table"][aria-label="Financial activity"]')).toBeVisible();

  const rowCount = await page.locator('[role="row"]').count();
  expect(rowCount).toBeGreaterThan(1); // header + at least one visible row
  expect(rowCount).toBeLessThan(100); // far below the 200 fetched events
});
