import { randomUUID } from "node:crypto";
import type { Db } from "./db";
import { nowIso } from "./time";

export type AuditEntityType =
  | "resource"
  | "booking"
  | "incident"
  | "qualification"
  | "membership"
  | "organization";

export function logBookingEvent(
  db: Db,
  input: {
    bookingId: string;
    actorId: string | null;
    kind: string;
    summary: string;
    metadata?: Record<string, unknown>;
    createdAt?: string;
  },
): void {
  db.prepare(
    `INSERT INTO booking_events (id, booking_id, actor_id, kind, summary, metadata_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    randomUUID(),
    input.bookingId,
    input.actorId,
    input.kind,
    input.summary,
    input.metadata ? JSON.stringify(input.metadata) : null,
    input.createdAt ?? nowIso(),
  );
}

export function logAudit(
  db: Db,
  input: {
    organizationId: string;
    actorId: string | null;
    action: string;
    entityType: AuditEntityType;
    entityId: string;
    summary: string;
    metadata?: Record<string, unknown>;
    createdAt?: string;
  },
): void {
  db.prepare(
    `INSERT INTO audit_events
      (id, organization_id, actor_id, action, entity_type, entity_id, summary, metadata_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    randomUUID(),
    input.organizationId,
    input.actorId,
    input.action,
    input.entityType,
    input.entityId,
    input.summary,
    input.metadata ? JSON.stringify(input.metadata) : null,
    input.createdAt ?? nowIso(),
  );
}

export function pushNotification(
  db: Db,
  input: {
    userId: string;
    kind: string;
    title: string;
    body: string;
    href?: string | null;
    createdAt?: string;
  },
): void {
  db.prepare(
    `INSERT INTO notifications (id, user_id, kind, title, body, href, read_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, NULL, ?)`,
  ).run(
    randomUUID(),
    input.userId,
    input.kind,
    input.title,
    input.body,
    input.href ?? null,
    input.createdAt ?? nowIso(),
  );
}

/**
 * Notify the resource owner plus active managers/admins of the organization.
 * Deduplicated, and never notifies the actor who caused the event.
 */
export function notifyResourceStaff(
  db: Db,
  input: {
    organizationId: string;
    resourceOwnerId: string;
    actorId: string | null;
    kind: string;
    title: string;
    body: string;
    href?: string | null;
  },
): string[] {
  const rows = db
    .prepare(
      `SELECT DISTINCT m.user_id
       FROM organization_members m
       WHERE m.organization_id = ?
         AND m.status = 'active'
         AND m.role IN ('manager', 'admin')`,
    )
    .all(input.organizationId) as Array<{ user_id: string }>;

  const recipients = new Set<string>([input.resourceOwnerId, ...rows.map((r) => r.user_id)]);
  if (input.actorId) recipients.delete(input.actorId);

  for (const userId of recipients) {
    pushNotification(db, {
      userId,
      kind: input.kind,
      title: input.title,
      body: input.body,
      href: input.href,
    });
  }
  return [...recipients];
}
