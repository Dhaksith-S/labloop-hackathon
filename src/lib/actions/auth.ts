"use server";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/lib/db";
import {
  clearSessionCookie,
  createSessionRecord,
  hashSessionToken,
  hashPassword,
  setSessionCookie,
  verifyPasswordConstantTime,
} from "@/lib/auth";
import type { ProfileRow } from "@/lib/db-types";
import { DEMO_ORGANIZATION_SLUG, SESSION_COOKIE } from "@/lib/domain";
import { logAudit, pushNotification } from "@/lib/events";
import { nowIso } from "@/lib/time";
import {
  actionError,
  fieldErrorsFromZod,
  readString,
  type ActionResult,
} from "@/lib/action-results";

const loginSchema = z.object({
  email: z.email("Enter a valid email address.").max(200),
  password: z.string().min(1, "Enter your password.").max(200),
});

const signupSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Enter your full name.")
    .max(80, "Keep your name under 80 characters."),
  email: z.email("Enter a valid email address.").max(200),
  password: z
    .string()
    .min(10, "Use at least 10 characters.")
    .max(200, "Keep your password under 200 characters.")
    .regex(/[A-Za-z]/, "Include at least one letter.")
    .regex(/[0-9]/, "Include at least one number."),
  headline: z.string().trim().max(120).optional(),
});

const attemptWindow = new Map<string, { count: number; resetAt: number }>();

function loginAttemptAllowed(key: string): boolean {
  const now = Date.now();
  const record = attemptWindow.get(key);
  if (!record || record.resetAt < now) {
    attemptWindow.set(key, { count: 1, resetAt: now + 15 * 60_000 });
    return true;
  }
  record.count += 1;
  return record.count <= 8;
}

function clearLoginAttempts(key: string) {
  attemptWindow.delete(key);
}

function safeNextPath(value: string): string {
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/login")) {
    return "/dashboard";
  }
  return value;
}

function auditLogin(userId: string, organizationId: string, summary: string) {
  logAudit(getDb(), {
    organizationId,
    actorId: userId,
    action: "auth.login",
    entityType: "membership",
    entityId: userId,
    summary,
  });
}

export async function loginAction(
  _previous: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = loginSchema.safeParse({
    email: readString(formData, "email").toLowerCase(),
    password: readString(formData, "password"),
  });
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFromZod(parsed.error) };
  }
  const next = safeNextPath(readString(formData, "next") || "/dashboard");
  const db = getDb();
  const profile = db
    .prepare("SELECT * FROM profiles WHERE email = ?")
    .get(parsed.data.email) as ProfileRow | undefined;

  if (!loginAttemptAllowed(parsed.data.email)) {
    return {
      error: "Too many sign-in attempts. Wait 15 minutes before trying again.",
    };
  }

  const passwordValid = await verifyPasswordConstantTime(
    parsed.data.password,
    profile?.password_hash,
  );
  if (!profile || !passwordValid) {
    return { error: "Email or password is incorrect." };
  }

  clearLoginAttempts(parsed.data.email);
  const session = createSessionRecord(db, profile.id);
  await setSessionCookie(session.token, session.expiresAt);

  const membership = db
    .prepare("SELECT organization_id FROM organization_members WHERE user_id = ? LIMIT 1")
    .get(profile.id) as { organization_id: string } | undefined;
  if (membership) auditLogin(profile.id, membership.organization_id, "Signed in to LabLoop.");

  redirect(next);
}

export async function signupAction(
  _previous: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = signupSchema.safeParse({
    fullName: readString(formData, "fullName"),
    email: readString(formData, "email").toLowerCase(),
    password: readString(formData, "password"),
    headline: readString(formData, "headline") || undefined,
  });
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  const db = getDb();
  const organization = db
    .prepare("SELECT id, name FROM organizations WHERE slug = ?")
    .get(DEMO_ORGANIZATION_SLUG) as { id: string; name: string } | undefined;
  if (!organization) {
    return {
      error:
        "The demo institution is not initialized. Run `npm run db:setup` and try again.",
    };
  }

  const existing = db
    .prepare("SELECT id FROM profiles WHERE email = ?")
    .get(parsed.data.email);
  if (existing) {
    return { fieldErrors: { email: ["An account with this email already exists."] } };
  }

  const userId = randomUUID();
  const timestamp = nowIso();
  const passwordHash = await hashPassword(parsed.data.password);

  try {
    db.transaction(() => {
      db.prepare(
        `INSERT INTO profiles (id, email, full_name, password_hash, headline, avatar_color, created_at)
         VALUES (?, ?, ?, ?, ?, '#0b6b5f', ?)`,
      ).run(
        userId,
        parsed.data.email,
        parsed.data.fullName,
        passwordHash,
        parsed.data.headline || null,
        timestamp,
      );
      db.prepare(
        `INSERT INTO organization_members
          (id, organization_id, user_id, role, title, status, created_at)
         VALUES (?, ?, ?, 'student', 'Member', 'active', ?)`,
      ).run(randomUUID(), organization.id, userId, timestamp);
      pushNotification(db, {
        userId,
        kind: "welcome",
        title: "Welcome to LabLoop",
        body: "Your account is active. Browse resources and complete any required training before your first request.",
        href: "/resources",
      });
      logAudit(db, {
        organizationId: organization.id,
        actorId: userId,
        action: "member.joined",
        entityType: "membership",
        entityId: userId,
        summary: `${parsed.data.fullName} joined ${organization.name} as a student member.`,
      });
    }).immediate();
  } catch (error) {
    return actionError(error);
  }

  const session = createSessionRecord(db, userId);
  await setSessionCookie(session.token, session.expiresAt);
  redirect("/dashboard?welcome=1");
}

export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    getDb().prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashSessionToken(token));
  }
  await clearSessionCookie();
  redirect("/");
}
