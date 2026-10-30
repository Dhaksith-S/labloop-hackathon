import type { Db } from "@/lib/database";
import type {
  BookingRow,
  ProfileRow,
  ResourceRow,
  SessionUser,
} from "@/lib/db-types";
import { openDatabase } from "@/lib/database";
import { seedDemoDatabase } from "@/lib/demo/seed";

/**
 * Fresh in-memory database with the deterministic fictional demo dataset.
 * Tests never touch data/labloop.db or the Next.js request-scoped singleton.
 */
export async function createSeededDb(): Promise<Db> {
  const db = openDatabase(":memory:", { quiet: true });
  const result = await seedDemoDatabase(db);
  if (!result.seeded) throw new Error("Demo seed refused to run on a fresh database.");
  return db;
}

interface MembershipJoinRow {
  organization_id: string;
  organization_name: string;
  organization_slug: string;
  timezone: string;
  role: SessionUser["memberships"][number]["role"];
  title: string | null;
  status: "active" | "suspended";
}

export function sessionFor(db: Db, email: string): SessionUser {
  const profile = db
    .prepare("SELECT * FROM profiles WHERE email = ?")
    .get(email) as ProfileRow | undefined;
  if (!profile) throw new Error(`No seeded profile for ${email}`);
  const memberships = db
    .prepare(
      `SELECT m.organization_id, o.name AS organization_name, o.slug AS organization_slug,
              o.timezone, m.role, m.title, m.status
       FROM organization_members m
       JOIN organizations o ON o.id = m.organization_id
       WHERE m.user_id = ?
       ORDER BY o.name`,
    )
    .all(profile.id) as MembershipJoinRow[];
  return {
    id: profile.id,
    email: profile.email,
    fullName: profile.full_name,
    headline: profile.headline,
    avatarColor: profile.avatar_color,
    memberships: memberships.map((row) => ({
      organizationId: row.organization_id,
      organizationName: row.organization_name,
      organizationSlug: row.organization_slug,
      timezone: row.timezone,
      role: row.role,
      title: row.title,
      status: row.status,
    })),
  };
}

export function resourceByName(db: Db, name: string): ResourceRow {
  const row = db.prepare("SELECT * FROM resources WHERE name = ?").get(name) as
    | ResourceRow
    | undefined;
  if (!row) throw new Error(`No seeded resource named ${name}`);
  return row;
}

export function bookingByPurpose(db: Db, purposePrefix: string): BookingRow {
  const row = db
    .prepare("SELECT * FROM bookings WHERE purpose LIKE ? ORDER BY created_at DESC LIMIT 1")
    .get(`${purposePrefix}%`) as BookingRow | undefined;
  if (!row) throw new Error(`No seeded booking with purpose starting ${purposePrefix}`);
  return row;
}
