import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium, expect } from "@playwright/test";
import Database from "better-sqlite3";

interface JudgeProfile { publicUrl: string | null; dbPath: string; appPort: number; ingressPort: number; buildId: string }
const runtime = path.join(process.env.LOCALAPPDATA ?? path.join(os.homedir(), "AppData/Local"), "LabLoop/judge-demo");
const profile = JSON.parse(fs.readFileSync(path.join(runtime, "profile.json"), "utf8").replace(/^\uFEFF/, "")) as JudgeProfile;
const local = process.argv.includes("--local");
const revisit = process.argv.includes("--revisit");
const baseURL = local ? "https://labloop-preflight.invalid" : profile.publicUrl;
if (!baseURL) throw new Error("No authenticated, configured public URL. Only --local preflight is currently available.");
const mode = local ? "local-preflight" : "public-funnel";
const evidencePath = path.join(runtime, `${mode}-evidence.json`);
const sessionPath = path.join(runtime, `${mode}-session.json`);

async function main() {
  const publicIP = process.env.LABLOOP_FUNNEL_PUBLIC_IP;
  const hostname = new URL(baseURL!).hostname;
  if (publicIP && !/^\d{1,3}(\.\d{1,3}){3}$/.test(publicIP)) throw new Error("Expected a verified public relay IPv4 address.");
  const browser = await chromium.launch({ args: publicIP ? [`--host-resolver-rules=MAP ${hostname} ${publicIP}`] : [] });
  const context = await browser.newContext({ baseURL: baseURL!, storageState: revisit ? sessionPath : undefined });
  if (local) {
    // Only a local simulation: browser sees HTTPS and sends same-origin Secure
    // cookies, but this route fulfills requests from our loopback ingress.
    await context.route(`${baseURL}/**`, async route => {
      const request = route.request();
      const url = new URL(request.url());
      const response = await context.request.fetch(`http://127.0.0.1:${profile.ingressPort}${url.pathname}${url.search}`, {
        method: request.method(), headers: { ...await request.allHeaders(), "x-forwarded-host": hostname },
        data: request.postDataBuffer() ?? undefined, maxRedirects: 0,
      });
      await route.fulfill({ response });
    });
  }
  const page = await context.newPage();
  page.setDefaultTimeout(20_000);
  const login = async (email: string) => {
    await page.goto("/login");
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password").fill("LabLoop!2026");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  };
  const logout = async () => {
    await page.getByRole("button", { name: "Sign out" }).first().click();
    await page.waitForURL(url => url.pathname === "/");
  };
  try {
    if (revisit) {
      const evidence = JSON.parse(fs.readFileSync(evidencePath, "utf8")) as { bookingPath: string };
      await page.goto(evidence.bookingPath);
      await expect(page.getByText("Completed", { exact: true }).first()).toBeVisible();
      await expect(page.getByText("Initial · check-in")).toBeVisible();
      await expect(page.getByText("Final · return")).toBeVisible();
      const db = new Database(profile.dbPath, { readonly: true });
      try {
        expect(db.pragma("integrity_check", { simple: true })).toBe("ok");
        expect(db.prepare("SELECT status FROM bookings WHERE id = ?").pluck().get(evidence.bookingPath.split("/").pop())).toBe("completed");
      } finally { db.close(); }
      console.log(`${mode}: existing session, completed booking, conditions and database integrity survived application restart.`);
      return;
    }
    await page.goto("/resources");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    if (local) {
      // Browser routing cannot intercept subsequent network redirects. Verify
      // the real ingress response directly without resolving this reserved name.
      const guarded = await context.request.get(`http://127.0.0.1:${profile.ingressPort}/bookings`, {
        headers: { "x-forwarded-host": hostname }, maxRedirects: 0,
      });
      expect(guarded.status()).toBe(307);
      expect(guarded.headers().location).toMatch(/^\/login/);
    } else {
      await page.goto("/bookings");
      await expect(page).toHaveURL(/\/login/);
    }
    expect((await page.goto("/admin"))?.status()).toBe(404);
    await login("priya@labloop.demo");
    await page.goto("/resources");
    await page.getByRole("link", { name: /Open Maker Bench 04/ }).first().click();
    await page.getByRole("link", { name: "Request a slot" }).click();
    const localTime = (minutes: number) => new Date(Date.now() + (minutes + 330) * 60_000).toISOString().slice(0, 16);
    await page.locator("#startsAt").fill(localTime(15));
    await page.locator("#endsAt").fill(localTime(75));
    await page.locator("#purpose").fill(`${mode} judge journey verification ${Date.now()}.`);
    await page.locator('input[name="rulesAcknowledged"]').check();
    await page.getByRole("button", { name: "Submit request for review" }).click();
    await expect(page).toHaveURL(/\/bookings\/[0-9a-z-]+\?created=1/);
    const bookingPath = new URL(page.url()).pathname;
    await logout();
    await login("owner@labloop.demo");
    await page.goto(bookingPath);
    await page.selectOption("#decision", "approve");
    await page.getByLabel("Written reason").fill("Approved for the fictional judge demonstration after eligibility review.");
    await page.getByRole("button", { name: "Record decision" }).click();
    await expect(page.getByText("Awaiting borrower check-in")).toBeVisible();
    await logout();
    await login("priya@labloop.demo");
    await page.goto(bookingPath);
    await page.selectOption("#condition", "good");
    await page.locator("#condition-notes").fill("Fictional check: bench clean, vice and lamp present.");
    await page.locator('input[name="rulesAcknowledged"]').check();
    await page.getByRole("button", { name: "Check in & take custody" }).click();
    await expect(page.getByRole("heading", { name: "Submit the return" })).toBeVisible();
    await page.selectOption("#final-condition", "good");
    await page.locator("#return-notes").fill("Fictional check: all equipment returned in good condition.");
    await page.getByRole("button", { name: "Submit return & condition" }).click();
    await expect(page.getByText("Awaiting owner confirmation", { exact: false }).first()).toBeVisible();
    await logout();
    await login("owner@labloop.demo");
    await page.goto(bookingPath);
    await page.getByLabel("Confirmation note").fill("Fictional hand-back inspected and confirmed for the judge demo.");
    await page.getByRole("button", { name: "Confirm return & close custody" }).click();
    await page.reload();
    await expect(page.getByText("Completed", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Initial · check-in")).toBeVisible();
    await expect(page.getByText("Final · return")).toBeVisible();
    await expect(page.getByText("Return confirmed", { exact: true }).first()).toBeVisible();
    const cookie = (await context.cookies()).find(c => c.name === "labloop_session");
    expect(cookie?.secure).toBe(true); expect(cookie?.httpOnly).toBe(true); expect(cookie?.sameSite).toBe("Lax");
    await context.storageState({ path: sessionPath });
    fs.writeFileSync(evidencePath, JSON.stringify({ mode, publicUrl: local ? null : baseURL,
      bookingPath, buildId: profile.buildId, verifiedAt: new Date().toISOString(),
      publicRelayIPv4: publicIP ?? null, cookieFlags: { secure: true, httpOnly: true, sameSite: "Lax" } }, null, 2), { mode: 0o600 });
    console.log(`${mode}: catalog, private-route guard, admin-path block, student request, owner approval, check-in, both conditions, return confirmation, history and cookie flags passed.`);
    console.log(local ? "This is a local reverse-proxy simulation, not a public deployment." : "Public URL journey passed; independent off-tailnet device verification must be recorded separately.");
  } finally { await context.close(); await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
