import { expect, test, type Page } from "@playwright/test";

const DEMO_PASSWORD = "LabLoop!2026";

test.describe.configure({ mode: "serial" });

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

async function signOut(page: Page) {
  await page.getByRole("button", { name: "Sign out" }).first().click();
  await page.waitForURL((url) => url.pathname === "/");
}

function istLocalDateTime(minutesFromNow: number): string {
  const shifted = new Date(Date.now() + minutesFromNow * 60_000 + 330 * 60_000);
  return shifted.toISOString().slice(0, 16);
}

test("public catalog, resource detail and theme toggle are usable without an account", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "The equipment is already here.",
  );

  await page.goto("/resources");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Underused, not");
  await expect(page.getByRole("link", { name: /Bambu Lab X1 Carbon/ }).first()).toBeVisible();

  await page.getByRole("link", { name: /Bambu Lab X1 Carbon/ }).first().click();
  await expect(page).toHaveURL(/\/resources\/[0-9a-z-]+$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Bambu Lab X1 Carbon");
  await expect(page.getByText("3D Printing Safety").first()).toBeVisible();
  await expect(page.getByRole("link", { name: /Sign in to request/ })).toBeVisible();

  // Interacting with the demo picker first proves the client bundle has hydrated.
  await page.goto("/login");
  const picker = page.getByRole("button", { name: /Use a demo account/ });
  await picker.click();
  await expect(page.getByRole("button", { name: /student@labloop\.demo/ })).toBeVisible();
  await picker.click();

  const before = await page.evaluate(() => document.documentElement.dataset.theme ?? "light");
  await page.getByRole("button", { name: "Toggle light and dark theme" }).first().click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-theme",
    before === "dark" ? "light" : "dark",
  );

  await page.goto("/how-it-works");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Trust is the hard part.");
});

test("demo picker signs in, and a student is redirected away from staff pages", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: /Use a demo account/ }).click();
  await page.getByRole("button", { name: /student@labloop\.demo/ }).click();
  await expect(page.getByLabel("Email address")).toHaveValue("student@labloop.demo");
  await expect(page.getByLabel("Password")).toHaveValue(DEMO_PASSWORD);

  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  await page.goto("/owner/requests");
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  await signOut(page);
  await page.goto("/bookings");
  await expect(page).toHaveURL(/\/login(\?next=.*)?$/);
  await expect(page.getByRole("heading", { name: "Sign in to LabLoop" })).toBeVisible();
});

test("full custody loop: request, approve, check in, return, confirm", async ({ page }) => {
  test.setTimeout(150_000);

  const startsAt = istLocalDateTime(15);
  const endsAt = istLocalDateTime(75);

  // 1. A student requests the open bench for an immediately actionable window.
  await signIn(page, "priya@labloop.demo");
  await page.goto("/resources");
  await page.getByRole("link", { name: /Open Maker Bench 04/ }).first().click();
  await page.getByRole("link", { name: "Request a slot" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Open Maker Bench 04");

  await page.locator("#startsAt").fill(startsAt);
  await page.locator("#endsAt").fill(endsAt);
  await page
    .locator("#purpose")
    .fill("Playwright end-to-end custody verification on the open bench.");
  await page.locator('input[name="rulesAcknowledged"]').check();
  await page.getByRole("button", { name: "Submit request for review" }).click();
  await expect(page).toHaveURL(/\/bookings\/[0-9a-z-]+\?created=1/);
  const bookingUrl = new URL(page.url());
  bookingUrl.search = "";
  const bookingPath = bookingUrl.pathname;
  await expect(page.getByText("Request submitted", { exact: true }).first()).toBeVisible();
  await signOut(page);

  // 2. The resource owner approves the request in the review queue.
  await signIn(page, "owner@labloop.demo");
  await page.goto(bookingPath);
  await page.selectOption("#decision", "approve");
  await page
    .getByLabel("Written reason")
    .fill("Approved in the automated custody test after checking the schedule.");
  await page.getByRole("button", { name: "Record decision" }).click();
  await expect(page.getByText("Awaiting borrower check-in")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Approved", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Awaiting borrower check-in")).toBeVisible();
  await signOut(page);

  // 3. The borrower checks in and records the initial condition.
  await signIn(page, "priya@labloop.demo");
  await page.goto(bookingPath);
  await expect(
    page.getByRole("heading", { name: "Check in & record initial condition" }),
  ).toBeVisible();
  await page.selectOption("#condition", "good");
  await page.locator("#condition-notes").fill("Bench clear, vice mounted, task lamp working.");
  await page.locator('input[name="rulesAcknowledged"]').check();
  await page.getByRole("button", { name: "Check in & take custody" }).click();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Submit the return" })).toBeVisible();

  // 4. The borrower submits the return and final condition.
  await page.selectOption("#final-condition", "fair");
  await page.locator("#return-notes").fill("Assembly done; light residue cleaned from the rear edge.");
  await page.getByRole("button", { name: "Submit return & condition" }).click();
  await page.reload();
  await expect(page.getByText("Awaiting owner confirmation", { exact: false }).first()).toBeVisible();
  await signOut(page);

  // 5. The owner inspects and closes custody.
  await signIn(page, "owner@labloop.demo");
  await page.goto(bookingPath);
  await expect(page.getByRole("heading", { name: "Confirm the return" })).toBeVisible();
  await page
    .getByLabel("Confirmation note")
    .fill("Inspected by the owner: vice, lamp and bench surface verified.");
  await page.getByRole("button", { name: "Confirm return & close custody" }).click();
  await expect(page.getByText("Custody closed", { exact: true }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText("Custody closed", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Completed", { exact: true }).first()).toBeVisible();

  const timeline = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Timeline" }) });
  await expect(timeline.getByText("Return confirmed")).toBeVisible();
  await expect(timeline.getByText("Checked in", { exact: true })).toBeVisible();

  // The immutable condition reports are both visible on the record.
  await expect(page.getByText("Initial · check-in")).toBeVisible();
  await expect(page.getByText("Final · return")).toBeVisible();
});
