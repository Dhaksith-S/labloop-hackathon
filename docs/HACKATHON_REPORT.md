# Hackathon report

**Challenge:** Unlock Underused Equipment and Spaces

**Product:** LabLoop — a trusted campus resource-sharing and custody loop

**Build date:** 30 October 2026

**Status:** Locally runnable and tested. **Not publicly deployed.** Supabase
schema/RLS prepared but unapplied. No invented adoption, usage or deployment
claims.

---

## 1. Executive summary

Campuses already own the equipment students need. The bottleneck is not
inventory; it is trusted access. Informal sharing fails because nobody can
answer three questions quickly:

1. Is this person allowed to use this machine?
2. Is the slot actually free?
3. What condition was it in when it left, and who had custody?

LabLoop answers all three in one lifecycle: a verified owner publishes rules and
hours, a student sees exactly which rules they meet, a human owner decides, the
borrower checks in with condition evidence, returns it with final evidence, and
the owner closes custody. Conflicts are blocked at both the service and database
layers. Rejections and waitlists require written reasons. A released slot
reopens the first eligible waitlist request for human review — never automatic
approval.

The product is a complete Next.js monolith with a persistent database, demo
institution, role-aware UI, audit trail, incidents and credential verification.
It is verified by 29 unit/integration tests and 3 Chromium end-to-end tests.

## 2. The problem, concretely

A lab steward fields requests in chat. A student asks for a printer at 2 pm; the
steward cannot remember whether the safety induction happened, whether another
print is running, or whether the laser is down for servicing. A second student
is told "maybe" and never hears back. When a probe disappears, nobody can prove
who had the kit.

The brief asks for underused equipment and spaces to be unlocked. The hard part
is not a calendar. It is **eligibility plus accountability**.

## 3. What was built

### Public discovery

- Branded landing page explaining the loop without fabricated social proof.
- Searchable, category-filtered catalog of active listings.
- Resource detail: description, location, owner, condition, usage rules,
  published weekly hours, blackouts, required credentials and request CTA.
- Light/dark theme, responsive layout, keyboard-visible focus.

### Student workspace

- Dashboard with real counts and next actions.
- My bookings with status, next step, waitlist position and overdue indicator.
- Eligibility panel with pass / warning / fail detail before submission.
- Booking detail with status timeline, condition reports, incidents, cancel and
  check-in/return forms.
- Activity feed, persistent notifications, profile with credentials and history.

### Owner studio

- Owner dashboard scoped to owned resources.
- Request queue with approve / reject / waitlist and mandatory written reasons.
- Custody queue and return confirmation.
- Incident queue with human resolution notes and self-review blocking.
- Listing management: create, edit, pause/archive, requirements, weekly
  availability, blackouts.
- Organization audit activity.

### Manager/admin

- Organization overview with SQL-backed counts: listings, custody, members,
  roles, open incidents, recent audit.
- Organization-wide qualification verification with reviewer and expiry.
- Access to all-org requests, custody and incidents (role-scoped).

### Integrity and security

- Server-side authn/authz; scrypt passwords; HMAC-hashed session tokens;
  HttpOnly SameSite cookies; login throttling; open-redirect protection.
- Deterministic eligibility engine; approval-time re-validation.
- Atomic booking writes; SQLite overlap triggers; prepared PostgreSQL exclusion
  constraint.
- Append-only audit, timeline and condition records enforced by database
  triggers.
- Self-approval and self-incident-review rejection.
- Zod at every form boundary; prepared SQL throughout.
- Security headers.

### Operations

- Idempotent fictional seed with five accounts, seven resources, qualifications,
  bookings, incidents, conditions, notifications and audit history.
- Setup, seed and reset scripts.
- Isolated E2E database and server port.
- Prepared Supabase schema + RLS with explicit unverified status.

## 4. What is genuinely working

The following were executed on 30 October 2026 in this workspace:

| Verification | Result |
| --- | --- |
| `npm test` | 2 files, 29 tests passed |
| `npm run test:e2e` | 3 tests passed, Chromium |
| `npm run typecheck` | passed |
| `npm run lint` | passed |
| `npm run build` | passed, all routes compiled |
| `npm start` local smoke test | home/login/catalog HTTP 200; security headers present |
| `npm run db:reset` | recreated and seeded SQLite database |

The E2E test completes request → approve → check-in → return → confirm across
three real accounts in a browser. It is not a mocked component test.

The integration suite includes a direct SQL insert that bypasses application
code and is rejected by the database overlap trigger, and direct UPDATE/DELETE
attempts rejected by append-only triggers.

## 5. Design decisions

### Monolith over microservices

One Next.js app and one relational store fit a 48-hour build and an institution's
actual scale. Domain rules are plain functions, callable from pages, actions and
tests. There is no network boundary between eligibility and booking creation.

### SQLite over an unconfigured cloud

No Supabase credentials existed. Rather than ship a fake backend or an
unverified cloud claim, the runnable product uses persistent SQLite. The
PostgreSQL/RLS path is included as a prepared migration with its status stated
plainly.

This is a deliberate trade-off: excellent local reproducibility, but not
serverless-persistent. It is the main deployment blocker.

### Human decision over auto-approval

Eligibility is necessary but not sufficient. Owners see context a rule engine
cannot: a broken fixture, a student who needs accommodation, a lab tech's
judgment. The product automates verification and evidence, not allocation.
Every override requires a reason.

### Transparency over a hidden score

Waitlist order is submission time, visible to the borrower. There is no
reputation score, priority tier or paid fast lane. The trade-off is a queue that
can be gamed by early requests, mitigated by per-resource fair-use caps.

### Boring, auditable primitives

Server Actions, Zod, prepared SQL, database triggers and append-only tables. No
custom crypto, no ORM magic, no client-side authorization.

## 6. UX and visual direction

The interface uses a "technical institution" visual language: warm paper
surfaces, deep green primary, amber accents, Manrope for UI, Newsreader italic
for emphasis, JetBrains Mono for labels. Listing art is deterministic CSS/SVG by
category rather than stock photography.

The goal is credibility: a lab steward should believe this could replace their
spreadsheet. Every status has text, not color alone. Empty states explain what
will appear. Forms show field-level errors and pending states. The layout works
from mobile to wide desktop, in both themes.

## 7. Deployment reality

**There is no public URL.** This is not a modest footnote; it is the honest
status.

Blockers:

1. No Vercel CLI, token, project or explicit authorization in the environment.
2. The SQLite file is not persistent on serverless functions. Deploying the
   build unchanged would lose sessions, bookings and audit rows. A persistent
   volume or the PostgreSQL port is required.
3. Supabase is not provisioned. The two SQL migrations have never run against
   PostgreSQL; the app is not wired to Supabase Auth or Postgres.

What is ready: a passing production build, environment documentation, a
migration path and a deployment checklist. What is missing: infrastructure
authorization and a persistent-store port.

## 8. Limitations

- No public deployment; no Vercel/Supabase verification.
- Supabase SQL and RLS are unexecuted and untested.
- Chromium-only E2E; no Firefox/WebKit or mobile device project.
- No automated accessibility audit; no WCAG conformance claim.
- No load or concurrency stress test.
- No email verification, password reset, MFA or OAuth.
- No photo upload or storage bucket, despite `photo_url` in the model.
- No background scheduler for waitlist expiry or reminders.
- No appeal/second-review workflow.
- No incident-to-eligibility policy; incidents are recorded but do not
  automatically restrict future access.
- Login throttling is in-process only.
- No CSP or HSTS at the app layer.
- Single-capacity resources only; no seat/quantity inventory.
- No multi-institution tenant switcher in the UI (roles and data are
  organization-scoped, but the demo has one institution).

## 9. If there were another 48 hours

Priority order:

1. **Persistent hosted store.** Port data access to Supabase/Postgres, apply
   migrations, run the RLS matrix and a concurrent-approval test.
2. **Deploy with authorization.** Vercel or a Node host with a persistent
   volume; set a real session secret; verify HTTPS cookies.
3. **Waitlist operations.** Expiry, reminders, review SLA and aging indicators.
4. **Appeals and second review.** Preserve the first decision, add an independent
   reviewer.
5. **Photo evidence.** Supabase Storage with signed URLs, type/size limits and
   storage RLS.
6. **Accessibility verification.** axe/Lighthouse plus keyboard and screen-reader
   sessions with students.
7. **Notification delivery.** Email or push with preferences, while keeping the
   in-app record authoritative.
8. **Operational reporting.** Incident consistency review, utilization without
   fabricated metrics, exportable audit for institutional review.

## 10. Judge checklist

| Criterion | Where to look |
| --- | --- |
| Originality | Custody loop with condition evidence, waitlist human-review rule, self-dealing blocks |
| Technical depth | Eligibility engine, SQLite triggers, atomic transactions, approval re-check, prepared Postgres exclusion constraint |
| Completeness | Listing → discovery → request → decision → check-in → return → confirmation → incident → audit |
| UX | Responsive themed UI, eligibility explanations, role-aware navigation, empty/error states |
| Security | Server-side authz, scrypt + hashed sessions, self-approval/review blocks, append-only audit |
| Fairness | Published rules, written reasons, FIFO waitlist, fair-use caps, no auto-approval |
| Test quality | 29 Vitest tests including database-bypass tests; 3 real-browser E2E tests |
| Honesty | This report and README explicitly state no deployment and unverified Supabase |

## 11. Claim boundaries

True:

- The app runs locally with persistent SQLite.
- The listed tests, typecheck, lint and build passed.
- Schema and RLS SQL for Supabase exist and are documented as unverified.
- The demo institution and people are fictional.

Not true / not claimed:

- A live URL or production deployment.
- Supabase applied, RLS verified or storage configured.
- Real institutional adoption, user counts or utilization metrics.
- WCAG compliance, penetration-test clearance or load capacity.
- Any integration with a real campus identity provider.
