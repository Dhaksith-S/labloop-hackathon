# Security

This document describes what LabLoop actually enforces, what it does not, and
how to review it. It is written for a hackathon review, not as a certification.

> **No security certification is claimed.** The Supabase RLS migration is
> unapplied and unverified. The running application uses SQLite with server-side
> authorization.

## 1. Threat model

Assets worth protecting:

- who may reserve scarce equipment, and the evidence of that decision;
- condition and incident records that can affect a student's standing;
- credentials and membership status;
- session tokens and password hashes;
- audit history that must not be silently rewritten.

Primary threats considered:

| Threat | Example | Control |
| --- | --- | --- |
| Broken access control | Student calls an owner action directly | Service-layer role/ownership checks; page redirects are not trusted |
| Privilege abuse | Owner approves their own request | `SELF_APPROVAL` rejection |
| Double booking / race | Two managers approve overlapping windows | Transaction + SQLite overlap trigger; PostgreSQL exclusion constraint |
| Credential spoofing | User claims a safety badge | Only manager/admin verification; pending is not proof |
| History tampering | Editing a condition report after damage | Append-only triggers on audit/timeline/condition tables |
| Session theft | Cookie read by script | HttpOnly, SameSite=Lax, Secure in production |
| Password cracking | Offline dump of hashes | scrypt with per-password salt |
| SQL injection | Search query manipulation | Prepared statements with bound parameters |
| XSS | User-entered purpose rendered as HTML | React escaping; no user HTML injection |
| Open redirect | Protocol-relative or backslash-normalized login target | `src/lib/redirects.ts` rejects external URLs/control characters and checks normalized origin |
| Self-review | Reporter resolves their own incident | `SELF_REVIEW` rejection |
| Enumeration | Login reveals whether email exists | Generic error + dummy scrypt derivation |
| Brute force | Repeated password guesses | In-process throttle, 8 per 15 min per email |
| CSRF | Cross-site form post | SameSite=Lax cookie + Next Server Action same-origin checks |

Out of scope for this build: nation-state attackers, malicious hosting
operators, supply-chain compromise of npm packages, physical equipment safety,
and institutional policy disputes.

## 2. Authentication

- **Password storage:** `scrypt` with a 16-byte random salt and 64-byte derived
  key, stored as `scrypt$<salt>$<hash>` (`src/lib/password.ts`).
- **Comparison:** `timingSafeEqual`; malformed stored values fail closed.
- **Unknown accounts:** `verifyPasswordConstantTime` always runs a dummy scrypt
  derivation, reducing timing differences.
- **Password policy:** minimum 10 characters, at least one letter and one number.
- **Sessions:** 32 random bytes, base64url. Only an HMAC-SHA-256 hash is stored
  in `sessions`. TTL 14 days. Expired sessions are deleted on new login.
- **Cookie:** `labloop_session`; HttpOnly, SameSite=Lax, path `/`, `Secure` in
  production unless `LABLOOP_INSECURE_COOKIES=1`.
- **Logout:** deletes the session row and clears the cookie.
- **Production secret:** `LABLOOP_SESSION_SECRET` is mandatory in production
  (24+ characters). There is no production fallback; the app throws at startup
  of the auth path.
- **Login audit:** successful logins write `auth.login` to the organization audit
  log.

Not implemented: email verification, password reset, MFA, OAuth/SSO, session
listing/revocation UI, device binding, breach-password checks.

## 3. Authorization

Authorization is enforced in domain services, not only in pages:

- `requireUser()` loads the session and redirects unauthenticated users.
- `resolveStaffOrganization()` / `createResource()` check active membership and
  role before listing changes.
- `decideBooking()`, `confirmReturn()`, `cancelBooking()` check that the actor is
  the resource owner, or a manager/admin of the organization. A manager of a
  different organization is rejected.
- Owners only manage their own resources (`assertCanManageResource`); an `owner`
  role is not organization-wide authority.
- `getBookingDetail()` returns `FORBIDDEN` unless the actor is the borrower, the
  resource owner, or an org manager/admin.
- A borrower cannot review their own request, confirm their own return, or
  review their own incident.
- Qualification verification requires manager/admin.
- Check-in rechecks the borrower's current database membership, so suspension
  after approval prevents taking custody even with an older session snapshot.
  Return submission remains available so suspended borrowers can hand back equipment.
- Incident review requires resource authority and a reviewer different from the
  reporter.
- Staff listing services reject student callers and suspended memberships.
  Owner bookings, incidents and listings are scoped to the selected organisation.
  An inactive/former owner cannot read a booking merely because `owner_id` matches;
  borrowers retain access to their own transaction history.

The Admin/Organization console is restricted to manager/admin in the page **and**
`getOrganizationOverview()` throws for anyone else.

## 4. State and data integrity

- Legal transitions live in `BOOKING_TRANSITIONS`; services call
  `assertTransition()`.
- Approval and waitlist reopening re-run full eligibility; they do not trust the
  request-time result.
- `db.transaction(...).immediate()` wraps multi-row writes so booking status,
  timeline, audit and notifications commit together.
- SQLite triggers reject UPDATE/DELETE on `audit_events`, `booking_events` and
  `condition_reports`.
- SQLite triggers reject overlapping `approved`/`checked_in`/`return_submitted`
  rows for the same resource, even on a direct SQL insert that bypasses services.
- An additive trigger also rejects direct `resource_id` changes onto an occupied
  resource, including on databases created before this takeover.
- Reasons are required for reject/waitlist and manager cancellation. Check-in
  requires explicit rule acknowledgement and records initial condition.
- Notifications are derived from the same transaction as the state change.

**Limits:** triggers prevent rewriting rows, but a database-file owner could drop
the triggers or restore an old file. There is no hash chain, remote WORM storage
or signed audit export. Do not describe this as tamper-proof against a
infrastructure administrator.

## 5. Input handling and web security

- Every Server Action validates `FormData` with Zod before calling a service.
- Services repeat length/format checks because they are callable from tests and
  future entry points.
- Queries use `better-sqlite3` prepared statements. Dynamic `IN (...)` lists are
  built from placeholder counts, not interpolated values.
- React escapes rendered text. The only `dangerouslySetInnerHTML` is a fixed
  theme bootstrap script with no user input.
- `safeNextPath()` blocks external, backslash/control-character and normalized `/login` redirects.
- Response headers from `next.config.ts`:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`

Not implemented: Content-Security-Policy, HSTS (hosting should add it), custom
per-form CSRF tokens, CAPTCHA, WAF, request-body size limits at the app layer.

## 6. Secrets and data handling

- `.env*` is gitignored except `.env.example`.
- `data/` and all `*.db` files are gitignored. The SQLite file contains password
  hashes, session hashes, bookings and audit rows — treat it as sensitive.
- No service keys, Supabase credentials or Vercel tokens are in the repository.
- Demo accounts use a public password by design. They must never be reused for a
  real deployment.
- The seed is explicitly fictional and idempotent.
- No analytics, tracking pixels, third-party scripts or external font requests
  are used.

## 7. Supabase/RLS path — prepared, unverified

`supabase/migrations/20261030000200_rls_policies.sql` is designed so that:

- anonymous users read only active catalog rows;
- authenticated users read their own bookings, conditions, incidents and
  notifications;
- owners/managers read records for resources they manage;
- authenticated clients have **no** insert/update/delete on lifecycle tables;
  only `notifications.read_at` is updatable;
- mutations use the service role from trusted server code after `auth.getUser()`
  and the same domain checks;
- audit/timeline/condition triggers reject update/delete even for the table owner
  and service role;
- the `bookings_no_overlap` exclusion constraint closes approval races.

**None of this has run.** There is no Supabase project, CLI login or database
password in this environment. The SQL is review-ready, not verified.

### Required RLS verification matrix (not yet executed)

Run with real anon, student A, student B, owner A, owner B, manager, admin and
service-role clients:

| # | Actor | Action | Expected |
| --- | --- | --- | --- |
| 1 | anon | select active resource | allowed |
| 2 | anon | select paused resource | denied/zero rows |
| 3 | anon | select bookings | denied |
| 4 | student A | select own booking | allowed |
| 5 | student A | select student B booking | denied/zero rows |
| 6 | student A | update own booking status to approved | denied (no grant) |
| 7 | owner A | select booking on own resource | allowed |
| 8 | owner A | select booking on owner B resource | denied |
| 9 | manager | select org bookings | allowed |
| 10 | manager | update another manager's incident to resolved | allowed only if not reporter |
| 11 | manager | verify own qualification | rejected by server check |
| 12 | manager | update audit_events | denied (no grant + trigger) |
| 13 | service_role | update audit_events | trigger rejects |
| 14 | service_role | insert two overlapping approved bookings concurrently | exactly one succeeds |
| 15 | student | update own `notifications.read_at` | allowed |
| 16 | student | insert notification for another user | denied |

Until rows 1–16 have real results, the Supabase path is unverified.

## 8. Known security limitations

1. **In-memory login throttle** — per process, resets on restart, not shared
   across instances. A production deployment needs Redis/edge rate limiting plus
   IP-based controls.
2. **No email verification/reset** — a mistyped address cannot be recovered; an
   attacker who controls an email address can claim it at signup in this demo.
3. **No CSP/HSTS in-app** — add at the hosting layer.
4. **SQLite file trust** — local filesystem access implies full data access.
5. **No upload validation** — photo upload is not implemented, so no storage
   policy is claimed.
6. **No audit export or retention policy** — records persist indefinitely in the
   demo database.
7. **Demo password is public** — intentional; rotate/remove all demo accounts
   before any real use.
8. **Signup email enumeration** — the form reports an existing email. This is a
   usability trade-off, not a hardened registration flow.
9. **No vulnerability disclosure contact** — none is configured. Do not invent
   a security email address.

## 9. Pre-deployment security checklist

- [ ] Replace SQLite or attach a persistent encrypted volume.
- [ ] Set a unique `LABLOOP_SESSION_SECRET` from a secret manager.
- [ ] Enforce HTTPS and `Secure` cookies; do not set `LABLOOP_INSECURE_COOKIES`.
- [ ] Remove or rotate demo accounts and public credentials.
- [ ] Add CSP, HSTS and a shared rate limiter.
- [ ] Add email verification and password reset if real users are onboarded.
- [ ] If selecting Supabase, apply migrations and execute the RLS matrix above.
- [ ] If selecting Supabase, store the service-role key only in server-side environment variables.
- [ ] Back up the database and test restore.
- [ ] Define an incident-response owner and disclosure channel.

## 10. Takeover audit and operational evidence - 30 October 2026

Fixed and regression-tested: missing student-role guards in staff booking/incident
lists; owner queue/listing organisation leakage; suspended staff overview/private
booking access; browser-normalized redirect handling; direct SQL overlap on
resource reassignment; E2E prep accepting a non-fixture `.db` path. Page guards
already blocked some routes; service fixes provide defense at the data boundary.
Current membership is also rechecked before taking custody; the lifecycle test
revokes/restores membership after approval and verifies the suspended check-in fails.

`npm run verify:production` independently confirmed a local production custody
flow, cookie flags and session/booking/condition persistence after a process
restart. Online backup/restore and overwrite refusal are tested. Guarded hosted
startup validates required configuration before opening the store. No remote
penetration test, hosted backup schedule, RLS execution or real-user security
readiness is claimed. The persistent-hosting template is unapplied and paid
resources remain prohibited by the user.

Prepared Supabase SQL is still subject to review before use. In particular,
its owner helpers do not yet mirror the new active-owner checks, and the public
owner-profile policy does not itself supply anonymous SELECT grants or column
privacy. Resolve those grant/policy issues and run the entire client matrix
before exposing Postgres; this SQLite audit does not validate that port.
