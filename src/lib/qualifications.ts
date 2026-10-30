import type { Db } from "./db";
import type { QualificationRow, SessionUser } from "./db-types";
import { logAudit, pushNotification } from "./events";
import { DomainError } from "./state-machine";
import { fromDateTimeLocalValue, nowIso } from "./time";

export interface QualificationListItem extends QualificationRow {
  user_name: string;
  user_email: string;
}

export function listOrganizationQualifications(
  db: Db,
  organizationId: string,
  status?: "verified" | "pending" | "expired" | "revoked",
): QualificationListItem[] {
  const statusClause = status ? "AND q.status = ?" : "";
  const params: unknown[] = status ? [organizationId, status] : [organizationId];
  return db
    .prepare(
      `SELECT q.*, p.full_name AS user_name, p.email AS user_email
       FROM user_qualifications q
       JOIN profiles p ON p.id = q.user_id
       WHERE q.organization_id = ? ${statusClause}
       ORDER BY CASE q.status WHEN 'pending' THEN 0 WHEN 'verified' THEN 1 ELSE 2 END,
                q.created_at DESC`,
    )
    .all(...params) as QualificationListItem[];
}

export function listUserQualifications(
  db: Db,
  userId: string,
  organizationId: string,
): QualificationRow[] {
  return db
    .prepare(
      "SELECT * FROM user_qualifications WHERE user_id = ? AND organization_id = ? ORDER BY created_at DESC",
    )
    .all(userId, organizationId) as QualificationRow[];
}

export function reviewQualification(
  db: Db,
  reviewer: SessionUser,
  organizationId: string,
  qualificationId: string,
  input: {
    status: "verified" | "pending" | "expired" | "revoked";
    notes: string;
    expiresAt?: string | null;
  },
): void {
  const membership = reviewer.memberships.find((m) => m.organizationId === organizationId);
  if (
    !membership ||
    membership.status !== "active" ||
    !["manager", "admin"].includes(membership.role)
  ) {
    throw new DomainError(
      "FORBIDDEN",
      "Only a manager or administrator can verify qualifications.",
    );
  }
  const qualification = db
    .prepare("SELECT * FROM user_qualifications WHERE id = ? AND organization_id = ?")
    .get(qualificationId, organizationId) as QualificationRow | undefined;
  if (!qualification) throw new DomainError("NOT_FOUND", "Qualification record not found.");
  if (qualification.user_id === reviewer.id) {
    throw new DomainError(
      "SELF_VERIFICATION",
      "You cannot verify your own qualification. Ask another authorized reviewer.",
    );
  }

  const timestamp = nowIso();
  const expiresAt = input.expiresAt
    ? input.expiresAt.length === 16
      ? fromDateTimeLocalValue(input.expiresAt)
      : input.expiresAt
    : null;

  db.transaction(() => {
    db.prepare(
      `UPDATE user_qualifications SET status = ?, verified_by = ?, verified_at = ?,
       expires_at = ?, notes = ? WHERE id = ?`,
    ).run(
      input.status,
      input.status === "verified" ? reviewer.id : qualification.verified_by,
      input.status === "verified" ? timestamp : qualification.verified_at,
      expiresAt ?? qualification.expires_at,
      input.notes.trim() || qualification.notes,
      qualificationId,
    );
    logAudit(db, {
      organizationId,
      actorId: reviewer.id,
      action: `qualification.${input.status}`,
      entityType: "qualification",
      entityId: qualificationId,
      summary: `${reviewer.fullName} set ${qualification.name} to ${input.status} for ${qualification.user_id}.`,
      metadata: { notes: input.notes.trim() || null, expiresAt },
    });
    pushNotification(db, {
      userId: qualification.user_id,
      kind: "qualification_updated",
      title: `Qualification ${input.status} · ${qualification.name}`,
      body:
        input.status === "verified"
          ? `${reviewer.fullName} verified this credential. You may now qualify for additional resources.`
          : `${reviewer.fullName} updated this credential to ${input.status}.${input.notes.trim() ? ` Note: ${input.notes.trim()}` : ""}`,
      href: "/profile",
    });
  }).immediate();
}
