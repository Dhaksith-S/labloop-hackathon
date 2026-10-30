import { describe, expect, it } from "vitest";
import { openDatabase } from "../src/lib/database";
import { seedDemoDatabase } from "../src/lib/demo/seed";
import { DEMO_PASSWORD } from "../src/lib/domain";
import { verifyPassword } from "../src/lib/password";
import { lockPrivilegedDemoAccounts } from "../scripts/lib/judge-accounts";

describe("public judge privileged-account isolation", () => {
  it("locks shared manager credentials, revokes only privileged sessions and preserves custody/history idempotently", async () => {
    const db = openDatabase(":memory:", { quiet: true });
    try {
      await seedDemoDatabase(db);
      const profiles = db.prepare("SELECT id, email, password_hash FROM profiles").all() as Array<{ id: string; email: string; password_hash: string }>;
      const manager = profiles.find(p => p.email === "manager@labloop.demo")!;
      const owner = profiles.find(p => p.email === "owner@labloop.demo")!;
      for (const [id, user] of [["fixture-manager", manager.id], ["fixture-owner", owner.id]]) {
        db.prepare("INSERT INTO sessions (id,user_id,token_hash,expires_at,created_at) VALUES (?,?,?,'2099-01-01T00:00:00.000Z','2026-10-30T00:00:00.000Z')").run(id, user, id);
      }
      const history = Object.fromEntries(["bookings", "booking_events", "condition_reports"].map(table => [table, db.prepare(`SELECT count(*) FROM ${table}`).pluck().get()]));
      const first = await lockPrivilegedDemoAccounts(db);
      expect(first).toEqual({ credentialsLocked: 1, sessionsRevoked: 1 });
      const locked = db.prepare("SELECT password_hash FROM profiles WHERE id=?").pluck().get(manager.id) as string;
      expect(await verifyPassword(DEMO_PASSWORD, locked)).toBe(false);
      for (const profile of profiles.filter(p => p.id !== manager.id)) {
        expect(db.prepare("SELECT password_hash FROM profiles WHERE id=?").pluck().get(profile.id)).toBe(profile.password_hash);
        expect(await verifyPassword(DEMO_PASSWORD, profile.password_hash)).toBe(true);
      }
      expect(db.prepare("SELECT user_id FROM sessions").pluck().all()).toEqual([owner.id]);
      for (const [table, count] of Object.entries(history)) expect(db.prepare(`SELECT count(*) FROM ${table}`).pluck().get()).toBe(count);
      expect(db.prepare("SELECT count(*) FROM audit_events WHERE action='auth.public_demo_privileged_lock'").pluck().get()).toBe(1);
      expect(await lockPrivilegedDemoAccounts(db)).toEqual({ credentialsLocked: 0, sessionsRevoked: 0 });
      expect(db.prepare("SELECT password_hash FROM profiles WHERE id=?").pluck().get(manager.id)).toBe(locked);
      expect(db.pragma("integrity_check", { simple: true })).toBe("ok");
    } finally { db.close(); }
  });

  it("refuses a non-fictional privileged profile before changing any credential", async () => {
    const db = openDatabase(":memory:", { quiet: true });
    try {
      await seedDemoDatabase(db);
      db.prepare("UPDATE profiles SET email='staff@institution.example' WHERE email='manager@labloop.demo'").run();
      const before = db.prepare("SELECT password_hash FROM profiles WHERE email='staff@institution.example'").pluck().get();
      await expect(lockPrivilegedDemoAccounts(db)).rejects.toThrow(/non-fictional/);
      expect(db.prepare("SELECT password_hash FROM profiles WHERE email='staff@institution.example'").pluck().get()).toBe(before);
    } finally { db.close(); }
  });
});
