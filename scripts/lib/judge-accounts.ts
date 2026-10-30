import { randomBytes } from "node:crypto";
import type { Db } from "../../src/lib/database";
import { DEMO_PASSWORD } from "../../src/lib/domain";
import { logAudit } from "../../src/lib/events";
import { hashPassword, verifyPassword } from "../../src/lib/password";

/** Public judge scope is student/owner; never publish the seeded manager login. */
export async function lockPrivilegedDemoAccounts(db: Db): Promise<{ credentialsLocked: number; sessionsRevoked: number }> {
  const candidates = db.prepare(`SELECT DISTINCT p.id, p.email, p.password_hash
    FROM profiles p JOIN organization_members m ON m.user_id = p.id
    WHERE m.role IN ('manager', 'admin')`).all() as Array<{ id: string; email: string; password_hash: string }>;
  if (candidates.some(p => !p.email.toLowerCase().endsWith("@labloop.demo"))) {
    throw new Error("Public judge hardening refuses non-fictional privileged accounts; inspect this store privately.");
  }
  const prepared = await Promise.all(candidates.map(async profile => ({ ...profile,
    replacement: await verifyPassword(DEMO_PASSWORD, profile.password_hash)
      ? await hashPassword(randomBytes(48).toString("base64url")) : null,
  })));
  return db.transaction(() => {
    let credentialsLocked = 0;
    let sessionsRevoked = 0;
    for (const profile of prepared) {
      const locked = profile.replacement ? db.prepare("UPDATE profiles SET password_hash = ? WHERE id = ? AND password_hash = ?")
        .run(profile.replacement, profile.id, profile.password_hash).changes : 0;
      const revoked = db.prepare("DELETE FROM sessions WHERE user_id = ?").run(profile.id).changes;
      credentialsLocked += locked; sessionsRevoked += revoked;
      if (locked || revoked) {
        const memberships = db.prepare("SELECT id, organization_id FROM organization_members WHERE user_id = ? AND role IN ('manager', 'admin')")
          .all(profile.id) as Array<{ id: string; organization_id: string }>;
        for (const member of memberships) logAudit(db, { organizationId: member.organization_id, actorId: null,
          action: "auth.public_demo_privileged_lock", entityType: "membership", entityId: member.id,
          summary: "Public judge demo: shared privileged credential disabled and privileged sessions revoked.",
          metadata: { sessionsRevoked: revoked },
        });
      }
    }
    return { credentialsLocked, sessionsRevoked };
  }).immediate();
}
