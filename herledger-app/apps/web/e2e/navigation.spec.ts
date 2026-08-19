import { test, expect } from "@playwright/test";

// ---------------------------------------------------------------------------
// Covers the responsive dashboard navigation: a persistent sidebar on desktop
// (>= 768px) and a hamburger-triggered drawer on mobile, with the drawer
// closing automatically on route change.
// ---------------------------------------------------------------------------

test.beforeEach(async ({ context, page }) => {
  await context.addCookies([
    {
      name: "better-auth.session_token",
      value: "e2e-fixture-session",
      url: process.env.APP_URL ?? "http://localhost:3000",
    },
  ]);

  // The dashboard summary / SSE stream don't need to exercise real data for a
  // navigation test — keep them quiet and deterministic.
  await page.route("**/api/activity/recent*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: { events: [], pagination: { offset: 0, limit: 20, count: 0 } },
        error: null,
      }),
    });
  });
  await page.route("**/api/events/stream", async (route) => {
    await route.fulfill({
      status: 200,
      headers: { "Content-Type": "text/event-stream" },
      body: "",
    });
  });
});

test("shows the persistent sidebar on desktop", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/dashboard");

  await expect(page.locator("aside.nav-sidebar")).toBeVisible();
  await expect(page.locator("header.nav-mobile-bar")).toBeHidden();
  await expect(
    page.locator("aside.nav-sidebar").getByRole("link", { name: "Activity" })
  ).toBeVisible();
});

test("opens a drawer via hamburger on mobile and closes it on navigation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard");

  await expect(page.locator("aside.nav-sidebar")).toBeHidden();

  const hamburger = page.locator("button[aria-controls='mobile-nav-drawer']");
  await expect(hamburger).toBeVisible();
  await expect(hamburger).toHaveAttribute("aria-expanded", "false");

  await hamburger.click();
  await expect(hamburger).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#mobile-nav-drawer")).toHaveClass(/nav-mobile-drawer--open/);

  // Tapping a nav item navigates and closes the drawer automatically.
  await page.locator("#mobile-nav-drawer").getByRole("link", { name: "Activity" }).click();
  await expect(page).toHaveURL(/\/dashboard\/activity/);
  await expect(hamburger).toHaveAttribute("aria-expanded", "false");
});
