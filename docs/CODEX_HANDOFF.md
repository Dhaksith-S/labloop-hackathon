# Codex handoff

You are receiving a complete, locally verified hackathon application — not a
deployed service. Read this before changing code.

## 1. Mission and current state

**Product:** LabLoop, a campus resource-sharing and custody platform for the
fictional Northstar Institute of Applied Technology.

**Current state (30 Oct 2026):**

| Area | Truth |
| --- | --- |
| App | Next.js 16.4.3 App Router, React 19.3, strict TypeScript, Tailwind v4 |
| Backend | Persistent SQLite via `better-sqlite3`; self-hosted auth |
| Demo data | Idempotent fictional seed; five accounts; seven resources |
| Unit/integration tests | 44 passed across 4 files (Vitest), independently rerun by Codex |
| Browser tests | 5 passed (Playwright, Chromium), including listing/discovery and phone viewport |
| Typecheck/lint/build | Passed |
| Public deployment | **None. No URL. No Vercel project/token.** |
| Supabase | Schema + RLS prepared in `supabase/`; **never applied or verified** |
| Git | Public `main` at <https://github.com/Dhaksith-S/labloop-hackathon>; inspect `git log` for milestone history |
| Local production | Guarded startup; browser custody and Secure cookie verified; session/completed booking/conditions survive process restart; backup integrity passed |
| Hosting preparation | `deploy/render.yaml` + startup/backup/runbook, unapplied; no paid resources authorized |
| Submission | Official brief/rubric transcribed; report/PDF provisional; official template and real participant/contribution details pending; no submission made |

If a task depends on a live deployment, Supabase verification, email, uploads or
real institution data, it is **not** already done. Do not imply otherwise.

## 2. First 15 minutes

```bash
node --version                  # require 24+
npm install                     # only when dependencies are missing/out of sync
npm run db:setup                # preserve existing profiles; NEVER blindly reset
npm run typecheck
npm test
npm run lint
npm run test:e2e                # fresh data/e2e.db on port 3100
npm run build
npm run verify:production       # private temp fixture, local production restart
npm run dev                     # http://localhost:3000
```

Demo accounts (password `LabLoop!2026`):

- `student@labloop.demo` — Arjun, student
- `owner@labloop.demo` — Maya, resource owner
- `manager@labloop.demo` — Riya, manager
- `priya@labloop.demo` — student
- `dev@labloop.demo` — student

Run the scripted walkthrough in `docs/DEMO.md`.

## 3. Ground truth

### Runnable now

- Marketing catalog and detail pages.
- Signup/login/logout with persistent sessions.
- Student dashboard, bookings, eligibility, check-in, return, notifications,
  activity and profile.
- Owner listings, request decisions, custody and incidents.
- Manager organization overview and qualification verification.
- Audit/timeline/condition append-only behavior.
- SQLite overlap prevention.
- Seed/setup/reset/E2E scripts.

### Prepared only

- `supabase/migrations/20261030000100_initial_schema.sql`
- `supabase/migrations/20261030000200_rls_policies.sql`
- `supabase/README.md`

These have not executed on PostgreSQL. The app does not import a Supabase client
and has no Supabase dependency.

### Does not exist

- Vercel/Supabase project, credentials or deployment.
- Email delivery, password reset, MFA, OAuth.
- File/photo upload or storage bucket.
- Background jobs, cron, queues.
- Real institution, users, metrics or testimonials.
- Open-source license for this repository.

## 4. Architecture map

```
src/app/(marketing)   public landing, catalog, detail, how-it-works
src/app/(auth)        login, signup
src/app/(app)         dashboard, bookings, resources request, owner, admin,
                      activity, notifications, profile
src/components        app shell, forms, booking panels, UI primitives
src/lib/*.ts          domain services and infrastructure
src/lib/actions       Server Actions (Zod + requireUser + service call)
src/db/sqlite-schema  runnable schema and triggers
src/lib/demo/seed     deterministic fictional data
tests/                Vitest
e2e/                  Playwright
supabase/             prepared Postgres/RLS
scripts/              setup, seed, reset, prepare-e2e
docs/                 product and engineering documentation
```

Key entry points:

- `src/lib/bookings.ts` — the lifecycle and authorization spine.
- `src/lib/eligibility.ts` — pure rules; start here for policy changes.
- `src/lib/state-machine.ts` — legal transitions and check-in window.
- `src/lib/db.ts` — request-scoped singleton; `database.ts` — open/migrate.
- `src/lib/auth.ts` — sessions; `password.ts` — scrypt.
- `src/lib/events.ts` — timeline, audit, notifications.
- `src/db/sqlite-schema.sql` — triggers and constraints.

## 5. Non-negotiable invariants

Read the list in `AGENTS.md`. The most important:

1. Every mutation checks auth/role/ownership server-side.
2. Eligibility never auto-approves; approval re-checks.
3. No self-approval, self-return-confirmation or self-incident-review.
4. No overlapping custody rows; service + DB guards must both stay.
5. Audit/timeline/condition history is append-only.
6. Waitlist release returns to `pending`, never `approved`.
7. UTC storage; IST interpretation via `src/lib/time.ts`.
8. Demo seed is idempotent and fictional.
9. No fake metrics or deployment claims.

## 6. Verification contract

A change is not done until the relevant checks pass:

```bash
npm test
npm run typecheck
npm run lint
```

Run `npm run test:e2e` for routing, auth, forms, booking/custody or theme/layout
changes. Run `npm run build` before claiming production readiness.

Expected current results: 44 Vitest tests, 5 Playwright tests, zero type/lint
errors, successful build.

Notes:

- E2E reserves port 3100 and uses `data/e2e.db`. Do not point it at
  `data/labloop.db`.
- `prepare-e2e.ts` deletes only the resolved `data/e2e.db` and WAL/SHM siblings.
  It refuses every other configured path and production execution. Preserve
  valuable fixture records first.
- If route deletion leaves stale `.next` types, remove `.next` before typecheck.
- The Vitest ESM/CommonJS config warning is benign; do not "fix" it by switching
  the project to ESM without checking Next.

## 7. Environment

Copy `.env.example` to `.env.local` when overriding defaults.

| Variable | Meaning |
| --- | --- |
| `LABLOOP_DB_PATH` | SQLite path (default `data/labloop.db`) |
| `LABLOOP_SESSION_SECRET` | HMAC key; **required** in production, 24+ chars |
| `LABLOOP_INSECURE_COOKIES` | `1` only for local HTTP `next start` |
| `LABLOOP_SEED_DEMO` | `0` disables auto-seed |
| `NEXT_PUBLIC_APP_URL` | Public base URL for metadata |
| `NEXT_PUBLIC_SUPABASE_*` | Prepared path only; unused by the app |
| `SUPABASE_SERVICE_ROLE_KEY` | Prepared path only; never expose to client |

Production without `LABLOOP_SESSION_SECRET` throws. Do not add a fallback.

## 8. Highest-priority work

### A. Authorized persistent hosting (selected route)

The user explicitly selected persistent SQLite preparation and **no paid
resources**. Read `docs/DEPLOYMENT.md`. Do not apply `deploy/render.yaml` without
new authorization: its compute/disk are paid. No provider account is connected.
Do not replace the working backend with an unverified port under deadline pressure.

Prepared: one native Node instance, `/var/data/labloop.db`, generated secret,
explicit fictional seed, HTTPS URL requirement, manual deployment, WAL-safe
backup/restore, local production restart verifier. Not yet verified: provider
configuration/API validation, Linux native-module installation, actual volume,
public judge flow, hosted restart and off-host backup schedule.

Next action: the user must authorize a compatible existing persistent host or
a specific provider account/plan/spending cap and connect it through the provider.
No credentials should be pasted in chat or committed. Continue local tasks while
that decision is pending; do not create resources or incur charges.

### B. Supabase/Postgres port (alternative, deferred)

Acceptance criteria:

1. Create a Supabase project with explicit authorization.
2. Apply both migrations; record command output and any fixes.
3. Port `database.ts` and all `db.prepare` call sites to an async Postgres client.
4. Replace self-hosted auth with Supabase Auth, or keep server-side sessions in a
   Postgres table. Do not mix half of each.
5. Map `profiles.id` to `auth.users.id`; ensure the new-user trigger works.
6. Rewrite seed/scripts for Postgres; guard against production seeding.
7. Run the 16-row RLS matrix in `docs/SECURITY.md` with real clients.
8. Run a concurrent approval test: two transactions for the same window; exactly
   one commits.
9. Update docs with **actual** results. Remove "unverified" only when verified.

Do not simply add `@supabase/supabase-js` and call the port complete while the
app still reads SQLite.

### C. Deployment acceptance (only with authorization)

Acceptance criteria:

1. Choose a host with a persistent store. Vercel serverless + SQLite is not
   acceptable.
2. Set a unique `LABLOOP_SESSION_SECRET` from a secret manager.
3. Enforce HTTPS, `Secure` cookies, no `LABLOOP_INSECURE_COOKIES`.
4. Remove/rotate demo accounts and public password, or isolate them to a demo
   environment.
5. Add CSP/HSTS at the edge.
6. Smoke test: public catalog, login, request, approve, check-in, return,
   confirm, restart persistence.
7. Record the real URL, deployment command and timestamp.

If hosting authorization is absent, record the precise blocker and continue
independent documentation/testing work. Do not invent a URL.

### D. Product gaps, in order

1. Waitlist expiry/reminders and review SLA.
2. Appeal/second-review workflow.
3. Photo evidence with storage RLS and signed URLs.
4. Email notification delivery with preferences.
5. Cross-resource per-person fair-use policy.
6. Accessibility verification (axe + keyboard + screen reader).
7. Incident consistency reporting.
8. Audit export for institutional review.

## 9. Safe change recipes

### Add an eligibility rule

1. Add a check in `src/lib/eligibility.ts` with a stable `id`, label, status and
   detail.
2. Add a unit test in `tests/eligibility.test.ts` for pass and fail.
3. Confirm it appears in the request preview and booking detail.
4. Decide whether it blocks both `request` and `approval` modes.
5. Update `docs/FAIRNESS.md` and `docs/ARCHITECTURE.md`.

### Add a booking transition

1. Update `BOOKING_TRANSITIONS`.
2. Update the service function with role/ownership checks, reason requirements,
   transaction, timeline, audit and notification.
3. Extend lifecycle tests, including an illegal transition.
4. Check the UI only offers the action when legal.
5. Verify the database triggers still protect custody overlap.

### Change the schema

1. Edit `src/db/sqlite-schema.sql` (runnable) **and** the prepared Postgres
   migration if the port must stay aligned.
2. Update `db-types.ts`.
3. Add/adjust migrations for existing databases. The current SQLite loader uses
   `CREATE TABLE IF NOT EXISTS`; it does not run ALTER migrations.
4. Verify against fresh test fixtures and a backed-up copy of an existing DB;
   do not reset the user's demo DB. Apply additive changes safely on opening.
5. Never edit append-only rows to "fix" data; write a correcting record.

### Change auth

1. Keep `server-only` imports.
2. Keep session tokens hashed at rest.
3. Preserve generic login errors and dummy hashing.
4. Re-run role-guard E2E.
5. Update `docs/SECURITY.md`.

## 10. Do not do

- Do not claim a deployment, public URL or uptime.
- Do not claim Supabase/RLS is applied or verified.
- Do not add fake users, logos, testimonials, utilization charts or "trusted by"
  copy.
- Do not weaken append-only triggers or the overlap guard to make a test pass.
- Do not auto-approve waitlisted requests.
- Do not let an owner approve their own request or review their own incident.
- Do not expose `SUPABASE_SERVICE_ROLE_KEY` or any secret to the client.
- Do not commit `.env*`, `data/`, `*.db`, `.next`, test results or Playwright
  reports.
- Do not run `db:reset` or `prepare-e2e` against a database you did not create.
- Do not switch the project to ESM solely to silence the Vitest warning without
  validating the Next build.
- Do not invent a security contact or license.

## 11. Decision log

| Decision | Reason | Revisit when |
| --- | --- | --- |
| SQLite instead of unconfigured Supabase | No credentials; working persistence beats a fake backend | Supabase project is authorized |
| Self-hosted auth | No Supabase Auth; demonstrates session security | Postgres port |
| Human final approval | Policy context cannot be fully encoded | Never fully remove; may add second reviewer |
| Waitlist FIFO + eligibility recheck | Simple, explainable, auditable | Add SLA/expiry |
| No photo upload | No storage credentials; avoid fake feature | Storage RLS is ready |
| In-process rate limit | Single demo process | Multi-instance deployment |
| Chromium-only E2E | Installed browser; time-boxed | CI with Firefox/WebKit |
| No license selected | Author decision pending | Before public distribution |

## 12. Handoff checklist

- [x] Existing dependencies usable on Node 24.18.0; no reinstall needed.
- [x] Existing application DB and interrupted documentation backed up before work.
- [x] `npm test` → 44 passed.
- [x] `npm run test:e2e` → 5 passed (isolated DB, port 3100).
- [x] Typecheck, lint and production build pass.
- [x] Browser custody loop and independent local production restart check pass.
- [x] Security/fairness docs read and updated; findings have regression tests.
- [x] Deployment and Supabase status remain explicit and unverified remotely.
- [x] Official brief and all seven judging criteria mapped to actual evidence.
- [ ] Authorized persistent cloud host and public URL verified.
- [ ] Official PDF template supplied and report transferred to it.
- [ ] Team names/IDs/real contributions and provenance verified by humans.
- [ ] Each participant reviews and submits individually before 1 November, 10:00 AM IST.

## 13. Where to look first

| Question | File |
| --- | --- |
| Why was this booking refused? | `src/lib/bookings.ts`, `src/lib/eligibility.ts` |
| What states are legal? | `src/lib/state-machine.ts` |
| How is a session authenticated? | `src/lib/auth.ts`, `src/lib/password.ts` |
| Where is the audit written? | `src/lib/events.ts` and each service |
| How is history protected? | `src/db/sqlite-schema.sql` triggers |
| What data is seeded? | `src/lib/demo/seed.ts` |
| What is tested? | `tests/`, `e2e/`, `docs/TESTING.md` |
| What is prepared for Postgres? | `supabase/`, `supabase/README.md` |
| What must not be claimed? | `README.md`, `docs/HACKATHON_REPORT.md`, this file |

## 14. Takeover recovery, findings and final Git state

Initial local/remote `main` both matched `921d406bcd2d7ed93e52e162fb7fae90b97be5fc`.
The four interrupted documentation changes were preserved. The handoff had one
Git row; no duplicate was present. Private recovery copies and binary Git patches
are under `%LOCALAPPDATA%/LabLoop/recovery-20261030-134815`; consistent backups
include the original app database (5 profiles, 5 bookings) and E2E database.
No hard reset, checkout, pull, application DB reset or remote history rewrite ran.

Security fixes: service-level staff role checks; multi-organisation owner scope;
suspended staff private reads; browser URL normalization on login; additive
resource-reassignment overlap trigger; current membership rechecked at check-in
after approval. E2E prep now refuses non-fixture paths.
Mobile auth headings are visible H1s. High-risk lifecycle/session/backup tests
were added. See `docs/VERIFICATION.md` for executed commands and failures/fixes.

Final runtime/source commit and push evidence are recorded in
`docs/VERIFICATION.md`; use `git log -3 --oneline` for the latest documentation
commit and compare `git rev-parse HEAD` to `git ls-remote origin refs/heads/main`.
The final documentation commit includes this handoff, so it does not embed its
own impossible self-referential hash. No database, backup or secret belongs in Git.

Required human actions: provide/authorize a persistent host within the spending
constraint; supply the official PDF format and real participant/contribution
details; confirm any pre-existing assets and development-window compliance;
review links and submit individually. Codex must not submit the Google form.

The local product is verified. Submission remains incomplete because public
deployment, official-format PDF and participant details are outstanding.

## 15. Subsequent Funnel preparation - current continuation point

The user authorized zero-cost laptop Funnel preparation/testing, retaining the
existing production build. An initial automatic installer command was rejected;
the user later completed installation and GitHub SSO independently. Tailscale
1.104.4 is now Running/online and the Windows service is Running/Automatic.
No further installation or sign-in is needed. The user subsequently approved the
exact public route and enabled HTTPS/Funnel in Tailscale's website. Both
capabilities are now advertised. The official command accepted the route and
issued `https://dhaksith.tail3cd298.ts.net/`, but public verification failed and
Funnel was disabled. This is an attempted address, not a verified working URL.

Read `docs/TAILSCALE_FUNNEL.md`. Private runtime:
`%LOCALAPPDATA%/LabLoop/judge-demo` (ACL restricted; encrypted DPAPI secret;
idempotent fictional DB; never commit runtime logs/browser session files).
The helper `scripts/funnel/judge-demo.ps1` prepares/configures/starts/stops/backups
without enabling Funnel. Backend 3210 and filtered ingress 3211 bind only
127.0.0.1. The approved public target was only ingress 3211.
Administrative/developer paths are denied. Origin/Host are pinned exactly;
Next allowedOrigins was not widened. Local browser proxy journey, current
session persistence after restart and actual backup/restore integrity passed.
48 Vitest tests, 5 E2E tests, typecheck and lint pass. Build ID remains
`itApzfwuOZ96pav7ZpWPX`; no production rebuild was performed.

The actual authenticated device DNS name has been read from CLI status and
that exact origin is configured. Final Funnel status returns `{}` after shutdown.
`scripts/verify-funnel-demo.ts --loopback` passed
the configured-origin production journey; after a real app/ingress restart,
`--loopback --revisit` retained the session, completed transaction and both reports.
Backup restoration and direct restricted-path/foreign-origin checks also passed.
48 tests, typecheck and lint were rerun successfully. The local services remain
ready on loopback; there is still no public forwarding.

Public attempt: pinned HTTPS curl timed out after roughly 10 seconds and the
non-intercepted browser verifier timed out loading `/resources` after 20 seconds,
before login or booking mutations. External web fetch also failed. Funnel was
promptly disabled using `funnel --https=443 off`. Later diagnostics at
2026-10-30 11:59:18 UTC found Google/Cloudflare DNS resolving both relay addresses,
TCP 443 reachable on both, and local ingress catalog HTTP 200. A direct TLS probe
with proxy bypass after shutdown failed its handshake; it cannot establish what
an active route would do. The original timeout cause remains unresolved. Do not
infer ISP blocking, a certificate failure, an app bug or a Tailscale defect.

Next: present this blocker and the no-cost Cloudflare Quick Tunnel alternative.
It requires separately approved software and public exposure, plus an exact-host
ingress/configuration adjustment. No Cloudflare tunnel has been installed/run.
Official portable `cloudflared` 2026.10.6 has only been downloaded under the private
LabLoop installers directory; release SHA-256 and Cloudflare Authenticode signature
verified. It has not been executed. A separate software/local-preparation approval
is pending; it excludes public exposure. See the Funnel guide for exact metadata.
Quick Tunnel URLs change on recreation and have no uptime guarantee. Keep
Tailscale exposure off; do not automatically restore it after this failure.
Local app/ingress, isolated DB, DPAPI secret and backups remain intact. Public
lifecycle/restart/off-tailnet access and URL stability are all unverified.
No paid resources, power changes or automatic submission.
