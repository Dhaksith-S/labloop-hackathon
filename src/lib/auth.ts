import "server-only";

import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { Db } from "./db";
import { getDb } from "./db";
import type { MembershipContext, ProfileRow, SessionUser } from "./db-types";
import type { Role } from "./domain";
import { SESSION_COOKIE, SESSION_TTL_DAYS } from "./domain";
import { hashPassword, verifyPassword, verifyPasswordConstantTime } from "./password";

export { hashPassword, verifyPassword, verifyPasswordConstantTime };

function sessionSecret(): string {
  const secret = process.env.LABLOOP_SESSION_SECRET;
  if (secret && secret.length >= 24) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "LABLOOP_SESSION_SECRET is required in production (minimum 24 characters).",
    );
  }
  return "labloop-local-development-session-secret-do-not-use-in-production";
}

export function hashSessionToken(token: string): string {
  return createHmac("sha256", sessionSecret()).update(token).digest("base64url");
}

export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export interface CreatedSession {
  token: string;
  expiresAt: string;
}

export function createSessionRecord(
  db: Db,
  userId: string,
  now = new Date(),
): CreatedSession {
  const token = generateSessionToken();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_DAYS * 86_400_000).toISOString();
  db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(now.toISOString());
  db.prepare(
    "INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)",
  ).run(
    randomUUID(),
    userId,
    hashSessionToken(token),
    expiresAt,
    now.toISOString(),
  );
  return { token, expiresAt };
}

export async function setSessionCookie(token: string, expiresAt: string): Promise<void> {
  const cookieStore = await cookies();
  const secure =
    process.env.NODE_ENV === "production" && process.env.LABLOOP_INSECURE_COOKIES !== "1";
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    expires: new Date(expiresAt),
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export function loadSessionUser(db: Db, token: string, now = new Date()): SessionUser | null {
  const row = db
    .prepare(
      `SELECT p.* FROM sessions s
       JOIN profiles p ON p.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > ?`,
    )
    .get(hashSessionToken(token), now.toISOString()) as ProfileRow | undefined;
  if (!row) return null;
  return hydrateUser(db, row);
}

function hydrateUser(db: Db, profile: ProfileRow): SessionUser {
  const memberships = db
    .prepare(
      `SELECT m.organization_id, m.role, m.title, m.status,
              o.name AS organization_name, o.slug AS organization_slug, o.timezone
       FROM organization_members m
       JOIN organizations o ON o.id = m.organization_id
       WHERE m.user_id = ?
       ORDER BY CASE m.role WHEN 'admin' THEN 0 WHEN 'manager' THEN 1 WHEN 'owner' THEN 2 ELSE 3 END`,
    )
    .all(profile.id) as Array<{
    organization_id: string;
    role: Role;
    title: string | null;
    status: "active" | "suspended";
    organization_name: string;
    organization_slug: string;
    timezone: string;
  }>;

  const mapped: MembershipContext[] = memberships.map((membership) => ({
    organizationId: membership.organization_id,
    organizationName: membership.organization_name,
    organizationSlug: membership.organization_slug,
    timezone: membership.timezone,
    role: membership.role,
    title: membership.title,
    status: membership.status,
  }));

  return {
    id: profile.id,
    email: profile.email,
    fullName: profile.full_name,
    headline: profile.headline,
    avatarColor: profile.avatar_color,
    memberships: mapped,
  };
}

export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return loadSessionUser(getDb(), token);
});

export async function requireUser(nextPath?: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    redirect(nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login");
  }
  return user;
}

export function getMembership(user: SessionUser, organizationId: string): MembershipContext | null {
  return user.memberships.find((m) => m.organizationId === organizationId) ?? null;
}

export function isStaffRole(role: Role): boolean {
  return role === "owner" || role === "manager" || role === "admin";
}

export function canManageOrganization(user: SessionUser, organizationId: string): boolean {
  const membership = getMembership(user, organizationId);
  return Boolean(
    membership &&
      membership.status === "active" &&
      (membership.role === "manager" || membership.role === "admin"),
  );
}

export function canOwnResources(user: SessionUser, organizationId: string): boolean {
  const membership = getMembership(user, organizationId);
  return Boolean(membership && membership.status === "active" && isStaffRole(membership.role));
}

export async function requireOrganizationManager(organizationId: string): Promise<SessionUser> {
  const user = await requireUser();
  if (!canManageOrganization(user, organizationId)) {
    throw new Error("FORBIDDEN");
  }
  return user;
}
