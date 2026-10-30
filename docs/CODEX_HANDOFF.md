# Codex handoff

You are receiving the existing hackathon application with a verified public
fictional judge demo. Read this before changing code. **Section 19 supersedes
the historical deployment checkpoints in sections 17-18.**

## 1. Mission and current state

**Product:** LabLoop, a campus resource-sharing and custody platform for the
fictional Northstar Institute of Applied Technology.

**Current state (30 Oct 2026):**

| Area | Truth |
| --- | --- |
| App | Next.js 16.4.3 App Router, React 19.3, strict TypeScript, Tailwind v4 |
| Backend | Persistent SQLite via `better-sqlite3`; self-hosted auth |
| Demo data | Idempotent fictional seed; five accounts; seven resources |
| Unit/integration tests | Latest 55 passed across 6 files; original baseline 44 across 4 |
| Browser tests | 5 passed (Playwright, Chromium), including listing/discovery and phone viewport |
| Typecheck/lint/build | Passed |
| Public deployment | Required checks passed at `https://headline-anticipated-trips-salaries.trycloudflare.com`; laptop/network/current cloudflared window must remain online; no uptime guarantee |
| Supabase | Schema + RLS prepared in `supabase/`; **never applied or verified** |
| Git | Public `main` at <https://github.com/Dhaksith-S/labloop-hackathon>; inspect `git log` for milestone history |
| Local production | Guarded startup; browser custody and Secure cookie verified; session/completed booking/conditions survive process restart; backup integrity passed |
| Hosting preparation | `deploy/render.yaml` + startup/backup/runbook, unapplied; no paid resources authorized |
| Submission | Official brief/rubric transcribed; report/PDF provisional; official template and real participant/contribution details pending; no submission made |

Supabase verification, email, uploads and real institution identity integration
are **not** done. Public demo acceptance is verified only as documented in
`docs/PUBLIC_DEMO_VERIFICATION.md`; preserve the running tunnel and private DB.

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

Local demo accounts (password `LabLoop!2026`; public manager login is locked):

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

### A. Verified zero-cost laptop demo (current route)

Preserve the current production app, isolated fictional SQLite store and exact
approved Cloudflare hostname. Public lifecycle, security, app-only restart,
backup restore and user-confirmed external phone access passed; see section19.
Keep the current foreground cloudflared window/laptop/network online. A new
tunnel URL requires exact-host review, configuration and public retesting.

No paid resources are authorized. `deploy/render.yaml` remains an unapplied
paid compute/disk template. Managed-provider configuration, Linux native-module
installation, persistent host volume and off-host backup scheduling are not
verified. Do not migrate the working backend unnecessarily or paste credentials.

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

## 15. Historical Funnel preparation checkpoint

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
verified. Software/local preparation was subsequently approved and executed;
see section 16 for the current state. Public exposure remains excluded.
Quick Tunnel URLs change on recreation and have no uptime guarantee. Keep
Tailscale exposure off; do not automatically restore it after this failure.
Local app/ingress, isolated DB, DPAPI secret and backups remain intact. Public
lifecycle/restart/off-tailnet access and URL stability are all unverified.
No paid resources, power changes or automatic submission.

## 16. Cloudflare fallback - software/local preparation complete

Read `docs/CLOUDFLARE_QUICK_TUNNEL.md`. User approval covers running portable
cloudflared 2026.10.6 and local preparation only. `--version` and `tunnel --help`
passed after rechecking official SHA-256 and valid Cloudflare signature. No
tunnel, account sign-in, service, paid resource or power change was created.

The ingress now has explicit provider selection. Tailscale remains the default;
Cloudflare mode checks exact Host instead of trusting forwarded-host input,
requires exact HTTPS Origin for POST, strips forwarding/identity headers and
retains all route/body restrictions. Only one valid allocated single-label
trycloudflare hostname is accepted; no wildcard origin permission was added.
Next.js allowedOrigins and the existing production build remain unchanged.

`Start -LocalPreflight -Provider Cloudflare` uses the reserved invalid simulation
origin without changing the saved profile. `--cloudflare-local` completed the
production journey and Secure-cookie checks; after restart, `--revisit` retained
session, completed booking and reports. The fresh final backup restored with
integrity ok and both reports. Original DB, DPAPI secret file, configured profile
and BUILD_ID matched preservation baselines. Latest 51 Vitest tests, typecheck
and lint pass. The five standard E2E tests were not rerun; the actual production
browser verification was run for these changes.

A verifier cleanup race initially printed a fictional session cookie. That
specific session was revoked; fresh full-flow/restart runs passed. Raw errors
are suppressed, route callbacks drain before disposal, and acceptance is saved
only after clean shutdown. A stale-backup comparison was corrected by taking a
fresh backup after the final journey; no records were reset or rewritten.

Local services passed Cloudflare local-preflight and were stopped for allocation.
After automated allocation was rejected (`blocked by policy`, no other rationale),
the user manually ran the approved cloudflared command and provided
`https://underlying-living-milton-estimated.trycloudflare.com`. Verified one exact
executable/argument process, fixed upstream 3211, loopback-only metrics 3212 and
`/ready` 200. Public catalog returned expected 502 while app was stopped; normal
curl TLS validation passed. External web-tool fetch was unavailable. The tunnel
PID/start time are in private `cloudflare-process.json`; keep its user PowerShell
window open. Funnel remains `{}`. The profile was backed up and configured to
that exact Cloudflare origin; original DB hash remains unchanged.

The user then **approved this exact app configuration and public tests**. An
automated app-connection/start command was separately rejected with `blocked by
policy` and no further reason. It did not run; app/ingress ports 3210/3211 and
process record remained absent. Authorization is stored privately with
`appConnectionState=manual-start-pending`; do not mark connected prematurely.
Do not retry the rejected action through another tool/wrapper.

The user manually ran the helper and confirmed configured-mode startup. Actual
read-only checks at 2026-10-30 12:32:39 UTC found local ingress catalog 200, but
public catalog 530/Cloudflare error 1033. No cloudflared process or metrics
listener remained; `/ready` refused connections and the original recorded PID
was absent. Why the process exited is unknown. Do not blame user action or a
network/crash cause without evidence. No public lifecycle was attempted against
the known-disconnected route.

App/ingress were stopped; all 3210/3211/3212 ports are now closed, Funnel remains
off, original DB hash and BUILD_ID unchanged. Private record mode is `exited`,
with `exitObservedAt`, not an invented process exit time. Next: user manually
reruns the existing allocation command with an added private info logfile and
keeps that terminal open. A text request asks for the new URL and any concise
exit error. This is recovery within allocation authorization, not a fresh request
for software or allocation permission. The old exact app approval is recorded;
review/pin a different hostname before reconnecting the app. Automated launch
rejections remain; do not bypass them through another tool/wrapper. Public
workflow/restart/backup/off-tailnet-device acceptance is still pending.

## 17. Historical continuation: prior public journey and pending checks

Current exact URL: `https://complexity-headphones-normal-nut.trycloudflare.com`.
The user supplied this recovered hostname, said the tunnel window stays open,
and instructed continuation of the approved workflow/public tests. That covers
this hostname; do not ask exposure approval again. Verified one exact official
cloudflared process/target, loopback metrics, registration event, readiness 200
and connection metric 1. Profile was backed up/pinned and old exited process
record archived privately. User manually started the app after prior automated
launch rejections. Do not retry rejected launch actions through another tool.

Real public production checks passed with no interception or resolver override:
full student request -> owner approval -> check-in -> initial/final reports ->
return confirmation -> completed history; Secure/HttpOnly/SameSite=Lax cookie.
Restricted admin/private/dev/API/metrics paths returned 404; foreign-Origin and
Origin-less POSTs returned 403; HSTS/CSP/nosniff/frame denial were present.
Latest completed evidence at 2026-10-30 13:57:09 UTC has booking path
`/bookings/b63ffce7-bedd-4432-9dbc-471b5f100dd2`.

Security review found the seed manager shared the published demo password.
Added `scripts/lib/judge-accounts.ts` and `scripts/harden-judge-demo.ts`: only the
isolated fictional judge DB is eligible; shared manager/admin credentials are
replaced by discarded random passwords, privileged sessions revoked and an
audit event appended. Student/owner credentials/roles/history are preserved.
Startup invokes it before opening listeners; it is idempotent and refuses a
non-fictional privileged profile. One actual manager credential was locked,
zero privileged sessions existed. Public negative login verified no session.
No application source/build was changed; development DB remains untouched.

Latest 53 Vitest tests across 6 files, typecheck/lint and PowerShell syntax pass.
The five standard E2E tests were not rerun; actual public production browser tests
were. One repeat run reached completed custody but did not finish successfully;
its original stage/error was not retained. Visual public inspection showed both
reports, and a subsequent full run passed. Do not invent a root cause/fix.
Verifier now retains sanitized failure stage/summary privately and never prints
raw request headers. Current evidence/limitations: `docs/PUBLIC_DEMO_VERIFICATION.md`.

Fresh backup `judge-20261030T135826191Z.db` restored to a new private file:
integrity ok, completed public booking, two reports, six events and manager lock.
Original app DB, DPAPI secret and BUILD_ID still match preservation checks.

**Outstanding:** a two-question text request asks the user to Stop/Start only
the app (keeping cloudflared alive), and then verify catalog plus Priya dashboard
on a mobile-data phone with Wi-Fi/Tailscale disabled. No renewed permission is
needed. `public-before-restart.json` stores baseline app/tunnel identities,
secret-file hash, DB hash, URL and booking path. Once app PID/start time changes,
verify the same tunnel PID/start time/URL and run
`node --import tsx scripts/verify-funnel-demo.ts --revisit` without local flags.
Record session/completed reports retained and normal TLS; persist private
`public-restart-evidence.json`. Record phone results strictly as user-confirmed
evidence, not an automatic external-device check. External web-tool fetch was
unavailable and cannot substitute. Then finalize README/runbooks/report/PDF,
scan private data exclusions, commit/push and compare local/remote hashes.

Keep the current tunnel alive; recreation changes URL. All data, session files,
process records and raw logs stay outside Git. No paid resource, power/service
change, database reset, migration or form submission is authorized.

### Latest reload prerequisite

A subsequent unauthenticated HTTP GET returned 200 without HTTPS redirect.
Added Cloudflare-only protocol enforcement using edge-overwritten
X-Forwarded-Proto: exact-origin HTTPS redirects for GET/HEAD, rejection for
plaintext POST/missing metadata, and a narrowly reserved local simulation
exception. Malformed/external redirect targets fail closed. Two regression tests
bring the latest suite to **55 tests**, typecheck/lint passing. The public verifier
sets HTTPS metadata only in explicitly intercepted modes; real public tests
still use the actual network path and normal TLS.

Stopped the old app/ingress so plaintext pages are no longer served; the same
registered cloudflared process/hostname is alive. The existing pending manual
Stop/Start request will load the fix (Stop with no process record is harmless).
Do not automatically launch the app via another tool. After manual start,
verify HTTP GET -> exact HTTPS 308, HTTP POST -> 403, HTTPS catalog/login -> 200,
and that a client-supplied X-Forwarded-Proto is overwritten by Cloudflare.
Then perform the saved public-session/record revisit and remaining phone check.
Update pending markers only after actual results. Original DB/secret/build and
the completed public history/backup are preserved.

## 18. Historical approval gate: newly recreated hostname

User answered "restarted" but also supplied a recreated tunnel URL and explicitly
required approval before exposure. Therefore same-URL restart and mobile-data
checks are NOT confirmed. Previous `complexity-headphones-normal-nut` is obsolete.
Current configured URL is `https://headline-anticipated-trips-salaries.trycloudflare.com`.

Verified one exact cloudflared executable/arguments (37504 at inspection), fixed
3211 target, loopback metrics owned by that same process, readiness 200,
connection metric 1 and hostname in private log. Normal public TLS passed.
While app still had the old origin, new URL returned 421; after stopping app and
pinning the new origin, expected gateway 502 confirmed disconnection.

Before/after configuration signatures prove unchanged session rows, bookings,
booking events, condition reports, audit history and DPAPI secret. Snapshots,
old profiles/process records and digests are private. Current process record has
`appConnectionApproved=false`, `appConnectionState=approval-pending`. App/ingress
are stopped; no automatic connection has been attempted. Do not request a new
database, reset data or change the secret. Cookies are host-bound, so ordinary
browsers need a new login even though server-side session records were preserved.

A two-question request shows the exact new HTTPS443 -> filtered3211 -> prod3210
-> preserved fictional DB mapping and asks explicit approval. Its conditional
second step lets the user run the existing helper `-Action Start` manually and
report "approved and started" in the same reply; automated starts remain blocked
by prior review. Wait for that approval before public mutation tests. Keep this
new cloudflared window/process alive; do not recreate it for an app-only restart.

After approved manual start: verify actual HTTP308/HTTPS200 and plaintext POST403,
public full custody and manager denial, then genuine same-host app-only
restart/session persistence and a phone/mobile-data check. Prior public proofs
belong to the old host and do not satisfy this new-host acceptance. All 55 source
tests/typecheck/lint pass; original Next build remains unchanged. Current docs
and provisional report clearly mark reconnection/retests pending.

## 19. Verified current public demo - final acceptance passed

This section supersedes prior pending checkpoints. The user approved the exact
headline hostname and manually started production. All required current-host
checks passed on 30 October 2026. No further current-host exposure approval is
pending. Automatic review had blocked automated starts; user manual actions
resolved those steps. Do not retry blocked launches via another tool.

Public HTTPS443 -> the existing registered cloudflared 2026.10.6 process ->
filtered 127.0.0.1:3211 -> retained Next production build 127.0.0.1:3210 ->
`%LOCALAPPDATA%/LabLoop/judge-demo/fictional-judge.db`. Metrics3212 is loopback
only. Funnel remains off. The original development DB, DPAPI-encrypted unique
session secret and BUILD_ID `itApzfwuOZ96pav7ZpWPX` are unchanged.

- Public owner publication and student discovery of a new fictional workspace
  passed. The **same listing** completed request, human approval, check-in,
  initial/final condition reports, return confirmation and history at
  14:57:05 UTC / 20:27:05 IST. Actual network, normal TLS, no interception or DNS override.
- Security: HTTP reads308 to exact HTTPS, plaintext POST403 even with spoofed
  protocol, foreign/absent Origin403, admin/private/dev/metrics404, Secure,
  HttpOnly/Lax cookie, HSTS/limited CSP/nosniff/frame denial. Manager shared
  credential rejected; student/owner remain usable. No Next origin exception.
- Added `RestartApp` to the operations helper. The user manually ran it; both
  app/ingress identities changed while the **same tunnel identity and URL**
  remained. The saved owner session reopened completed custody and both reports.
  All pre-restart booking/event/condition/audit rows matched unchanged.
- Latest backup `judge-20261030T152120690Z.db` restored into a new private file:
  integrity ok, same completed booking, two reports, six events, manager lock.
- User confirmed real phone/mobile-data catalog and signed-in Priya dashboard
  with Wi-Fi off; confirmation received 15:21:19 UTC. This is user-confirmed
  external access, not automated phone inspection. No OS/browser claims.
- Final transport checkpoint15:23:25 UTC: HTTPS200/HTTP308/plaintextPOST403.
  Latest source55 tests across6 files, typecheck/lint and PowerShell syntax pass.
  Standard five E2Es passed earlier, not rerun for operations-only edits.

Authoritative current evidence: `docs/PUBLIC_DEMO_VERIFICATION.md`, sanitized
`docs/evidence/public-judge-summary.json` and fictional completed-record PNG.
Private details are `headline-public-security.json`, `headline-public-listing.json`,
`public-cloudflare-evidence.json`, `public-restart-evidence.json`,
`headline-history-after-restart.json`, `headline-final-restore-evidence.json`,
`external-device-confirmation.json` under the private runtime; never commit
session storage, DB/backups, secret files or raw logs. The completed resource
path is `/resources/23e2c684-50c8-447f-9155-8a9b91b82af7`; booking path
`/bookings/8a26a163-dd85-4b9b-bd8c-c55b67230017` (authorized login required).

Keep laptop/network/current cloudflared window online. An **app-only** restart
uses `-Action RestartApp`; it never starts/stops cloudflared or changes hostname.
Do not recreate the tunnel for an app restart. Windows/tunnel restart allocates
a new URL: stop app, allocate/review/approve/pin that exact host, reconnect and
retest. No unattended startup, paid resource, power change or uptime guarantee.
Official PDF format, actual participant IDs/roles/contributions and individual
submissions remain pending. The report/PDF is provisional; no form was submitted.
