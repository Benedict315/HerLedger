import { test, expect } from "@playwright/test";

test.describe("Dashboard SSE", () => {
  test("simulate indexer write -> assert new row appears in ActivityList", async ({ page }) => {
    // Mock the session so we don't get redirected
    await page.route("/api/auth/session", async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          user: { id: "test-user", email: "test@example.com" },
          session: { id: "test-session", expiresAt: new Date(Date.now() + 86400000).toISOString() },
        },
      });
    });

    // Mock initial activity fetch
    await page.route("/api/activity/recent*", async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          data: {
            events: [],
            pagination: { offset: 0, limit: 20, count: 0 },
          },
        },
      });
    });

    // Intercept SSE and simulate the server pushing a new event
    await page.route("/api/events/stream", async (route) => {
      // Playwright route.fulfill body can be a string. For SSE, we can just return a string with the event.
      // Since it's EventSource, the browser reads it as a stream. Sending the entire body at once with the event works
      // if we don't close the connection, but Playwright fulfill ends the response.
      // However, the EventSource will parse the event and then auto-reconnect, which is fine for the test!
      const simulatedEvent = [
        {
          eventId: "0xsimulated123",
          eventType: "PaymentReceived",
          assetAddress: "native",
          amount: "10000000",
          status: "Verified",
          ledgerSequence: 55555,
          stellarReference: "0xtxhash",
        },
      ];

      const body = `:\n\ndata: ${JSON.stringify(simulatedEvent)}\n\n`;

      await route.fulfill({
        status: 200,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
        body: body,
      });
    });

    // Go to the activity page
    await page.goto("http://localhost:3000/dashboard/activity");

    // Wait for the simulated event to appear in the table
    await expect(page.locator("tbody tr")).toHaveCount(1);
    await expect(page.locator("tbody tr").first()).toContainText("Payment received");
  });
});
