import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { createServer } from "node:net";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { chromium, expect } from "@playwright/test";
import Database from "better-sqlite3";
import { backupDatabase } from "./lib/backup";

async function main() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "labloop-production-"));
  const dbPath = path.join(dir, "verification.db");
  const socket = createServer();
  await new Promise<void>(resolve => socket.listen(0, "127.0.0.1", resolve));
  const address = socket.address();
  if (!address || typeof address === "string") throw new Error("No test port available.");
  const port = address.port;
  await new Promise<void>((resolve, reject) => socket.close(error => error ? reject(error) : resolve()));
  const baseURL = `http://127.0.0.1:${port}`;
  const env: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: "production", PORT: String(port),
    LABLOOP_DB_PATH: dbPath, LABLOOP_SEED_DEMO: "1", LABLOOP_INSECURE_COOKIES: "0",
    LABLOOP_SESSION_SECRET: randomBytes(32).toString("base64url"),
    NEXT_PUBLIC_APP_URL: "https://production-verification.invalid", NEXT_TELEMETRY_DISABLED: "1" };
  let server: ChildProcess | undefined;
  let serverLog = "";
  const start = async () => {
    server = spawn(process.execPath, ["--import", "tsx", "scripts/start-production.ts"], { env, windowsHide: true });
    server.stdout?.on("data", data => { serverLog = (serverLog + data).slice(-8000); });
    server.stderr?.on("data", data => { serverLog = (serverLog + data).slice(-8000); });
    for (let attempt = 0; attempt < 200; attempt++) {
      if (server.exitCode !== null) throw new Error(`Production process exited. ${serverLog}`);
      try { if ((await fetch(`${baseURL}/login`)).ok) return; } catch { /* Wait for this process. */ }
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    throw new Error(`Production startup timed out. ${serverLog}`);
  };
  const stop = async () => {
    if (!server || server.exitCode !== null) return;
    const exited = new Promise(resolve => server!.once("exit", resolve));
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/PID", String(server.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
    } else { server.kill("SIGTERM"); }
    await exited;
  };
  const browser = await chromium.launch();
  try {
    await start();
    for (const route of ["/", "/login", "/resources"]) {
      const response = await fetch(`${baseURL}${route}`);
      expect(response.status).toBe(200);
      expect(response.headers.get("x-frame-options")).toBe("DENY");
      expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    }
    const page = await browser.newPage({ baseURL });
    const login = async (email: string) => {
      await page.goto("/login");
      await page.getByLabel("Email address").fill(email);
      await page.getByLabel("Password").fill("LabLoop!2026");
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await expect(page).toHaveURL(/\/dashboard/);
    };
    const logout = async () => {
      await page.getByRole("button", { name: "Sign out" }).first().click();
      await expect(page).toHaveURL(`${baseURL}/`);
    };
    await login("owner@labloop.demo");
    const initial = new Database(dbPath, { readonly: true });
    const pending = initial.prepare("SELECT id FROM bookings WHERE purpose LIKE 'Fit-check the sensor enclosure%'").get() as { id: string };
    initial.close();
    const bookingPath = `/bookings/${pending.id}`;
    await page.goto(bookingPath);
    await page.selectOption("#decision", "approve");
    await page.getByRole("button", { name: "Record decision" }).click();
    await expect(page.getByText("Awaiting borrower check-in")).toBeVisible();
    await logout();
    await login("student@labloop.demo");
    await page.goto(bookingPath);
    await page.locator('input[name="rulesAcknowledged"]').check();
    await page.getByRole("button", { name: "Check in & take custody" }).click();
    await expect(page.getByRole("heading", { name: "Submit the return" })).toBeVisible();
    await page.getByRole("button", { name: "Submit return & condition" }).click();
    await expect(page.getByText("Awaiting owner confirmation", { exact: false }).first()).toBeVisible();
    await logout();
    await login("owner@labloop.demo");
    await page.goto(bookingPath);
    await page.getByRole("button", { name: "Confirm return & close custody" }).click();
    await expect(page.getByText("Custody closed", { exact: true }).first()).toBeVisible();
    const cookie = (await page.context().cookies()).find(c => c.name === "labloop_session");
    expect(cookie?.secure).toBe(true);
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("Lax");
    console.log("Production HTTP/header checks and browser approval-to-return loop passed; Secure session cookie verified.");
    await stop();
    await start();
    await page.goto(bookingPath);
    await expect(page.getByText("Custody closed", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Initial · check-in")).toBeVisible();
    await expect(page.getByText("Final · return")).toBeVisible();
    const db = new Database(dbPath, { readonly: true });
    try {
      expect(db.prepare("SELECT status FROM bookings WHERE id = ?").pluck().get(pending.id)).toBe("completed");
      expect(db.prepare("SELECT count(*) FROM condition_reports WHERE booking_id = ?").pluck().get(pending.id)).toBe(2);
      expect(db.pragma("integrity_check", { simple: true })).toBe("ok");
    } finally { db.close(); }
    await backupDatabase(dbPath, path.join(dir, "verified-backup.db"));
    console.log("Local production restart preserved the authenticated session, completed booking and both condition reports; backup integrity passed.");
    console.log("No public deployment or hosted-volume verification is claimed.");
  } finally {
    await browser.close(); await stop();
    // This newly created private fixture is retained locally for diagnosis, never committed.
    console.log(`Isolated production fixture: ${dir}`);
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
