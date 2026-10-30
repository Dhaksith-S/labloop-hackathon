import { defineConfig, devices } from "@playwright/test";
import { E2E_DB_PATH } from "./scripts/lib/e2e-path";

const PORT = 3100;
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  webServer: {
    command: `npm run dev -- --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 240_000,
    env: {
      LABLOOP_DB_PATH: E2E_DB_PATH,
      LABLOOP_SEED_DEMO: "1",
      LABLOOP_INSECURE_COOKIES: "1",
      LABLOOP_SESSION_SECRET: "labloop-e2e-session-secret-not-for-production",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
