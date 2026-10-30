import { randomUUID } from "node:crypto";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/lib/database";
import type { SessionUser } from "@/lib/db-types";
import { getBookingDetail, listBookingsForManager } from "@/lib/bookings";
import { createIncident, listIncidentsForManager } from "@/lib/incidents";
import { getManagedActivity } from "@/lib/activity";
import { createResource, getResourcesForManager, updateResource } from "@/lib/resources";
import { getOrganizationOverview } from "@/lib/stats";
import { safeNextPath } from "@/lib/redirects";
import { resolveE2eDatabasePath } from "../scripts/lib/e2e-path";
import { bookingByPurpose, createSeededDb, resourceByName, sessionFor } from "./helpers";

vi.mock("server-only", () => ({}));
import { createSessionRecord, hashSessionToken, loadSessionUser } from "@/lib/auth";

let db: Db;
let student: SessionUser;
let owner: SessionUser;
let manager: SessionUser;
beforeEach(async () => {
  db = await createSeededDb();
  student = sessionFor(db, "student@labloop.demo");
  owner = sessionFor(db, "owner@labloop.demo");
  manager = sessionFor(db, "manager@labloop.demo");
});
afterEach(() => { db.close(); vi.unstubAllEnvs(); });

describe("private data and listing boundaries", () => {
  it("returns no staff bookings, incidents or audit feed to a student service caller", () => {
    const org = student.memberships[0].organizationId;
    expect(listBookingsForManager(db, student, org)).toEqual([]);
    expect(listIncidentsForManager(db, student, org)).toEqual([]);
    expect(getManagedActivity(db, student, org)).toEqual([]);
    const unrelated = bookingByPurpose(db, "Print the gearbox housing");
    expect(() => getBookingDetail(db, student, unrelated.id)).toThrow(/cannot view/i);
  });

  it("denies suspended managers and owners access to staff records", () => {
    const org = manager.memberships[0].organizationId;
    manager.memberships[0].status = "suspended";
    owner.memberships[0].status = "suspended";
    expect(() => getOrganizationOverview(db, manager, org)).toThrow("FORBIDDEN");
    expect(listBookingsForManager(db, manager, org)).toEqual([]);
    expect(listIncidentsForManager(db, owner, org)).toEqual([]);
    expect(() => getBookingDetail(db, owner,
      bookingByPurpose(db, "Fit-check the sensor enclosure").id)).toThrow(/cannot view/i);
  });

  it("scopes a multi-organization owner's queues and listings to the selected organization", () => {
    const org = owner.memberships[0].organizationId;
    const otherOrg = randomUUID();
    const timestamp = new Date().toISOString();
    db.prepare("INSERT INTO organizations VALUES (?, 'Other fictional institute', ?, 'Asia/Kolkata', 'Demo campus', ?)")
      .run(otherOrg, randomUUID(), timestamp);
    db.prepare("INSERT INTO organization_members VALUES (?, ?, ?, 'owner', NULL, 'active', ?)")
      .run(randomUUID(), otherOrg, owner.id, timestamp);
    owner = sessionFor(db, owner.email);
    const resource = createResource(db, owner, otherOrg, {
      name: "Other organization bench", category: "workspace",
      description: "Fictional second organization access-control fixture.", location: "Demo bay",
      maxDurationHours: 2, fairUseLimit: 2, usageRules: "Keep the fixture clean.",
      conditionSummary: "Good condition",
    });
    const pending = bookingByPurpose(db, "Fit-check the sensor enclosure");
    db.prepare(`INSERT INTO bookings
      (id, resource_id, borrower_id, organization_id, starts_at, ends_at, purpose, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'Other organization fixture', 'pending', ?, ?)`)
      .run(randomUUID(), resource.id, owner.id, otherOrg, pending.starts_at, pending.ends_at, timestamp, timestamp);
    createIncident(db, owner, { resourceId: resource.id, type: "other", severity: "low",
      description: "A fictional cross-organization incident for isolation verification." });
    expect(listBookingsForManager(db, owner, org).every(b => b.organization_id === org)).toBe(true);
    expect(listIncidentsForManager(db, owner, org).every(i => i.resource.organization_id === org)).toBe(true);
    expect(getResourcesForManager(db, owner, org).every(r => r.organization_id === org)).toBe(true);
    expect(listBookingsForManager(db, owner, otherOrg)).toHaveLength(1);
    expect(listIncidentsForManager(db, owner, otherOrg)).toHaveLength(1);
  });

  it("prevents students creating listings or another owner changing a listing", () => {
    const resource = resourceByName(db, "Open Maker Bench 04");
    const input = { name: "Unauthorized listing", category: "workspace" as const,
      description: "This write must fail without changing any resource.", location: "Demo bay",
      maxDurationHours: 2, fairUseLimit: 2, usageRules: "Clean the bench.", conditionSummary: "Good condition" };
    expect(() => createResource(db, student, resource.organization_id, input)).toThrow(/Only verified/i);
    const otherOwner = { ...student, memberships: student.memberships.map(m => ({ ...m, role: "owner" as const })) };
    expect(() => updateResource(db, otherOwner, resource.id, input)).toThrow(/Only the resource owner/i);
    expect(resourceByName(db, "Open Maker Bench 04").name).toBe(resource.name);
  });

  it("rejects moving an approved reservation onto an occupied resource directly in SQL", () => {
    const approved = bookingByPurpose(db, "Print the gearbox housing");
    const bench = resourceByName(db, "Open Maker Bench 04");
    const id = randomUUID();
    db.prepare(`INSERT INTO bookings
      (id, resource_id, borrower_id, organization_id, starts_at, ends_at, purpose, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'Resource reassignment fixture', 'approved', ?, ?)`)
      .run(id, bench.id, student.id, approved.organization_id, approved.starts_at, approved.ends_at,
        approved.created_at, approved.updated_at);
    expect(() => db.prepare("UPDATE bookings SET resource_id = ? WHERE id = ?")
      .run(approved.resource_id, id)).toThrow("BOOKING_CONFLICT");
  });
});

describe("session security", () => {
  it("stores only token hashes, rejects forged/expired tokens and revokes deleted sessions", () => {
    const now = new Date("2026-10-30T08:00:00.000Z");
    const session = createSessionRecord(db, student.id, now);
    const record = db.prepare("SELECT token_hash FROM sessions WHERE user_id = ?").get(student.id) as { token_hash: string };
    expect(record.token_hash).toBe(hashSessionToken(session.token));
    expect(record.token_hash).not.toBe(session.token);
    expect(loadSessionUser(db, session.token, now)?.id).toBe(student.id);
    expect(loadSessionUser(db, session.token, new Date(session.expiresAt))).toBeNull();
    expect(loadSessionUser(db, "forged-token", now)).toBeNull();
    db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(record.token_hash);
    expect(loadSessionUser(db, session.token, now)).toBeNull();
  });

  it("fails closed with a missing or short production session secret", () => {
    vi.stubEnv("NODE_ENV", "production");
    for (const secret of ["", "short"]) {
      vi.stubEnv("LABLOOP_SESSION_SECRET", secret);
      expect(() => createSessionRecord(db, student.id)).toThrow(/required in production/);
    }
    vi.stubEnv("LABLOOP_SESSION_SECRET", "test-only-production-secret-long-enough");
    expect(() => createSessionRecord(db, student.id)).not.toThrow();
  });
});

describe("destructive test preparation and redirects", () => {
  it("allows only the dedicated E2E database and rejects production execution", () => {
    expect(resolveE2eDatabasePath(undefined, "test")).toBe(path.resolve("data/e2e.db"));
    expect(resolveE2eDatabasePath(path.resolve("data/e2e.db"), "test")).toBe(path.resolve("data/e2e.db"));
    for (const target of ["data/labloop.db", "data/customer.db", "../e2e.db", "data/e2e.db/../labloop.db"]) {
      expect(() => resolveE2eDatabasePath(target, "test")).toThrow(/Refusing to reset/);
    }
    expect(() => resolveE2eDatabasePath(undefined, "production")).toThrow(/disabled in production/);
  });

  it("blocks external, backslash, control-character and normalized login redirects", () => {
    for (const target of ["https://example.com", "//example.com", "/\\example.com", "/\n/example.com", "/path/../login", "/login?next=/admin"]) {
      expect(safeNextPath(target)).toBe("/dashboard");
    }
    expect(safeNextPath("/bookings?id=123#timeline")).toBe("/bookings?id=123#timeline");
  });
});
