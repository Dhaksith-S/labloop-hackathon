import { randomUUID } from "node:crypto";
import type { Db } from "./db";
import type {
  AvailabilityRow,
  BlackoutRow,
  ProfileRow,
  RequirementRow,
  ResourceRow,
  ResourceWithRelations,
  SessionUser,
} from "./db-types";
import type { ResourceCategory, Role } from "./domain";
import { logAudit } from "./events";
import { DomainError } from "./state-machine";
import { nowIso } from "./time";

export interface ResourceFilters {
  q?: string;
  category?: ResourceCategory | "all";
}

interface ResourceJoinRow extends ResourceRow {
  owner_full_name: string;
  owner_headline: string | null;
  organization_name: string;
  organization_slug: string;
}

function mapResource(row: ResourceJoinRow): Omit<ResourceWithRelations, "requirements" | "availability" | "blackouts"> {
  return {
    id: row.id,
    organization_id: row.organization_id,
    owner_id: row.owner_id,
    name: row.name,
    category: row.category,
    description: row.description,
    location: row.location,
    status: row.status,
    max_duration_hours: row.max_duration_hours,
    fair_use_limit: row.fair_use_limit,
    usage_rules: row.usage_rules,
    condition_summary: row.condition_summary,
    eligibility_note: row.eligibility_note,
    created_at: row.created_at,
    updated_at: row.updated_at,
    owner: {
      id: row.owner_id,
      full_name: row.owner_full_name,
      headline: row.owner_headline,
    },
    organization: {
      id: row.organization_id,
      name: row.organization_name,
      slug: row.organization_slug,
    },
  };
}

function attachRelations(
  db: Db,
  base: Array<Omit<ResourceWithRelations, "requirements" | "availability" | "blackouts">>,
): ResourceWithRelations[] {
  if (base.length === 0) return [];
  const ids = base.map((resource) => resource.id);
  const placeholders = ids.map(() => "?").join(",");
  const requirements = db
    .prepare(`SELECT * FROM resource_requirements WHERE resource_id IN (${placeholders}) ORDER BY created_at`)
    .all(...ids) as RequirementRow[];
  const availability = db
    .prepare(
      `SELECT * FROM availability_windows WHERE resource_id IN (${placeholders}) ORDER BY weekday, start_minute`,
    )
    .all(...ids) as AvailabilityRow[];
  const blackouts = db
    .prepare(`SELECT * FROM resource_blackouts WHERE resource_id IN (${placeholders}) ORDER BY starts_at`)
    .all(...ids) as BlackoutRow[];

  const requirementsBy = new Map<string, RequirementRow[]>();
  const availabilityBy = new Map<string, AvailabilityRow[]>();
  const blackoutsBy = new Map<string, BlackoutRow[]>();
  for (const row of requirements) {
    requirementsBy.set(row.resource_id, [...(requirementsBy.get(row.resource_id) ?? []), row]);
  }
  for (const row of availability) {
    availabilityBy.set(row.resource_id, [...(availabilityBy.get(row.resource_id) ?? []), row]);
  }
  for (const row of blackouts) {
    blackoutsBy.set(row.resource_id, [...(blackoutsBy.get(row.resource_id) ?? []), row]);
  }

  return base.map((resource) => ({
    ...resource,
    requirements: requirementsBy.get(resource.id) ?? [],
    availability: availabilityBy.get(resource.id) ?? [],
    blackouts: blackoutsBy.get(resource.id) ?? [],
  }));
}

const BASE_SELECT = `
  SELECT r.*, p.full_name AS owner_full_name, p.headline AS owner_headline,
         o.name AS organization_name, o.slug AS organization_slug
  FROM resources r
  JOIN profiles p ON p.id = r.owner_id
  JOIN organizations o ON o.id = r.organization_id
`;

export function searchPublicResources(db: Db, filters: ResourceFilters = {}): ResourceWithRelations[] {
  const clauses = ["r.status = 'active'"];
  const params: unknown[] = [];
  if (filters.q?.trim()) {
    const q = `%${filters.q.trim()}%`;
    clauses.push("(r.name LIKE ? OR r.description LIKE ? OR r.location LIKE ?)");
    params.push(q, q, q);
  }
  if (filters.category && filters.category !== "all") {
    clauses.push("r.category = ?");
    params.push(filters.category);
  }
  const rows = db
    .prepare(`${BASE_SELECT} WHERE ${clauses.join(" AND ")} ORDER BY r.name COLLATE NOCASE`)
    .all(...params) as ResourceJoinRow[];
  return attachRelations(db, rows.map(mapResource));
}

export function getResourceById(db: Db, resourceId: string): ResourceWithRelations | null {
  const row = db.prepare(`${BASE_SELECT} WHERE r.id = ?`).get(resourceId) as
    | ResourceJoinRow
    | undefined;
  if (!row) return null;
  return attachRelations(db, [mapResource(row)])[0] ?? null;
}

export function getResourcesForOrganization(db: Db, organizationId: string): ResourceWithRelations[] {
  const rows = db
    .prepare(`${BASE_SELECT} WHERE r.organization_id = ? ORDER BY r.status, r.name COLLATE NOCASE`)
    .all(organizationId) as ResourceJoinRow[];
  return attachRelations(db, rows.map(mapResource));
}

export function getResourcesOwnedBy(db: Db, ownerId: string): ResourceWithRelations[] {
  const rows = db
    .prepare(`${BASE_SELECT} WHERE r.owner_id = ? ORDER BY r.status, r.name COLLATE NOCASE`)
    .all(ownerId) as ResourceJoinRow[];
  return attachRelations(db, rows.map(mapResource));
}

export function getResourcesForManager(
  db: Db,
  user: SessionUser,
  organizationId: string,
): ResourceWithRelations[] {
  const membership = user.memberships.find((m) => m.organizationId === organizationId);
  if (!membership || membership.status !== "active") return [];
  if (membership.role === "manager" || membership.role === "admin") {
    return getResourcesForOrganization(db, organizationId);
  }
  if (membership.role === "owner") {
    return getResourcesOwnedBy(db, user.id);
  }
  return [];
}

export interface ManageAccess {
  resource: ResourceRow;
  role: Role;
}

export function assertCanManageResource(
  db: Db,
  user: SessionUser,
  resourceId: string,
): ManageAccess {
  const resource = db.prepare("SELECT * FROM resources WHERE id = ?").get(resourceId) as
    | ResourceRow
    | undefined;
  if (!resource) throw new DomainError("RESOURCE_NOT_FOUND", "Resource not found.");
  const membership = user.memberships.find((m) => m.organizationId === resource.organization_id);
  if (!membership || membership.status !== "active") {
    throw new DomainError("FORBIDDEN", "You do not have access to this organization.");
  }
  const canManage =
    membership.role === "manager" ||
    membership.role === "admin" ||
    (membership.role === "owner" && resource.owner_id === user.id);
  if (!canManage) {
    throw new DomainError("FORBIDDEN", "Only the resource owner or an authorized manager can do this.");
  }
  return { resource, role: membership.role };
}

export interface ResourceInput {
  name: string;
  category: ResourceCategory;
  description: string;
  location: string;
  maxDurationHours: number;
  fairUseLimit: number;
  usageRules: string;
  conditionSummary: string;
  eligibilityNote?: string | null;
  status?: "active" | "paused" | "archived";
}

export interface RequirementInput {
  kind: "membership" | "qualification" | "training";
  label: string;
  description?: string | null;
  isRequired: boolean;
}

export interface AvailabilityInput {
  weekdays: number[];
  startMinute: number;
  endMinute: number;
}

export interface CreateResourceInput extends ResourceInput {
  requirements?: RequirementInput[];
  availability?: AvailabilityInput[];
}

export function createResource(
  db: Db,
  user: SessionUser,
  organizationId: string,
  input: CreateResourceInput,
): ResourceWithRelations {
  const membership = user.memberships.find((m) => m.organizationId === organizationId);
  if (
    !membership ||
    membership.status !== "active" ||
    !["owner", "manager", "admin"].includes(membership.role)
  ) {
    throw new DomainError(
      "FORBIDDEN",
      "Only verified resource owners and managers can list resources.",
    );
  }

  const id = randomUUID();
  const timestamp = nowIso();

  const run = db.transaction(() => {
    db.prepare(
      `INSERT INTO resources
        (id, organization_id, owner_id, name, category, description, location, status,
         max_duration_hours, fair_use_limit, usage_rules, condition_summary, eligibility_note,
         created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      organizationId,
      user.id,
      input.name.trim(),
      input.category,
      input.description.trim(),
      input.location.trim(),
      input.status ?? "active",
      input.maxDurationHours,
      input.fairUseLimit,
      input.usageRules.trim(),
      input.conditionSummary.trim(),
      input.eligibilityNote?.trim() || null,
      timestamp,
      timestamp,
    );

    const insertRequirement = db.prepare(
      `INSERT INTO resource_requirements (id, resource_id, kind, label, description, is_required, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const requirement of input.requirements ?? []) {
      if (!requirement.label.trim()) continue;
      insertRequirement.run(
        randomUUID(),
        id,
        requirement.kind,
        requirement.label.trim(),
        requirement.description?.trim() || null,
        requirement.isRequired ? 1 : 0,
        timestamp,
      );
    }

    const insertWindow = db.prepare(
      `INSERT INTO availability_windows (id, resource_id, weekday, start_minute, end_minute, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    const windows =
      input.availability && input.availability.length > 0
        ? input.availability
        : [{ weekdays: [1, 2, 3, 4, 5], startMinute: 9 * 60, endMinute: 17 * 60 }];
    const seen = new Set<string>();
    for (const window of windows) {
      for (const weekday of window.weekdays) {
        const key = `${weekday}-${window.startMinute}-${window.endMinute}`;
        if (seen.has(key)) continue;
        seen.add(key);
        insertWindow.run(
          randomUUID(),
          id,
          weekday,
          window.startMinute,
          window.endMinute,
          timestamp,
        );
      }
    }

    logAudit(db, {
      organizationId,
      actorId: user.id,
      action: "resource.created",
      entityType: "resource",
      entityId: id,
      summary: `Listed ${input.name.trim()} for shared access.`,
      metadata: {
        category: input.category,
        requirements: input.requirements?.map((requirement) => requirement.label) ?? [],
      },
    });
  });

  run.immediate();
  return getResourceById(db, id)!;
}

export function updateResource(
  db: Db,
  user: SessionUser,
  resourceId: string,
  input: ResourceInput,
): void {
  const { resource } = assertCanManageResource(db, user, resourceId);
  if (input.status === "archived") {
    const activeCustody = db
      .prepare(
        `SELECT COUNT(*) AS count FROM bookings
         WHERE resource_id = ? AND status IN ('approved', 'checked_in', 'return_submitted')`,
      )
      .get(resourceId) as { count: number };
    if (activeCustody.count > 0) {
      throw new DomainError(
        "ACTIVE_CUSTODY",
        "This resource has approved or in-use bookings. Resolve them before archiving.",
      );
    }
  }

  db.prepare(
    `UPDATE resources SET
      name = ?, category = ?, description = ?, location = ?, status = ?,
      max_duration_hours = ?, fair_use_limit = ?, usage_rules = ?, condition_summary = ?,
      eligibility_note = ?, updated_at = ?
     WHERE id = ?`,
  ).run(
    input.name.trim(),
    input.category,
    input.description.trim(),
    input.location.trim(),
    input.status ?? resource.status,
    input.maxDurationHours,
    input.fairUseLimit,
    input.usageRules.trim(),
    input.conditionSummary.trim(),
    input.eligibilityNote?.trim() || null,
    nowIso(),
    resourceId,
  );

  logAudit(db, {
    organizationId: resource.organization_id,
    actorId: user.id,
    action: "resource.updated",
    entityType: "resource",
    entityId: resourceId,
    summary: `Updated listing details for ${input.name.trim()}.`,
    metadata: { status: input.status ?? resource.status },
  });
}

export function addRequirement(
  db: Db,
  user: SessionUser,
  resourceId: string,
  input: RequirementInput,
): void {
  const { resource } = assertCanManageResource(db, user, resourceId);
  const id = randomUUID();
  db.prepare(
    `INSERT INTO resource_requirements (id, resource_id, kind, label, description, is_required, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    resourceId,
    input.kind,
    input.label.trim(),
    input.description?.trim() || null,
    input.isRequired ? 1 : 0,
    nowIso(),
  );
  logAudit(db, {
    organizationId: resource.organization_id,
    actorId: user.id,
    action: "resource.requirement_added",
    entityType: "resource",
    entityId: resourceId,
    summary: `Added access requirement: ${input.label.trim()}.`,
  });
}

export function removeRequirement(
  db: Db,
  user: SessionUser,
  resourceId: string,
  requirementId: string,
): void {
  const { resource } = assertCanManageResource(db, user, resourceId);
  const requirement = db
    .prepare("SELECT * FROM resource_requirements WHERE id = ? AND resource_id = ?")
    .get(requirementId, resourceId) as RequirementRow | undefined;
  if (!requirement) throw new DomainError("NOT_FOUND", "Requirement not found.");
  db.prepare("DELETE FROM resource_requirements WHERE id = ?").run(requirementId);
  logAudit(db, {
    organizationId: resource.organization_id,
    actorId: user.id,
    action: "resource.requirement_removed",
    entityType: "resource",
    entityId: resourceId,
    summary: `Removed access requirement: ${requirement.label}.`,
  });
}

export function addAvailabilityWindow(
  db: Db,
  user: SessionUser,
  resourceId: string,
  input: { weekday: number; startMinute: number; endMinute: number },
): void {
  const { resource } = assertCanManageResource(db, user, resourceId);
  if (input.endMinute <= input.startMinute) {
    throw new DomainError("INVALID_WINDOW", "Closing time must be after opening time.");
  }
  const existing = db
    .prepare(
      `SELECT id FROM availability_windows
       WHERE resource_id = ? AND weekday = ? AND start_minute = ? AND end_minute = ?`,
    )
    .get(resourceId, input.weekday, input.startMinute, input.endMinute);
  if (existing) throw new DomainError("DUPLICATE_WINDOW", "That availability window already exists.");
  db.prepare(
    `INSERT INTO availability_windows (id, resource_id, weekday, start_minute, end_minute, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(randomUUID(), resourceId, input.weekday, input.startMinute, input.endMinute, nowIso());
  logAudit(db, {
    organizationId: resource.organization_id,
    actorId: user.id,
    action: "resource.availability_added",
    entityType: "resource",
    entityId: resourceId,
    summary: `Added weekly availability (weekday ${input.weekday}, ${input.startMinute}–${input.endMinute}).`,
  });
}

export function removeAvailabilityWindow(
  db: Db,
  user: SessionUser,
  resourceId: string,
  windowId: string,
): void {
  const { resource } = assertCanManageResource(db, user, resourceId);
  const row = db
    .prepare("SELECT * FROM availability_windows WHERE id = ? AND resource_id = ?")
    .get(windowId, resourceId) as AvailabilityRow | undefined;
  if (!row) throw new DomainError("NOT_FOUND", "Availability window not found.");
  db.prepare("DELETE FROM availability_windows WHERE id = ?").run(windowId);
  logAudit(db, {
    organizationId: resource.organization_id,
    actorId: user.id,
    action: "resource.availability_removed",
    entityType: "resource",
    entityId: resourceId,
    summary: `Removed a weekly availability window.`,
  });
}

export function addBlackout(
  db: Db,
  user: SessionUser,
  resourceId: string,
  input: { startsAt: string; endsAt: string; reason: string },
): void {
  const { resource } = assertCanManageResource(db, user, resourceId);
  if (input.startsAt >= input.endsAt) {
    throw new DomainError("INVALID_WINDOW", "Blackout end must be after its start.");
  }
  db.prepare(
    `INSERT INTO resource_blackouts (id, resource_id, starts_at, ends_at, reason, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(randomUUID(), resourceId, input.startsAt, input.endsAt, input.reason.trim(), nowIso());
  logAudit(db, {
    organizationId: resource.organization_id,
    actorId: user.id,
    action: "resource.blackout_added",
    entityType: "resource",
    entityId: resourceId,
    summary: `Added maintenance blackout: ${input.reason.trim()}.`,
  });
}

export function removeBlackout(
  db: Db,
  user: SessionUser,
  resourceId: string,
  blackoutId: string,
): void {
  const { resource } = assertCanManageResource(db, user, resourceId);
  const row = db
    .prepare("SELECT * FROM resource_blackouts WHERE id = ? AND resource_id = ?")
    .get(blackoutId, resourceId) as BlackoutRow | undefined;
  if (!row) throw new DomainError("NOT_FOUND", "Blackout not found.");
  db.prepare("DELETE FROM resource_blackouts WHERE id = ?").run(blackoutId);
  logAudit(db, {
    organizationId: resource.organization_id,
    actorId: user.id,
    action: "resource.blackout_removed",
    entityType: "resource",
    entityId: resourceId,
    summary: `Removed a maintenance blackout.`,
  });
}

export function getResourceOwnerProfile(db: Db, resourceId: string): ProfileRow | null {
  return (db
    .prepare(
      `SELECT p.* FROM profiles p JOIN resources r ON r.owner_id = p.id WHERE r.id = ?`,
    )
    .get(resourceId) as ProfileRow | undefined) ?? null;
}
