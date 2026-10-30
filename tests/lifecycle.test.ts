import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/lib/database";
import type { SessionUser } from "@/lib/db-types";
import type { DomainError } from "@/lib/state-machine";
import {
  cancelBooking,
  checkInBooking,
  confirmReturn,
  createBookingRequest,
  decideBooking,
  getBookingDetail,
  getBookingEvents,
  getBookingRow,
  submitReturn,
} from "@/lib/bookings";
import { createIncident, reviewIncident } from "@/lib/incidents";
import { reviewQualification } from "@/lib/qualifications";
import { DomainError as DomainErrorClass } from "@/lib/state-machine";
import { addDays, fromDateTimeLocalValue, istDateKey, nowIso } from "@/lib/time";
import {
  bookingByPurpose,
  createSeededDb,
  resourceByName,
  sessionFor,
} from "./helpers";

let db: Db;
let arjun: SessionUser;
let maya: SessionUser;
let riya: SessionUser;
let priya: SessionUser;
let dev: SessionUser;

beforeEach(async () => {
  db = await createSeededDb();
  arjun = sessionFor(db, "student@labloop.demo");
  maya = sessionFor(db, "owner@labloop.demo");
  riya = sessionFor(db, "manager@labloop.demo");
  priya = sessionFor(db, "priya@labloop.demo");
  dev = sessionFor(db, "dev@labloop.demo");
});

afterEach(() => {
  db.close();
});

function expectDomainError(run: () => unknown, code: string) {
  let caught: unknown;
  try {
    run();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(DomainErrorClass);
  expect((caught as DomainError).code).toBe(code);
}

function istTomorrowAt(hour: number, minute = 0): { start: string; end: string; key: string } {
  const key = istDateKey(addDays(nowIso(), 1));
  const start = fromDateTimeLocalValue(
    `${key}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
  );
  const end = new Date(new Date(start).getTime() + 60 * 60_000).toISOString();
  return { start, end, key };
}

function request(
  user: SessionUser,
  resourceId: string,
  start: string,
  end: string,
  purpose: string,
) {
  return createBookingRequest(db, user, {
    resourceId,
    startsAt: start,
    endsAt: end,
    purpose,
    notes: null,
  });
}

describe("seeded domain lifecycle", () => {
  it("runs request → approval → check-in → return → confirmation with immutable evidence", () => {
    const pending = bookingByPurpose(db, "Fit-check the sensor enclosure");
    expect(pending.status).toBe("pending");
    expect(pending.borrower_id).toBe(arjun.id);

    decideBooking(db, maya, pending.id, "approve", "Bench is free and membership is active.");
    expect(getBookingRow(db, pending.id)?.status).toBe("approved");

    checkInBooking(db, arjun, pending.id, {
      condition: "good",
      accessoriesOk: true,
      notes: "Vice and lamp present; bench surface clean.",
      rulesAcknowledged: true,
    });
    expect(getBookingRow(db, pending.id)?.status).toBe("checked_in");

    submitReturn(db, arjun, pending.id, {
      condition: "fair",
      accessoriesOk: true,
      notes: "Light adhesive residue cleaned; tools returned.",
    });
    expect(getBookingRow(db, pending.id)?.status).toBe("return_submitted");

    confirmReturn(db, maya, pending.id, "Inspected bench; vice and lamp accounted for.", nowIso());
    const completed = getBookingRow(db, pending.id);
    expect(completed?.status).toBe("completed");
    expect(completed?.completed_at).toBeTruthy();

    const conditions = db
      .prepare("SELECT phase, condition FROM condition_reports WHERE booking_id = ? ORDER BY phase")
      .all(pending.id) as Array<{ phase: string; condition: string }>;
    expect(conditions).toEqual([
      { phase: "check_in", condition: "good" },
      { phase: "check_out", condition: "fair" },
    ]);

    const eventKinds = getBookingEvents(db, pending.id).map((event) => event.kind);
    expect(eventKinds).toEqual(
      expect.arrayContaining([
        "submitted",
        "approved",
        "checked_in",
        "return_submitted",
        "return_confirmed",
      ]),
    );

    const auditActions = db
      .prepare("SELECT action FROM audit_events WHERE entity_id = ? ORDER BY created_at")
      .all(pending.id) as Array<{ action: string }>;
    expect(auditActions.map((row) => row.action)).toEqual(
      expect.arrayContaining([
        "booking.approved",
        "booking.checked_in",
        "booking.return_submitted",
        "booking.return_confirmed",
      ]),
    );

    const notification = db
      .prepare("SELECT * FROM notifications WHERE user_id = ? AND kind = 'return_confirmed'")
      .get(arjun.id) as { title: string } | undefined;
    expect(notification?.title).toContain("Return confirmed");
  });

  it("blocks check-in before the window and rejects a non-borrower", () => {
    const approved = bookingByPurpose(db, "Print the gearbox housing");
    expect(approved.status).toBe("approved");
    expectDomainError(
      () =>
        checkInBooking(db, arjun, approved.id, {
          condition: "good",
          accessoriesOk: true,
          rulesAcknowledged: true,
        }),
      "FORBIDDEN",
    );
    expectDomainError(
      () =>
        checkInBooking(db, dev, approved.id, {
          condition: "good",
          accessoriesOk: true,
          rulesAcknowledged: true,
        }),
      "CHECK_IN_WINDOW",
    );
    expect(getBookingRow(db, approved.id)?.status).toBe("approved");
  });

  it("blocks an owner from approving their own request", () => {
    const bench = resourceByName(db, "Open Maker Bench 04");
    const slot = istTomorrowAt(10);
    const created = request(maya, bench.id, slot.start, slot.end, "Self-approval regression check.");
    expectDomainError(
      () => decideBooking(db, maya, created.bookingId, "approve", ""),
      "SELF_APPROVAL",
    );
    expect(getBookingRow(db, created.bookingId)?.status).toBe("pending");
  });

  it("enforces reviewer role and resource ownership boundaries", () => {
    const pending = bookingByPurpose(db, "Fit-check the sensor enclosure");
    expectDomainError(
      () => decideBooking(db, arjun, pending.id, "approve", ""),
      "FORBIDDEN",
    );

    // A promoted "owner" who does not own this resource still cannot review it.
    db.prepare(
      "UPDATE organization_members SET role = 'owner' WHERE user_id = ? AND organization_id = ?",
    ).run(priya.id, priya.memberships[0].organizationId);
    const ownerPriya = sessionFor(db, "priya@labloop.demo");
    expectDomainError(
      () => decideBooking(db, ownerPriya, pending.id, "approve", ""),
      "FORBIDDEN",
    );
    expectDomainError(() => getBookingDetail(db, ownerPriya, pending.id), "FORBIDDEN");
    expect(getBookingDetail(db, maya, pending.id)?.id).toBe(pending.id);
    expect(getBookingDetail(db, riya, pending.id)?.id).toBe(pending.id);
  });

  it("rejects overlapping approval, waitlists fairly, then reopens review without auto-approving", () => {
    const printer = resourceByName(db, "Bambu Lab X1 Carbon");
    const slot = istTomorrowAt(9);

    const devRequest = request(dev, printer.id, slot.start, slot.end, "Overlap check · first requester.");
    const priyaRequest = request(
      priya,
      printer.id,
      slot.start,
      slot.end,
      "Overlap check · second requester.",
    );

    decideBooking(db, maya, devRequest.bookingId, "approve", "Credential verified; slot free.");
    expect(getBookingRow(db, devRequest.bookingId)?.status).toBe("approved");

    expectDomainError(
      () => decideBooking(db, maya, priyaRequest.bookingId, "approve", ""),
      "NOT_ELIGIBLE",
    );

    const waitlisted = decideBooking(
      db,
      maya,
      priyaRequest.bookingId,
      "waitlist",
      "The bay is committed to an approved print in this window.",
    );
    expect(waitlisted.status).toBe("waitlisted");
    expect(waitlisted.waitlist?.position).toBeGreaterThanOrEqual(1);

    const cancelled = cancelBooking(
      db,
      maya,
      devRequest.bookingId,
      "Released for the fairness regression test.",
    );
    expect(cancelled.promotedBookingId).toBe(priyaRequest.bookingId);
    expect(getBookingRow(db, priyaRequest.bookingId)?.status).toBe("pending");

    const reopened = getBookingEvents(db, priyaRequest.bookingId).find(
      (event) => event.kind === "waitlist_review_opened",
    );
    expect(reopened?.summary).toMatch(/not auto-approved/i);
  });
});

describe("database integrity guards", () => {
  it("rejects updates and deletes on append-only records", () => {
    const audit = db.prepare("SELECT id FROM audit_events LIMIT 1").get() as { id: string };
    const timeline = db.prepare("SELECT id FROM booking_events LIMIT 1").get() as { id: string };
    const condition = db.prepare("SELECT id FROM condition_reports LIMIT 1").get() as { id: string };

    expect(() =>
      db.prepare("UPDATE audit_events SET summary = 'rewritten' WHERE id = ?").run(audit.id),
    ).toThrow(/AUDIT_APPEND_ONLY/);
    expect(() => db.prepare("DELETE FROM booking_events WHERE id = ?").run(timeline.id)).toThrow(
      /TIMELINE_APPEND_ONLY/,
    );
    expect(() =>
      db.prepare("UPDATE condition_reports SET notes = 'rewritten' WHERE id = ?").run(condition.id),
    ).toThrow(/CONDITION_REPORT_APPEND_ONLY/);
  });

  it("rejects a direct overlapping approved insert even if application code is bypassed", () => {
    const approved = bookingByPurpose(db, "Print the gearbox housing");
    expect(approved.status).toBe("approved");
    const insert = db.prepare(
      `INSERT INTO bookings
        (id, resource_id, borrower_id, organization_id, starts_at, ends_at, purpose, notes,
         status, decision_reason, decided_by, decided_at, cancelled_at, checked_in_at,
         return_submitted_at, completed_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 'approved', NULL, NULL, NULL, NULL, NULL, NULL, NULL, ?, ?)`,
    );
    expect(() =>
      insert.run(
        randomUUID(),
        approved.resource_id,
        priya.id,
        approved.organization_id,
        approved.starts_at,
        approved.ends_at,
        "Bypass attempt that must be stopped by the database trigger.",
        nowIso(),
        nowIso(),
      ),
    ).toThrow(/BOOKING_CONFLICT/);
  });
});

describe("human review services", () => {
  it("requires a manager to record an incident outcome and notifies the reporter", () => {
    const incident = db
      .prepare("SELECT * FROM incidents WHERE status = 'reviewing' LIMIT 1")
      .get() as { id: string; reporter_id: string };
    expectDomainError(
      () => reviewIncident(db, priya, incident.id, { status: "resolved", resolutionNotes: "" }),
      "FORBIDDEN",
    );
    reviewIncident(db, maya, incident.id, {
      status: "resolved",
      resolutionNotes: "Extraction service completed; filter log updated and bay remains paused.",
    });
    const resolved = db.prepare("SELECT * FROM incidents WHERE id = ?").get(incident.id) as {
      status: string;
      resolution_notes: string;
    };
    expect(resolved.status).toBe("resolved");
    expect(resolved.resolution_notes).toMatch(/Extraction service completed/);
    const notice = db
      .prepare("SELECT * FROM notifications WHERE user_id = ? AND kind = 'incident_updated'")
      .get(incident.reporter_id) as { title: string } | undefined;
    expect(notice?.title).toContain("Incident resolved");
  });

  it("blocks self-review of an incident", () => {
    const printer = resourceByName(db, "Bambu Lab X1 Carbon");
    const incidentId = createIncident(db, maya, {
      resourceId: printer.id,
      type: "other",
      severity: "low",
      description: "A routine inspection found a loose spool holder screw during the shift.",
    });
    expectDomainError(
      () => reviewIncident(db, maya, incidentId, { status: "reviewing", resolutionNotes: "" }),
      "SELF_REVIEW",
    );
    reviewIncident(db, riya, incidentId, { status: "reviewing", resolutionNotes: "" });
    expect(
      (db.prepare("SELECT status FROM incidents WHERE id = ?").get(incidentId) as { status: string })
        .status,
    ).toBe("reviewing");
  });

  it("requires manager verification of qualifications and records the reviewer", () => {
    const qualification = db
      .prepare("SELECT * FROM user_qualifications WHERE status = 'pending' LIMIT 1")
      .get() as { id: string; user_id: string };
    expectDomainError(
      () =>
        reviewQualification(db, arjun, arjun.memberships[0].organizationId, qualification.id, {
          status: "verified",
          notes: "",
        }),
      "FORBIDDEN",
    );
    reviewQualification(db, riya, riya.memberships[0].organizationId, qualification.id, {
      status: "verified",
      notes: "Practical assessment completed with the materials technician.",
      expiresAt: addDays(nowIso(), 365),
    });
    const updated = db
      .prepare("SELECT * FROM user_qualifications WHERE id = ?")
      .get(qualification.id) as {
      status: string;
      verified_by: string;
      expires_at: string | null;
    };
    expect(updated.status).toBe("verified");
    expect(updated.verified_by).toBe(riya.id);
    expect(updated.expires_at).toBeTruthy();
    const notice = db
      .prepare("SELECT * FROM notifications WHERE user_id = ? AND kind = 'qualification_updated'")
      .get(qualification.user_id) as { title: string } | undefined;
    expect(notice?.title).toContain("Qualification verified");
  });
});
