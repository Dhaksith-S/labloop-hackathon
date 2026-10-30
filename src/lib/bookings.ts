import { randomUUID } from "node:crypto";
import type {
  BookingEventRow,
  BookingRow,
  BookingWithContext,
  ConditionReportRow,
  IncidentRow,
  ProfileRow,
  ResourceWithRelations,
  SessionUser,
} from "./db-types";
import type { BookingStatus, ConditionGrade } from "./domain";
import type { Db } from "./db";
import {
  evaluateEligibility,
  getWaitlistPosition,
  type EligibilityBorrower,
  type EligibilityBooking,
  type EligibilityResource,
  type EligibilityResult,
} from "./eligibility";
import { logAudit, logBookingEvent, notifyResourceStaff, pushNotification } from "./events";
import { getResourceById } from "./resources";
import {
  assertTransition,
  checkInAvailability,
  DomainError,
  isOverdue,
} from "./state-machine";
import { nowIso } from "./time";

const BLOCKING_STATUSES: BookingStatus[] = ["approved", "checked_in", "return_submitted"];

function mapEligibilityResource(resource: ResourceWithRelations): EligibilityResource {
  return {
    id: resource.id,
    name: resource.name,
    status: resource.status,
    maxDurationHours: resource.max_duration_hours,
    fairUseLimit: resource.fair_use_limit,
    requirements: resource.requirements,
    availability: resource.availability,
    blackouts: resource.blackouts,
  };
}

export function getBorrowerEligibilityContext(
  db: Db,
  userId: string,
  organizationId: string,
): EligibilityBorrower {
  const membership = db
    .prepare(
      `SELECT status FROM organization_members WHERE user_id = ? AND organization_id = ?`,
    )
    .get(userId, organizationId) as { status: "active" | "suspended" } | undefined;
  const qualifications = db
    .prepare(
      `SELECT name, status, expires_at FROM user_qualifications
       WHERE user_id = ? AND organization_id = ?`,
    )
    .all(userId, organizationId) as Array<{
    name: string;
    status: string;
    expires_at: string | null;
  }>;
  return {
    userId,
    membershipStatus: membership?.status ?? "none",
    qualifications: qualifications.map((q) => ({
      name: q.name,
      status: q.status as EligibilityBorrower["qualifications"][number]["status"],
      expires_at: q.expires_at,
    })),
  };
}

export function getEligibilityBookingsForResource(
  db: Db,
  resourceId: string,
): EligibilityBooking[] {
  const rows = db
    .prepare("SELECT id, borrower_id, starts_at, ends_at, status FROM bookings WHERE resource_id = ?")
    .all(resourceId) as Array<{
    id: string;
    borrower_id: string;
    starts_at: string;
    ends_at: string;
    status: BookingStatus;
  }>;
  return rows.map((row) => ({
    id: row.id,
    borrowerId: row.borrower_id,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status,
  }));
}

export function getEligibilityBookingsForBorrower(
  db: Db,
  borrowerId: string,
): EligibilityBooking[] {
  const rows = db
    .prepare(
      "SELECT id, borrower_id, starts_at, ends_at, status FROM bookings WHERE borrower_id = ?",
    )
    .all(borrowerId) as Array<{
    id: string;
    borrower_id: string;
    starts_at: string;
    ends_at: string;
    status: BookingStatus;
  }>;
  return rows.map((row) => ({
    id: row.id,
    borrowerId: row.borrower_id,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status,
  }));
}

export function evaluateBookingEligibility(
  db: Db,
  bookingId: string,
  mode: "request" | "approval" = "approval",
  now = nowIso(),
): EligibilityResult {
  const booking = db.prepare("SELECT * FROM bookings WHERE id = ?").get(bookingId) as
    | BookingRow
    | undefined;
  if (!booking) throw new DomainError("NOT_FOUND", "Booking not found.");
  const resource = getResourceById(db, booking.resource_id);
  if (!resource) throw new DomainError("NOT_FOUND", "Resource not found.");
  return evaluateEligibility({
    resource: mapEligibilityResource(resource),
    borrower: getBorrowerEligibilityContext(db, booking.borrower_id, resource.organization_id),
    requestedStartsAt: booking.starts_at,
    requestedEndsAt: booking.ends_at,
    now,
    resourceBookings: getEligibilityBookingsForResource(db, booking.resource_id),
    borrowerBookings: getEligibilityBookingsForBorrower(db, booking.borrower_id),
    excludeBookingId: booking.id,
    mode,
  });
}

function hydrateBooking(db: Db, row: BookingRow): BookingWithContext {
  const resource = getResourceById(db, row.resource_id);
  if (!resource) throw new DomainError("RESOURCE_NOT_FOUND", "Resource not found.");
  const borrower = db
    .prepare("SELECT id, full_name, email, headline, avatar_color FROM profiles WHERE id = ?")
    .get(row.borrower_id) as BookingWithContext["borrower"] | undefined;
  const resourceOwner = db
    .prepare("SELECT id, full_name, email FROM profiles WHERE id = ?")
    .get(resource.owner_id) as BookingWithContext["resourceOwner"] | undefined;
  if (!borrower || !resourceOwner) throw new DomainError("PROFILE_NOT_FOUND", "Profile not found.");
  return {
    ...row,
    resource,
    borrower,
    resourceOwner,
  };
}

export function getBookingRow(db: Db, bookingId: string): BookingRow | null {
  return (
    (db.prepare("SELECT * FROM bookings WHERE id = ?").get(bookingId) as BookingRow | undefined) ??
    null
  );
}

export function canViewBooking(
  db: Db,
  user: SessionUser,
  booking: BookingRow,
): boolean {
  if (booking.borrower_id === user.id) return true;
  const resource = db
    .prepare("SELECT owner_id, organization_id FROM resources WHERE id = ?")
    .get(booking.resource_id) as { owner_id: string; organization_id: string } | undefined;
  if (!resource) return false;
  if (resource.owner_id === user.id) return true;
  const membership = user.memberships.find((m) => m.organizationId === resource.organization_id);
  return Boolean(
    membership &&
      membership.status === "active" &&
      (membership.role === "manager" || membership.role === "admin"),
  );
}

export function getBookingDetail(
  db: Db,
  user: SessionUser,
  bookingId: string,
): BookingWithContext | null {
  const row = getBookingRow(db, bookingId);
  if (!row) return null;
  if (!canViewBooking(db, user, row)) throw new DomainError("FORBIDDEN", "You cannot view this booking.");
  return hydrateBooking(db, row);
}

export function getBookingEvents(db: Db, bookingId: string): BookingEventRow[] {
  return db
    .prepare("SELECT * FROM booking_events WHERE booking_id = ? ORDER BY created_at ASC")
    .all(bookingId) as BookingEventRow[];
}

export function getConditionReports(db: Db, bookingId: string): ConditionReportRow[] {
  return db
    .prepare("SELECT * FROM condition_reports WHERE booking_id = ? ORDER BY created_at ASC")
    .all(bookingId) as ConditionReportRow[];
}

export function getBookingIncidents(db: Db, bookingId: string): IncidentRow[] {
  return db
    .prepare("SELECT * FROM incidents WHERE booking_id = ? ORDER BY created_at DESC")
    .all(bookingId) as IncidentRow[];
}

export interface WaitlistInfo {
  position: number;
  total: number;
  aheadOf: number;
}

export function getBookingWaitlist(db: Db, bookingId: string): WaitlistInfo {
  const booking = getBookingRow(db, bookingId);
  if (!booking) return { position: 0, total: 0, aheadOf: 0 };
  const all = db
    .prepare(
      "SELECT id, status, created_at FROM bookings WHERE resource_id = ? AND status = 'waitlisted'",
    )
    .all(booking.resource_id) as Array<Pick<BookingRow, "id" | "status" | "created_at">>;
  return getWaitlistPosition(all, bookingId);
}

export interface CreateBookingResult {
  bookingId: string;
  eligibility: EligibilityResult;
}

export function createBookingRequest(
  db: Db,
  user: SessionUser,
  input: {
    resourceId: string;
    startsAt: string;
    endsAt: string;
    purpose: string;
    notes?: string | null;
  },
): CreateBookingResult {
  const resource = getResourceById(db, input.resourceId);
  if (!resource || resource.status !== "active") {
    throw new DomainError("RESOURCE_UNAVAILABLE", "This resource is not accepting requests.");
  }
  const membership = user.memberships.find((m) => m.organizationId === resource.organization_id);
  if (!membership || membership.status !== "active") {
    throw new DomainError("MEMBERSHIP_REQUIRED", "An active institution membership is required.");
  }
  if (input.startsAt >= input.endsAt) {
    throw new DomainError("INVALID_WINDOW", "End time must be after start time.");
  }
  if (input.purpose.trim().length < 10) {
    throw new DomainError("PURPOSE_REQUIRED", "Describe the purpose in at least 10 characters.");
  }

  const eligibility = evaluateEligibility({
    resource: mapEligibilityResource(resource),
    borrower: getBorrowerEligibilityContext(db, user.id, resource.organization_id),
    requestedStartsAt: input.startsAt,
    requestedEndsAt: input.endsAt,
    now: nowIso(),
    resourceBookings: getEligibilityBookingsForResource(db, input.resourceId),
    borrowerBookings: getEligibilityBookingsForBorrower(db, user.id),
    mode: "request",
  });

  if (!eligibility.eligible) {
    throw new DomainError("INELIGIBLE", eligibility.summary, eligibility.blockingReasons);
  }

  const bookingId = randomUUID();
  const timestamp = nowIso();

  db.transaction(() => {
    db.prepare(
      `INSERT INTO bookings
        (id, resource_id, borrower_id, organization_id, starts_at, ends_at, purpose, notes,
         status, decision_reason, decided_by, decided_at, cancelled_at, checked_in_at,
         return_submitted_at, completed_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', NULL, NULL, NULL, NULL, NULL, NULL, NULL, ?, ?)`,
    ).run(
      bookingId,
      input.resourceId,
      user.id,
      resource.organization_id,
      input.startsAt,
      input.endsAt,
      input.purpose.trim(),
      input.notes?.trim() || null,
      timestamp,
      timestamp,
    );

    logBookingEvent(db, {
      bookingId,
      actorId: user.id,
      kind: "submitted",
      summary: "Booking request submitted for owner review.",
      metadata: { resourceId: input.resourceId },
    });
    logBookingEvent(db, {
      bookingId,
      actorId: user.id,
      kind: "eligibility_checked",
      summary: "Deterministic eligibility checks passed at submission.",
      metadata: {
        checks: eligibility.checks.map((check) => ({
          id: check.id,
          status: check.status,
        })),
      },
    });
    logAudit(db, {
      organizationId: resource.organization_id,
      actorId: user.id,
      action: "booking.submitted",
      entityType: "booking",
      entityId: bookingId,
      summary: `Requested ${resource.name} for ${input.startsAt} to ${input.endsAt}.`,
      metadata: { eligibility: eligibility.eligible },
    });
    notifyResourceStaff(db, {
      organizationId: resource.organization_id,
      resourceOwnerId: resource.owner_id,
      actorId: user.id,
      kind: "request_submitted",
      title: `New request · ${resource.name}`,
      body: `${user.fullName} requested a slot. Eligibility checks passed; human review is required.`,
      href: "/owner/requests",
    });
  }).immediate();

  return { bookingId, eligibility };
}

export type Decision = "approve" | "reject" | "waitlist";

function nextStatus(decision: Decision): BookingStatus {
  if (decision === "approve") return "approved";
  if (decision === "reject") return "rejected";
  return "waitlisted";
}

export interface DecisionResult {
  status: BookingStatus;
  waitlist?: WaitlistInfo;
}

export function decideBooking(
  db: Db,
  user: SessionUser,
  bookingId: string,
  decision: Decision,
  reason: string,
): DecisionResult {
  const booking = getBookingRow(db, bookingId);
  if (!booking) throw new DomainError("NOT_FOUND", "Booking not found.");
  const resource = getResourceById(db, booking.resource_id);
  if (!resource) throw new DomainError("NOT_FOUND", "Resource not found.");

  const membership = user.memberships.find((m) => m.organizationId === resource.organization_id);
  const canManage = Boolean(
    membership &&
      membership.status === "active" &&
      (membership.role === "manager" ||
        membership.role === "admin" ||
        (membership.role === "owner" && resource.owner_id === user.id)),
  );
  if (!canManage) {
    throw new DomainError("FORBIDDEN", "You are not an authorized reviewer for this resource.");
  }
  if (booking.borrower_id === user.id) {
    throw new DomainError(
      "SELF_APPROVAL",
      "You cannot review your own request. Ask another authorized manager to decide.",
    );
  }
  if (decision !== "approve" && reason.trim().length < 5) {
    throw new DomainError("REASON_REQUIRED", "Add a short written reason for this decision.");
  }

  const target = nextStatus(decision);
  assertTransition(booking.status, target);

  if (decision === "approve") {
    const eligibility = evaluateBookingEligibility(db, bookingId, "approval");
    if (!eligibility.eligible) {
      throw new DomainError(
        "NOT_ELIGIBLE",
        "This request no longer passes the required checks. Waitlist or reject it with a reason.",
        eligibility.blockingReasons,
      );
    }
  }

  const timestamp = nowIso();
  let waitlist: WaitlistInfo | undefined;
  const finalReason =
    decision === "approve"
      ? reason.trim() || "Approved after eligibility and schedule review."
      : reason.trim();

  db.transaction(() => {
    db.prepare(
      `UPDATE bookings SET status = ?, decision_reason = ?, decided_by = ?, decided_at = ?,
       updated_at = ? WHERE id = ?`,
    ).run(target, finalReason, user.id, timestamp, timestamp, bookingId);

    if (decision === "waitlist") {
      const position = getBookingWaitlist(db, bookingId);
      waitlist = position;
      logBookingEvent(db, {
        bookingId,
        actorId: user.id,
        kind: "waitlisted",
        summary: `Waitlisted by owner. Position ${position.position} of ${position.total}. ${finalReason}`,
        metadata: { ...position, reason: finalReason },
      });
    } else {
      logBookingEvent(db, {
        bookingId,
        actorId: user.id,
        kind: target,
        summary:
          decision === "approve"
            ? `Approved by ${user.fullName}. ${finalReason}`
            : `Request not approved: ${finalReason}`,
        metadata: { reason: finalReason },
      });
    }

    logAudit(db, {
      organizationId: resource.organization_id,
      actorId: user.id,
      action: `booking.${target}`,
      entityType: "booking",
      entityId: bookingId,
      summary:
        decision === "approve"
          ? `Approved ${resource.name} request from ${booking.borrower_id}.`
          : `${decision === "reject" ? "Rejected" : "Waitlisted"} ${resource.name} request with a written reason.`,
      metadata: { reason: finalReason },
    });

    pushNotification(db, {
      userId: booking.borrower_id,
      kind: `booking_${target}`,
      title:
        decision === "approve"
          ? `Approved · ${resource.name}`
          : decision === "reject"
            ? `Request not approved · ${resource.name}`
            : `Waitlisted · ${resource.name}`,
      body:
        decision === "waitlist"
          ? `${user.fullName} placed your request at position ${waitlist?.position ?? 1} of ${waitlist?.total ?? 1}. Reason: ${finalReason}`
          : `${user.fullName}: ${finalReason}`,
      href: `/bookings/${bookingId}`,
    });
  }).immediate();

  return { status: target, waitlist };
}

export interface CancelResult {
  promotedBookingId?: string;
}

export function cancelBooking(
  db: Db,
  user: SessionUser,
  bookingId: string,
  reason: string,
): CancelResult {
  const booking = getBookingRow(db, bookingId);
  if (!booking) throw new DomainError("NOT_FOUND", "Booking not found.");
  const resource = getResourceById(db, booking.resource_id);
  if (!resource) throw new DomainError("NOT_FOUND", "Resource not found.");

  const isBorrower = booking.borrower_id === user.id;
  const membership = user.memberships.find((m) => m.organizationId === resource.organization_id);
  const isManager = Boolean(
    membership &&
      membership.status === "active" &&
      (membership.role === "manager" ||
        membership.role === "admin" ||
        (membership.role === "owner" && resource.owner_id === user.id)),
  );
  if (!isBorrower && !isManager) {
    throw new DomainError("FORBIDDEN", "You cannot cancel this booking.");
  }
  if (isManager && !isBorrower && reason.trim().length < 5) {
    throw new DomainError("REASON_REQUIRED", "Add a reason for the cancellation.");
  }
  assertTransition(booking.status, "cancelled");

  const timestamp = nowIso();
  const wasReserved = booking.status === "approved";
  let promotedBookingId: string | undefined;

  db.transaction(() => {
    db.prepare(
      "UPDATE bookings SET status = 'cancelled', cancelled_at = ?, updated_at = ? WHERE id = ?",
    ).run(timestamp, timestamp, bookingId);

    logBookingEvent(db, {
      bookingId,
      actorId: user.id,
      kind: "cancelled",
      summary: `${isBorrower ? "Borrower" : "Manager"} cancelled the booking.${
        reason.trim() ? ` Reason: ${reason.trim()}` : ""
      }`,
      metadata: { reason: reason.trim() || null },
    });
    logAudit(db, {
      organizationId: resource.organization_id,
      actorId: user.id,
      action: "booking.cancelled",
      entityType: "booking",
      entityId: bookingId,
      summary: `Cancelled ${resource.name} booking (${booking.status}).`,
      metadata: { reason: reason.trim() || null },
    });

    if (isBorrower) {
      notifyResourceStaff(db, {
        organizationId: resource.organization_id,
        resourceOwnerId: resource.owner_id,
        actorId: user.id,
        kind: "booking_cancelled",
        title: `Cancelled · ${resource.name}`,
        body: `${user.fullName} cancelled their ${booking.status} booking.${reason.trim() ? ` Reason: ${reason.trim()}` : ""}`,
        href: `/owner/requests`,
      });
    } else {
      pushNotification(db, {
        userId: booking.borrower_id,
        kind: "booking_cancelled",
        title: `Booking cancelled · ${resource.name}`,
        body: `${user.fullName} cancelled the booking.${reason.trim() ? ` Reason: ${reason.trim()}` : ""}`,
        href: `/bookings/${bookingId}`,
      });
    }

    // Releasing an approved slot re-opens the earliest eligible waitlisted
    // request for HUMAN review. It is never auto-approved.
    if (wasReserved) {
      promotedBookingId = promoteWaitlistCandidate(
        db,
        resource,
        booking.starts_at,
        booking.ends_at,
        user.id,
        timestamp,
      );
    }
  }).immediate();

  return { promotedBookingId };
}

function promoteWaitlistCandidate(
  db: Db,
  resource: ResourceWithRelations,
  releasedStart: string,
  releasedEnd: string,
  actorId: string,
  timestamp: string,
): string | undefined {
  if (releasedEnd <= timestamp) return undefined;
  const candidates = db
    .prepare(
      `SELECT * FROM bookings
       WHERE resource_id = ? AND status = 'waitlisted'
         AND starts_at < ? AND ends_at > ?
       ORDER BY created_at ASC`,
    )
    .all(resource.id, releasedEnd, releasedStart) as BookingRow[];

  for (const candidate of candidates) {
    const eligibility = evaluateEligibility({
      resource: mapEligibilityResource(resource),
      borrower: getBorrowerEligibilityContext(
        db,
        candidate.borrower_id,
        resource.organization_id,
      ),
      requestedStartsAt: candidate.starts_at,
      requestedEndsAt: candidate.ends_at,
      now: timestamp,
      resourceBookings: getEligibilityBookingsForResource(db, resource.id),
      borrowerBookings: getEligibilityBookingsForBorrower(db, candidate.borrower_id),
      excludeBookingId: candidate.id,
      mode: "approval",
    });
    if (!eligibility.eligible) continue;

    db.prepare(
      `UPDATE bookings SET status = 'pending', decision_reason = NULL,
       decided_by = NULL, decided_at = NULL, updated_at = ? WHERE id = ?`,
    ).run(timestamp, candidate.id);
    logBookingEvent(db, {
      bookingId: candidate.id,
      actorId: null,
      kind: "waitlist_review_opened",
      summary:
        "A conflicting reservation was released. This waitlisted request returned to owner review; it was not auto-approved.",
      metadata: { releasedBookingSlot: { start: releasedStart, end: releasedEnd } },
    });
    logAudit(db, {
      organizationId: resource.organization_id,
      actorId,
      action: "booking.waitlist_reopened",
      entityType: "booking",
      entityId: candidate.id,
      summary: "Released slot returned the first eligible waitlisted request to human review.",
    });
    pushNotification(db, {
      userId: candidate.borrower_id,
      kind: "waitlist_review_opened",
      title: `Waitlist review opened · ${resource.name}`,
      body: "A conflicting booking was released. Your request is back in the owner review queue — approval is still a human decision.",
      href: `/bookings/${candidate.id}`,
    });
    notifyResourceStaff(db, {
      organizationId: resource.organization_id,
      resourceOwnerId: resource.owner_id,
      actorId: null,
      kind: "waitlist_review_opened",
      title: `Waitlist review queued · ${resource.name}`,
      body: "A released slot returned the first eligible waitlisted request to your review queue.",
      href: "/owner/requests",
    });
    return candidate.id;
  }
  return undefined;
}

export interface CheckInInput {
  condition: ConditionGrade;
  accessoriesOk: boolean;
  notes?: string | null;
  rulesAcknowledged: boolean;
}

export function checkInBooking(
  db: Db,
  user: SessionUser,
  bookingId: string,
  input: CheckInInput,
  now = nowIso(),
): void {
  const booking = getBookingRow(db, bookingId);
  if (!booking) throw new DomainError("NOT_FOUND", "Booking not found.");
  if (booking.borrower_id !== user.id) {
    throw new DomainError("FORBIDDEN", "Only the approved borrower can check in.");
  }
  if (!input.rulesAcknowledged) {
    throw new DomainError("RULES_REQUIRED", "Acknowledge the usage rules before check-in.");
  }
  assertTransition(booking.status, "checked_in");
  const window = checkInAvailability(booking, now);
  if (!window.allowed) {
    throw new DomainError("CHECK_IN_WINDOW", window.reason ?? "Check-in is not available.");
  }
  const resource = getResourceById(db, booking.resource_id);
  if (!resource) throw new DomainError("NOT_FOUND", "Resource not found.");

  db.transaction(() => {
    db.prepare(
      "UPDATE bookings SET status = 'checked_in', checked_in_at = ?, updated_at = ? WHERE id = ?",
    ).run(now, now, bookingId);
    db.prepare(
      `INSERT INTO condition_reports
        (id, booking_id, phase, condition, accessories_ok, notes, photo_url, submitted_by, created_at)
       VALUES (?, ?, 'check_in', ?, ?, ?, NULL, ?, ?)`,
    ).run(
      randomUUID(),
      bookingId,
      input.condition,
      input.accessoriesOk ? 1 : 0,
      input.notes?.trim() || null,
      user.id,
      now,
    );
    logBookingEvent(db, {
      bookingId,
      actorId: user.id,
      kind: "checked_in",
      summary: `Checked in. Initial condition: ${input.condition}. Custody transferred to the borrower.`,
      metadata: { condition: input.condition, accessoriesOk: input.accessoriesOk },
    });
    logAudit(db, {
      organizationId: resource.organization_id,
      actorId: user.id,
      action: "booking.checked_in",
      entityType: "booking",
      entityId: bookingId,
      summary: `Checked in ${resource.name}; initial condition ${input.condition}.`,
    });
    notifyResourceStaff(db, {
      organizationId: resource.organization_id,
      resourceOwnerId: resource.owner_id,
      actorId: user.id,
      kind: "checked_in",
      title: `Checked in · ${resource.name}`,
      body: `${user.fullName} took custody. Initial condition: ${input.condition}.`,
      href: `/bookings/${bookingId}`,
    });
  }).immediate();
}

export function submitReturn(
  db: Db,
  user: SessionUser,
  bookingId: string,
  input: { condition: ConditionGrade; accessoriesOk: boolean; notes?: string | null },
  now = nowIso(),
): void {
  const booking = getBookingRow(db, bookingId);
  if (!booking) throw new DomainError("NOT_FOUND", "Booking not found.");
  if (booking.borrower_id !== user.id) {
    throw new DomainError("FORBIDDEN", "Only the borrower can submit this return.");
  }
  assertTransition(booking.status, "return_submitted");
  const resource = getResourceById(db, booking.resource_id);
  if (!resource) throw new DomainError("NOT_FOUND", "Resource not found.");

  db.transaction(() => {
    db.prepare(
      "UPDATE bookings SET status = 'return_submitted', return_submitted_at = ?, updated_at = ? WHERE id = ?",
    ).run(now, now, bookingId);
    db.prepare(
      `INSERT INTO condition_reports
        (id, booking_id, phase, condition, accessories_ok, notes, photo_url, submitted_by, created_at)
       VALUES (?, ?, 'check_out', ?, ?, ?, NULL, ?, ?)`,
    ).run(
      randomUUID(),
      bookingId,
      input.condition,
      input.accessoriesOk ? 1 : 0,
      input.notes?.trim() || null,
      user.id,
      now,
    );
    logBookingEvent(db, {
      bookingId,
      actorId: user.id,
      kind: "return_submitted",
      summary: `Return submitted. Final condition: ${input.condition}. Awaiting owner confirmation.`,
      metadata: { condition: input.condition, accessoriesOk: input.accessoriesOk },
    });
    logAudit(db, {
      organizationId: resource.organization_id,
      actorId: user.id,
      action: "booking.return_submitted",
      entityType: "booking",
      entityId: bookingId,
      summary: `Returned ${resource.name} with final condition ${input.condition}.`,
    });
    notifyResourceStaff(db, {
      organizationId: resource.organization_id,
      resourceOwnerId: resource.owner_id,
      actorId: user.id,
      kind: "return_submitted",
      title: `Return awaiting review · ${resource.name}`,
      body: `${user.fullName} submitted the return. Final condition: ${input.condition}. Confirm the hand-back to close custody.`,
      href: `/owner/custody`,
    });
  }).immediate();
}

export function confirmReturn(
  db: Db,
  user: SessionUser,
  bookingId: string,
  note: string,
  now = nowIso(),
): void {
  const booking = getBookingRow(db, bookingId);
  if (!booking) throw new DomainError("NOT_FOUND", "Booking not found.");
  const resource = getResourceById(db, booking.resource_id);
  if (!resource) throw new DomainError("NOT_FOUND", "Resource not found.");

  const membership = user.memberships.find((m) => m.organizationId === resource.organization_id);
  const canManage = Boolean(
    membership &&
      membership.status === "active" &&
      (membership.role === "manager" ||
        membership.role === "admin" ||
        (membership.role === "owner" && resource.owner_id === user.id)),
  );
  if (!canManage) throw new DomainError("FORBIDDEN", "Only an authorized reviewer can confirm returns.");
  if (booking.borrower_id === user.id) {
    throw new DomainError("SELF_APPROVAL", "You cannot confirm your own return.");
  }
  assertTransition(booking.status, "completed");

  db.transaction(() => {
    db.prepare(
      "UPDATE bookings SET status = 'completed', completed_at = ?, updated_at = ? WHERE id = ?",
    ).run(now, now, bookingId);
    logBookingEvent(db, {
      bookingId,
      actorId: user.id,
      kind: "return_confirmed",
      summary: `Owner confirmed the return. Custody closed.${note.trim() ? ` Note: ${note.trim()}` : ""}`,
      metadata: { note: note.trim() || null },
    });
    logAudit(db, {
      organizationId: resource.organization_id,
      actorId: user.id,
      action: "booking.return_confirmed",
      entityType: "booking",
      entityId: bookingId,
      summary: `Confirmed return of ${resource.name}; custody closed.`,
      metadata: { note: note.trim() || null },
    });
    pushNotification(db, {
      userId: booking.borrower_id,
      kind: "return_confirmed",
      title: `Return confirmed · ${resource.name}`,
      body: `${user.fullName} confirmed the return. Your custody record is complete.`,
      href: `/bookings/${bookingId}`,
    });
  }).immediate();
}

export interface BookingListItem extends BookingWithContext {
  isOverdue: boolean;
  waitlist?: WaitlistInfo;
}

function mapListItems(db: Db, rows: BookingRow[]): BookingListItem[] {
  const now = nowIso();
  return rows.map((row) => ({
    ...hydrateBooking(db, row),
    isOverdue: isOverdue(row, now),
    waitlist: row.status === "waitlisted" ? getBookingWaitlist(db, row.id) : undefined,
  }));
}

export function listBookingsForBorrower(db: Db, userId: string): BookingListItem[] {
  const rows = db
    .prepare(
      `SELECT * FROM bookings WHERE borrower_id = ?
       ORDER BY CASE status
         WHEN 'checked_in' THEN 0 WHEN 'approved' THEN 1 WHEN 'pending' THEN 2
         WHEN 'waitlisted' THEN 3 WHEN 'return_submitted' THEN 4 ELSE 5 END,
         starts_at ASC`,
    )
    .all(userId) as BookingRow[];
  return mapListItems(db, rows);
}

export function listBookingsForManager(
  db: Db,
  user: SessionUser,
  organizationId: string,
): BookingListItem[] {
  const membership = user.memberships.find((m) => m.organizationId === organizationId);
  if (!membership || membership.status !== "active") return [];
  const rows =
    membership.role === "owner"
      ? (db
          .prepare(
            `SELECT b.* FROM bookings b
             JOIN resources r ON r.id = b.resource_id
             WHERE r.owner_id = ?
             ORDER BY b.created_at DESC`,
          )
          .all(user.id) as BookingRow[])
      : (db
          .prepare(
            `SELECT * FROM bookings WHERE organization_id = ? ORDER BY created_at DESC`,
          )
          .all(organizationId) as BookingRow[]);
  return mapListItems(db, rows);
}

export function listReviewQueue(
  db: Db,
  user: SessionUser,
  organizationId: string,
): BookingListItem[] {
  return listBookingsForManager(db, user, organizationId).filter((booking) =>
    ["pending", "waitlisted"].includes(booking.status),
  );
}

export function listCustodyQueue(
  db: Db,
  user: SessionUser,
  organizationId: string,
): BookingListItem[] {
  return listBookingsForManager(db, user, organizationId).filter((booking) =>
    ["approved", "checked_in", "return_submitted"].includes(booking.status),
  );
}

export function getIncidentRow(db: Db, incidentId: string): IncidentRow | null {
  return (
    (db.prepare("SELECT * FROM incidents WHERE id = ?").get(incidentId) as IncidentRow | undefined) ??
    null
  );
}

export function getUserProfile(db: Db, userId: string): ProfileRow | null {
  return (
    (db.prepare("SELECT * FROM profiles WHERE id = ?").get(userId) as ProfileRow | undefined) ?? null
  );
}

export const bookingStatusBlocks = BLOCKING_STATUSES;
