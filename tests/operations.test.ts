import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { backupDatabase } from "../scripts/lib/backup";
import { validateProductionEnvironment } from "../scripts/lib/production-env";

describe("production configuration", () => {
  const valid = { LABLOOP_SESSION_SECRET: "test-only-secret-at-least-24-characters",
    LABLOOP_DB_PATH: path.resolve("data/production-fixture.db"), LABLOOP_SEED_DEMO: "1",
    NEXT_PUBLIC_APP_URL: "https://labloop.example.invalid" };

  it("accepts explicit volume configuration, HTTPS and a sufficiently long secret", () => {
    expect(() => validateProductionEnvironment(valid)).not.toThrow();
  });

  it("refuses unsafe configuration before database setup can run", () => {
    for (const invalid of [
      { LABLOOP_SESSION_SECRET: "" }, { LABLOOP_DB_PATH: "data/labloop.db" },
      { LABLOOP_INSECURE_COOKIES: "1" }, { NEXT_PUBLIC_APP_URL: "http://localhost:3000" },
      { LABLOOP_SEED_DEMO: "" },
    ]) expect(() => validateProductionEnvironment({ ...valid, ...invalid })).toThrow();
  });
});

describe("SQLite backups and restart persistence", () => {
  it("preserves committed WAL content across reconnection and restores to a fresh destination", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "labloop-backup-"));
    const source = path.join(dir, "source.db");
    const backup = path.join(dir, "backup.db");
    const restored = path.join(dir, "restored.db");
    const db = new Database(source);
    try {
      db.pragma("journal_mode = WAL");
      db.exec("CREATE TABLE evidence (value TEXT); INSERT INTO evidence VALUES ('committed custody fixture')");
      await backupDatabase(source, backup);
      await expect(backupDatabase(source, backup)).rejects.toThrow(/EEXIST/);
      await expect(backupDatabase(source, source)).rejects.toThrow(/different/);
      await backupDatabase(backup, restored);
      for (const file of [source, backup, restored]) {
        const reopened = new Database(file, { readonly: true });
        try {
          expect(reopened.prepare("SELECT value FROM evidence").pluck().get()).toBe("committed custody fixture");
          expect(reopened.pragma("integrity_check", { simple: true })).toBe("ok");
        } finally { reopened.close(); }
      }
    } finally {
      db.close();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
