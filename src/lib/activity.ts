import type { Db } from "./db";
import type { SessionUser } from "./db-types";

export interface ActivityItem {
  id: string;
  source: "booking" | "incident" | "audit";
  kind: string;
  title: string;
  detail: string;
  href: string | null;
  createdAt: string;
  actorName: string | null;
  resourceName?: string | null;
}

export function getPersonalActivity(db: Db, userId: string, limit = 40): ActivityItem[] {
  const bookingEvents = db
    .prepare(
      `SELECT e.id, e.kind, e.summary, e.created_at, e.booking_id,
              p.full_name AS actor_name, r.name AS resource_name
       FROM booking_events e
       JOIN bookings b ON b.id = e.booking_id
       JOIN resources r ON r.id = b.resource_id
       LEFT JOIN profiles p ON p.id = e.actor_id
       WHERE b.borrower_id = ?
       ORDER BY e.created_at DESC LIMIT ?`,
    )
    .all(userId, limit) as Array<{
    id: string;
    kind: string;
    summary: string;
    created_at: string;
    booking_id: string;
    actor_name: string | null;
    resource_name: string;
  }>;

  const incidents = db
    .prepare(
      `SELECT i.id, i.type, i.description, i.created_at, i.status, i.booking_id,
              r.name AS resource_name
       FROM incidents i
       JOIN resources r ON r.id = i.resource_id
       WHERE i.reporter_id = ?
       ORDER BY i.created_at DESC LIMIT ?`,
    )
    .all(userId, limit) as Array<{
    id: string;
    type: string;
    description: string;
    created_at: string;
    status: string;
    booking_id: string | null;
    resource_name: string;
  }>;

  const items: ActivityItem[] = [
    ...bookingEvents.map((event) => ({
      id: `event-${event.id}`,
      source: "booking" as const,
      kind: event.kind,
      title: `${event.resource_name} · ${event.kind.replaceAll("_", " ")}`,
      detail: event.summary,
      href: `/bookings/${event.booking_id}`,
      createdAt: event.created_at,
      actorName: event.actor_name,
      resourceName: event.resource_name,
    })),
    ...incidents.map((incident) => ({
      id: `incident-${incident.id}`,
      source: "incident" as const,
      kind: `incident_${incident.status}`,
      title: `Incident · ${incident.resource_name}`,
      detail: incident.description,
      href: incident.booking_id ? `/bookings/${incident.booking_id}` : "/activity",
      createdAt: incident.created_at,
      actorName: null,
      resourceName: incident.resource_name,
    })),
  ];

  return items
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

export function getManagedActivity(
  db: Db,
  user: SessionUser,
  organizationId: string,
  limit = 60,
): ActivityItem[] {
  const membership = user.memberships.find((m) => m.organizationId === organizationId);
  if (!membership || membership.status !== "active" ||
      !["owner", "manager", "admin"].includes(membership.role)) return [];
  const isManager = membership.role === "manager" || membership.role === "admin";
  const rows = isManager
    ? (db
        .prepare(
          `SELECT a.id, a.action, a.summary, a.created_at, a.entity_type, a.entity_id,
                  p.full_name AS actor_name,
                  COALESCE(r.name, b.resource_id) AS resource_name
           FROM audit_events a
           LEFT JOIN profiles p ON p.id = a.actor_id
           LEFT JOIN resources r ON a.entity_type = 'resource' AND r.id = a.entity_id
           LEFT JOIN bookings b ON a.entity_type = 'booking' AND b.id = a.entity_id
           WHERE a.organization_id = ?
           ORDER BY a.created_at DESC LIMIT ?`,
        )
        .all(organizationId, limit) as Array<{
        id: string;
        action: string;
        summary: string;
        created_at: string;
        entity_type: string;
        entity_id: string;
        actor_name: string | null;
        resource_name: string | null;
      }>)
    : (db
        .prepare(
          `SELECT a.id, a.action, a.summary, a.created_at, a.entity_type, a.entity_id,
                  p.full_name AS actor_name, r.name AS resource_name
           FROM audit_events a
           LEFT JOIN profiles p ON p.id = a.actor_id
           LEFT JOIN resources r ON a.entity_type = 'resource' AND r.id = a.entity_id
           LEFT JOIN bookings b ON a.entity_type = 'booking' AND b.id = a.entity_id
           LEFT JOIN resources br ON br.id = b.resource_id
           WHERE a.organization_id = ?
             AND (a.actor_id = ? OR (a.entity_type = 'resource' AND a.entity_id IN
                    (SELECT id FROM resources WHERE owner_id = ?))
                  OR (a.entity_type = 'booking' AND a.entity_id IN
                    (SELECT b2.id FROM bookings b2 JOIN resources r2 ON r2.id = b2.resource_id
                     WHERE r2.owner_id = ?)))
           ORDER BY a.created_at DESC LIMIT ?`,
        )
        .all(organizationId, user.id, user.id, user.id, limit) as Array<{
        id: string;
        action: string;
        summary: string;
        created_at: string;
        entity_type: string;
        entity_id: string;
        actor_name: string | null;
        resource_name: string | null;
      }>);

  return rows.map((row) => ({
    id: `audit-${row.id}`,
    source: "audit" as const,
    kind: row.action,
    title: row.action.replaceAll(".", " · ").replaceAll("_", " "),
    detail: row.summary,
    href:
      row.entity_type === "booking"
        ? `/bookings/${row.entity_id}`
        : row.entity_type === "resource"
          ? `/resources/${row.entity_id}`
          : null,
    createdAt: row.created_at,
    actorName: row.actor_name,
    resourceName: row.resource_name,
  }));
}
