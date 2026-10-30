import { randomUUID } from "node:crypto";
import type { Db } from "./db";
import type {
  BookingRow,
  IncidentRow,
  ProfileRow,
  ResourceWithRelations,
  SessionUser,
} from "./db-types";
import type { IncidentSeverity, IncidentType } from "./domain";
import { logAudit, logBookingEvent, notifyResourceStaff, pushNotification } from "./events";
import { getResourceById } from "./resources";
import { DomainError } from "./state-machine";
import { nowIso } from "./time";

export interface IncidentListItem extends IncidentRow {
  resource: ResourceWithRelations;
  reporterName: string;
  reporterEmail: string;
  booking?: Pick<BookingRow, "id" | "starts_at" | "ends_at" | "status">;
}

function hydrateIncident(db: Db, row: IncidentRow): IncidentListItem {
  const resource = getResourceById(db, row.resource_id);
  if (!resource) throw new DomainError("NOT_FOUND", "Resource not found.");
  const reporter = db
    .prepare("SELECT id, full_name, email FROM profiles WHERE id = ?")
    .get(row.reporter_id) as Pick<ProfileRow, "id" | "full_name" | "email"> | undefined;
  const booking = row.booking_id
    ? (db
        .prepare("SELECT id, starts_at, ends_at, status FROM bookings WHERE id = ?")
        .get(row.booking_id) as IncidentListItem["booking"])
    : undefined;
  return {
    ...row,
    resource,
    reporterName: reporter?.full_name ?? "Unknown member",
    reporterEmail: reporter?.email ?? "—",
    booking,
  };
}

function canManageResourceIncidents(
  db: Db,
  user: SessionUser,
  resource: ResourceWithRelations,
): boolean {
  const membership = user.memberships.find((m) => m.organizationId === resource.organization_id);
  return Boolean(
    membership &&
      membership.status === "active" &&
      (membership.role === "manager" ||
        membership.role === "admin" ||
        (membership.role === "owner" && resource.owner_id === user.id)),
  );
}

export function listIncidentsForManager(
  db: Db,
  user: SessionUser,
  organizationId: string,
  scope: "all" | "open" = "all",
): IncidentListItem[] {
  const membership = user.memberships.find((m) => m.organizationId === organizationId);
  if (!membership || membership.status !== "active") return [];
  const openClause = scope === "open" ? "AND i.status IN ('open','reviewing')" : "";
  const rows =
    membership.role === "owner"
      ? (db
          .prepare(
            `SELECT i.* FROM incidents i
             JOIN resources r ON r.id = i.resource_id
             WHERE r.owner_id = ? ${openClause}
             ORDER BY CASE i.status WHEN 'open' THEN 0 WHEN 'reviewing' THEN 1 ELSE 2 END,
                      i.created_at DESC`,
          )
          .all(user.id) as IncidentRow[])
      : (db
          .prepare(
            `SELECT i.* FROM incidents i
             JOIN resources r ON r.id = i.resource_id
             WHERE r.organization_id = ? ${openClause}
             ORDER BY CASE i.status WHEN 'open' THEN 0 WHEN 'reviewing' THEN 1 ELSE 2 END,
                      i.created_at DESC`,
          )
          .all(organizationId) as IncidentRow[]);
  return rows.map((row) => hydrateIncident(db, row));
}

export function listIncidentsForBorrower(db: Db, userId: string): IncidentListItem[] {
  const rows = db
    .prepare(
      `SELECT DISTINCT i.* FROM incidents i
       LEFT JOIN bookings b ON b.id = i.booking_id
       WHERE i.reporter_id = ? OR b.borrower_id = ?
       ORDER BY i.created_at DESC`,
    )
    .all(userId, userId) as IncidentRow[];
  return rows.map((row) => hydrateIncident(db, row));
}

export function getIncidentDetail(
  db: Db,
  user: SessionUser,
  incidentId: string,
): IncidentListItem {
  const row = db.prepare("SELECT * FROM incidents WHERE id = ?").get(incidentId) as
    | IncidentRow
    | undefined;
  if (!row) throw new DomainError("NOT_FOUND", "Incident not found.");
  const item = hydrateIncident(db, row);
  const isReporter = row.reporter_id === user.id;
  const booking = row.booking_id
    ? (db.prepare("SELECT borrower_id FROM bookings WHERE id = ?").get(row.booking_id) as
        | { borrower_id: string }
        | undefined)
    : undefined;
  const isBorrower = booking?.borrower_id === user.id;
  if (!isReporter && !isBorrower && !canManageResourceIncidents(db, user, item.resource)) {
    throw new DomainError("FORBIDDEN", "You cannot view this incident.");
  }
  return item;
}

export interface CreateIncidentInput {
  resourceId: string;
  bookingId?: string | null;
  type: IncidentType;
  severity: IncidentSeverity;
  description: string;
}

export function createIncident(
  db: Db,
  user: SessionUser,
  input: CreateIncidentInput,
): string {
  if (input.description.trim().length < 15) {
    throw new DomainError("DESCRIPTION_REQUIRED", "Describe the incident in at least 15 characters.");
  }
  const resource = getResourceById(db, input.resourceId);
  if (!resource) throw new DomainError("NOT_FOUND", "Resource not found.");
  const membership = user.memberships.find((m) => m.organizationId === resource.organization_id);
  if (!membership || membership.status !== "active") {
    throw new DomainError("FORBIDDEN", "Active membership is required to report an incident.");
  }

  let booking: BookingRow | null = null;
  if (input.bookingId) {
    booking = (db.prepare("SELECT * FROM bookings WHERE id = ?").get(input.bookingId) as
      | BookingRow
      | undefined) ?? null;
    if (!booking) throw new DomainError("NOT_FOUND", "Booking not found.");
    if (booking.resource_id !== input.resourceId) {
      throw new DomainError("INVALID_INCIDENT", "Booking does not belong to this resource.");
    }
    const isBorrower = booking.borrower_id === user.id;
    if (!isBorrower && !canManageResourceIncidents(db, user, resource)) {
      throw new DomainError("FORBIDDEN", "Only participants can attach an incident to this booking.");
    }
  }

  const id = randomUUID();
  const timestamp = nowIso();

  db.transaction(() => {
    db.prepare(
      `INSERT INTO incidents
        (id, booking_id, resource_id, reporter_id, type, severity, description, status,
         resolution_notes, resolved_by, resolved_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'open', NULL, NULL, NULL, ?, ?)`,
    ).run(
      id,
      booking?.id ?? null,
      resource.id,
      user.id,
      input.type,
      input.severity,
      input.description.trim(),
      timestamp,
      timestamp,
    );

    if (booking) {
      logBookingEvent(db, {
        bookingId: booking.id,
        actorId: user.id,
        kind: "incident_opened",
        summary: `Incident reported (${input.type}, ${input.severity} severity). Human review required; no penalty applied automatically.`,
        metadata: { incidentId: id },
      });
    }
    logAudit(db, {
      organizationId: resource.organization_id,
      actorId: user.id,
      action: "incident.reported",
      entityType: "incident",
      entityId: id,
      summary: `Reported ${input.type} incident on ${resource.name}.`,
      metadata: { severity: input.severity, type: input.type },
    });
    notifyResourceStaff(db, {
      organizationId: resource.organization_id,
      resourceOwnerId: resource.owner_id,
      actorId: user.id,
      kind: "incident_opened",
      title: `Incident needs review · ${resource.name}`,
      body: `${user.fullName} reported ${input.type.replaceAll("_", " ")} (${input.severity} severity). Review before any action is taken.`,
      href: "/owner/incidents",
    });
  }).immediate();

  return id;
}

export function reviewIncident(
  db: Db,
  user: SessionUser,
  incidentId: string,
  input: {
    status: "open" | "reviewing" | "resolved" | "dismissed";
    resolutionNotes: string;
  },
): void {
  const incident = db.prepare("SELECT * FROM incidents WHERE id = ?").get(incidentId) as
    | IncidentRow
    | undefined;
  if (!incident) throw new DomainError("NOT_FOUND", "Incident not found.");
  const resource = getResourceById(db, incident.resource_id);
  if (!resource) throw new DomainError("NOT_FOUND", "Resource not found.");
  if (!canManageResourceIncidents(db, user, resource)) {
    throw new DomainError("FORBIDDEN", "Only an authorized reviewer can update this incident.");
  }
  if (incident.reporter_id === user.id) {
    throw new DomainError(
      "SELF_REVIEW",
      "You cannot review an incident you reported. Ask another manager.",
    );
  }
  if (["resolved", "dismissed"].includes(input.status) && input.resolutionNotes.trim().length < 10) {
    throw new DomainError(
      "RESOLUTION_REQUIRED",
      "Add a human-written resolution note of at least 10 characters.",
    );
  }

  const timestamp = nowIso();
  let booking: BookingRow | null = null;
  if (incident.booking_id) {
    booking = (db.prepare("SELECT * FROM bookings WHERE id = ?").get(incident.booking_id) as
      | BookingRow
      | undefined) ?? null;
  }

  db.transaction(() => {
    db.prepare(
      `UPDATE incidents SET status = ?, resolution_notes = ?, resolved_by = ?, resolved_at = ?,
       updated_at = ? WHERE id = ?`,
    ).run(
      input.status,
      input.resolutionNotes.trim() || incident.resolution_notes,
      ["resolved", "dismissed"].includes(input.status) ? user.id : null,
      ["resolved", "dismissed"].includes(input.status) ? timestamp : null,
      timestamp,
      incidentId,
    );

    if (booking) {
      logBookingEvent(db, {
        bookingId: booking.id,
        actorId: user.id,
        kind: "incident_updated",
        summary:
          input.status === "resolved"
            ? `Incident resolved by ${user.fullName}. ${input.resolutionNotes.trim()}`
            : input.status === "dismissed"
              ? `Incident dismissed by ${user.fullName}. ${input.resolutionNotes.trim()}`
              : `Incident moved to ${input.status} by ${user.fullName}.`,
        metadata: { incidentId, status: input.status },
      });
    }
    logAudit(db, {
      organizationId: resource.organization_id,
      actorId: user.id,
      action: `incident.${input.status}`,
      entityType: "incident",
      entityId: incidentId,
      summary: `Incident ${input.status} with human-written notes.`,
      metadata: { notes: input.resolutionNotes.trim() },
    });

    pushNotification(db, {
      userId: incident.reporter_id,
      kind: "incident_updated",
      title: `Incident ${input.status} · ${resource.name}`,
      body: input.resolutionNotes.trim()
        ? `${user.fullName}: ${input.resolutionNotes.trim()}`
        : `${user.fullName} moved the incident to ${input.status}.`,
      href: `/bookings/${incident.booking_id ?? ""}`,
    });
    if (booking && booking.borrower_id !== incident.reporter_id) {
      pushNotification(db, {
        userId: booking.borrower_id,
        kind: "incident_updated",
        title: `Incident ${input.status} · ${resource.name}`,
        body: `A human reviewer updated an incident on your booking.`,
        href: `/bookings/${booking.id}`,
      });
    }
  }).immediate();
}
