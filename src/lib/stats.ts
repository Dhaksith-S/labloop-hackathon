import type { Db } from "./db";
import type { SessionUser } from "./db-types";

export interface CountRow {
  label: string;
  value: number;
}

export function countOrgResources(db: Db, organizationId: string): {
  total: number;
  active: number;
  paused: number;
  archived: number;
} {
  const rows = db
    .prepare(
      `SELECT status, COUNT(*) AS count FROM resources WHERE organization_id = ? GROUP BY status`,
    )
    .all(organizationId) as Array<{ status: string; count: number }>;
  const map = new Map(rows.map((row) => [row.status, row.count]));
  const active = map.get("active") ?? 0;
  const paused = map.get("paused") ?? 0;
  const archived = map.get("archived") ?? 0;
  return { total: active + paused + archived, active, paused, archived };
}

export function countOrgBookings(db: Db, organizationId: string): Record<string, number> {
  const rows = db
    .prepare(
      "SELECT status, COUNT(*) AS count FROM bookings WHERE organization_id = ? GROUP BY status",
    )
    .all(organizationId) as Array<{ status: string; count: number }>;
  return Object.fromEntries(rows.map((row) => [row.status, row.count]));
}

export function countOpenIncidents(db: Db, organizationId: string): number {
  return (
    db
      .prepare(
        `SELECT COUNT(*) AS count FROM incidents i
         JOIN resources r ON r.id = i.resource_id
         WHERE r.organization_id = ? AND i.status IN ('open','reviewing')`,
      )
      .get(organizationId) as { count: number }
  ).count;
}

export function countOrgMembers(db: Db, organizationId: string): number {
  return (
    db
      .prepare(
        "SELECT COUNT(*) AS count FROM organization_members WHERE organization_id = ? AND status = 'active'",
      )
      .get(organizationId) as { count: number }
  ).count;
}

export function countRoleMembers(db: Db, organizationId: string): Array<{ role: string; count: number }> {
  return db
    .prepare(
      `SELECT role, COUNT(*) AS count FROM organization_members
       WHERE organization_id = ? AND status = 'active' GROUP BY role`,
    )
    .all(organizationId) as Array<{ role: string; count: number }>;
}

/**
 * Real, database-backed overview for the basic organization dashboard.
 * No fabricated metrics.
 */
export function getOrganizationOverview(
  db: Db,
  user: SessionUser,
  organizationId: string,
): {
  resources: ReturnType<typeof countOrgResources>;
  bookings: Record<string, number>;
  members: number;
  roles: Array<{ role: string; count: number }>;
  openIncidents: number;
  upcomingCustody: number;
  recentAudit: Array<{
    id: string;
    action: string;
    summary: string;
    created_at: string;
    actor_name: string | null;
  }>;
} {
  const membership = user.memberships.find((m) => m.organizationId === organizationId);
  if (!membership || membership.status !== "active" ||
      !["manager", "admin"].includes(membership.role)) {
    throw new Error("FORBIDDEN");
  }
  const upcomingCustody = (
    db
      .prepare(
        `SELECT COUNT(*) AS count FROM bookings
         WHERE organization_id = ? AND status IN ('approved','checked_in','return_submitted')`,
      )
      .get(organizationId) as { count: number }
  ).count;
  const recentAudit = db
    .prepare(
      `SELECT a.id, a.action, a.summary, a.created_at, p.full_name AS actor_name
       FROM audit_events a LEFT JOIN profiles p ON p.id = a.actor_id
       WHERE a.organization_id = ? ORDER BY a.created_at DESC LIMIT 12`,
    )
    .all(organizationId) as Array<{
    id: string;
    action: string;
    summary: string;
    created_at: string;
    actor_name: string | null;
  }>;
  return {
    resources: countOrgResources(db, organizationId),
    bookings: countOrgBookings(db, organizationId),
    members: countOrgMembers(db, organizationId),
    roles: countRoleMembers(db, organizationId),
    openIncidents: countOpenIncidents(db, organizationId),
    upcomingCustody,
    recentAudit,
  };
}
