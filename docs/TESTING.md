# Testing

**Current public-demo checks:** 55 Vitest tests across 6 files, typecheck/lint
and PowerShell syntax pass. `tests/judge-accounts.test.ts` verifies shared
privileged-credential locking, selective session revocation, preserved custody
history, idempotence and refusal of non-fictional privileged accounts. The real
public owner listing/full same-resource custody/security, same-URL saved-session
restart and fresh restore passed. User confirmed external phone/mobile-data
catalog/dashboard access. See
[current executed evidence](PUBLIC_DEMO_VERIFICATION.md). No build or ordinary
E2E reset was run for these operations-only changes.
Two additional ingress tests cover exact HTTPS redirects, plaintext POST/missing
protocol rejection and the reserved local-simulation exception. Actual public
transport retests passed (308 upgrade, 403 plaintext POST, HTTPS 200).

**Latest Funnel preparation:** 48 tests across 5 Vitest files, 5 Playwright tests,
typecheck and lint passed. The production build from the baseline below was
retained and exercised through a local filtered proxy. This adds
`tests/funnel-proxy.test.ts` (exact origin validation, Server Action body/headers,
foreign-Origin denial and administrative/developer/path filtering), plus the
local full journey/restart verifier `scripts/verify-funnel-demo.ts`. It does not
prove a public URL. See `docs/TAILSCALE_FUNNEL.md`. The table below records the
earlier `17fa246` baseline, before these four ingress tests.

LabLoop is verified at three levels: pure rule tests, service/integration tests
against a real seeded database, and browser tests against a running Next.js app.

## Original baseline — 30 Oct 2026

| Command | Result |
| --- | --- |
| `npm test` | 4 files, **44 tests passed** |
| `npm run test:e2e` | **5 tests passed** (Chromium, 1 worker) |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed |
| `npm run build` | Passed |
| `npm run verify:production` | HTTP 200/security headers; production approval-to-return browser flow; Secure cookie; existing session, completed booking and two conditions survived a local process restart; verified backup |

Environment: Windows, Node 24, Next 16.4.3, Vitest 5.0.5, Playwright 1.64.1.
Playwright used the installed Chromium build. E2E ran on a freshly created
`data/e2e.db` on `http://127.0.0.1:3100`.

These were independently run by Codex; see `docs/VERIFICATION.md` for baseline,
failures/fixes and final commands. No coverage percentage, load test or
cross-browser matrix is asserted.

## Commands

```bash
npm test             # Vitest run (44)
npm run test:watch   # Watch mode
npm run typecheck
npm run lint
npm run test:e2e     # prepare e2e DB, start dev server on 3100, run Playwright
npm run build
npm run verify:production  # requires existing build; creates private temporary fixture
```

### E2E isolation

`npm run test:e2e` runs `scripts/prepare-e2e.ts` first. That script:

1. resolves `LABLOOP_DB_PATH` (default `data/e2e.db`);
2. refuses every resolved path except the fixed `data/e2e.db`, and refuses `NODE_ENV=production`;
3. deletes the database plus `-wal`/`-shm` siblings;
4. opens it, applies `src/db/sqlite-schema.sql`, and seeds the fictional demo.

Playwright starts `npm run dev -- --port 3100` with:

- `LABLOOP_DB_PATH=data/e2e.db`
- `LABLOOP_SEED_DEMO=1`
- `LABLOOP_INSECURE_COOKIES=1`
- a fixed non-production `LABLOOP_SESSION_SECRET`

The normal demo at `data/labloop.db` is never touched. The suite is serial
(`workers: 1`, `fullyParallel: false`) because tests share one database.
The fixture and server share the same path constant. Preserve existing E2E
records before the intentionally destructive preparation step. The takeover
created private recovery backups of both databases before the first run.

## Test inventory

### `tests/eligibility.test.ts` — 19 tests

Uses a fixed clock: Monday 1 June 2026, 09:30 IST. The base request is
10:00–11:00 IST inside a 09:00–17:00 window.

**Qualification verification (1)**

- accepts only verified, unexpired credentials; rejects expired, pending, revoked.

**Eligibility engine (16)**

- clean request passes and still states human review is required;
- suspended membership blocks;
- duration cap blocks;
- outside published hours blocks;
- maintenance blackout blocks and names the reason;
- missing required credential blocks;
- pending credential is not proof;
- expired credential is not proof;
- matching verified credential passes (normalized name);
- missing optional credential is a warning, not a block;
- approved reservation conflict blocks;
- competing open requests warn without blocking;
- borrower's own overlapping custody blocks;
- fair-use cap blocks after the configured number of active rows;
- approval mode excludes the booking under review;
- approval mode allows a started-but-not-ended window.

**Waitlist ordering (2)**

- orders by `created_at` and excludes non-waitlisted rows;
- returns zero position for a non-waitlisted booking while reporting total.

### `tests/lifecycle.test.ts` — 13 tests

Each test opens a fresh `:memory:` database, runs the real seed, and builds real
`SessionUser` objects from the database. No mocked services.

**Seeded lifecycle (5)**

1. Full loop: pending → approve → check-in → return → confirm. Asserts final
   status, `completed_at`, both condition phases, timeline kinds, audit actions
   and the borrower notification.
2. Check-in guard: blocks the wrong borrower (`FORBIDDEN`) and the correct
   borrower before the window (`CHECK_IN_WINDOW`); status stays `approved`.
3. Self-approval: an owner cannot approve their own pending request.
4. Role/ownership boundaries: a student cannot decide; a promoted owner who does
   not own the resource cannot decide or view it; the actual owner and an org
   manager can.
5. Overlap + fairness: approve the first of two overlapping requests; the second
   approval fails `NOT_ELIGIBLE`; waitlisting reports a position; cancelling the
   approved slot returns the first eligible waitlisted request to `pending`; its
   event says it was **not auto-approved**.

**Database integrity (2)**

- UPDATE/DELETE on audit, timeline and condition rows is rejected by SQLite
  triggers (`AUDIT_APPEND_ONLY`, `TIMELINE_APPEND_ONLY`,
  `CONDITION_REPORT_APPEND_ONLY`).
- A direct overlapping `approved` insert bypassing the service layer is rejected
  by the `BOOKING_CONFLICT` trigger.

Additional lifecycle regressions: revoked credentials are rechecked at approval;
current database membership is rechecked at check-in after an approval-time suspension;
rule acknowledgement and legal transition order are enforced; another borrower
cannot submit a return; repeated closure fails; an owner cannot confirm their
own return after a manager independently approved the request. All six
UPDATE/DELETE combinations are exercised across the three append-only tables.

**Human review services (3)**

- only an authorised resource owner or organisation manager/admin records an incident outcome; the reporter is notified;
- an incident reporter cannot review their own incident (`SELF_REVIEW`), while a
  different manager can;
- only a manager verifies a qualification; reviewer and expiry are recorded and
  the member is notified. (A student attempt fails `FORBIDDEN`.)

### `tests/security.test.ts` — 9 tests

- Student direct service calls cannot list staff bookings, incidents or audit activity.
- Suspended managers/owners lose staff access, including overview and private booking reads.
- Multi-organisation owners see queues/listings only in the selected organisation.
- Students cannot create listings; another owner cannot modify a resource.
- Direct SQL reassignment of an approved row onto an occupied resource fails.
- Sessions store hashes, reject forged/expired tokens and stop working after deletion.
- Missing/short production secrets fail closed.
- E2E preparation rejects application/custom DB paths and production execution.
- Login redirects reject external URLs, backslashes, control characters and normalized login paths.

### `tests/operations.test.ts` — 3 tests

- Production config accepts explicit absolute DB path, HTTPS and sufficiently long secret.
- Missing secret, relative DB path, insecure cookies, HTTP URL and implicit seed are refused.
- WAL content backs up and restores intact; existing destinations/source overwrite are refused.

### `e2e/labloop.spec.ts` — 5 tests

1. **Public catalog, detail and theme** — landing H1, catalog H1/search result,
   resource detail shows the required credential and sign-in CTA; theme toggle
   flips `data-theme`; `/how-it-works` renders.
2. **Demo picker and role guard** — picker fills student credentials, sign-in
   lands on dashboard, `/owner/requests` redirects a student back to dashboard,
   sign-out then `/bookings` redirects to login.
3. **Full custody loop in the browser** — Priya requests Open Maker Bench 04 for
   a slot starting in 15 minutes, Maya approves, Priya checks in with condition
   evidence, submits the return, Maya confirms; the final page shows completed
   status, both condition reports and the timeline.
4. **Listing creation and discovery** - owner publishes a resource with a required
   credential; a student finds it through search and sees that requirement.
5. **Phone viewport** - 390 x 844 public catalog/auth pages and dashboard fit
   without horizontal overflow; navigation opens and My bookings is reachable.
   This exposed and fixed hidden mobile H1s on login/signup.

The browser test uses visible text and roles rather than CSS selectors wherever
possible. It is intentionally one long serial flow because it verifies state
carried across borrower and owner sessions.

### `scripts/verify-production.ts` — local operational smoke

Runs the guarded startup against a newly created private temporary database and
a free local port. Chromium verifies approval, check-in, return and confirmation
on the compiled production server. The cookie is Secure/HttpOnly/SameSite=Lax.
The script stops and restarts its own process tree, revisits the completed
booking using the existing authenticated browser, asserts both reports and SQL
integrity, and makes a verified backup. A random secret stays in process memory.
The private fixture is retained for diagnosis and never committed. This is a
local restart check, **not** cloud volume durability or HTTPS-host verification.

## Requirement coverage

| Brief requirement | Evidence |
| --- | --- |
| Verified owner lists a resource | Real browser creation/discovery test + service ownership denial tests |
| Student discovers | Public catalog test + search/category/detail implementation |
| Eligibility-checked request | 16 engine tests + E2E submit |
| Owner approve/reject/waitlist | Lifecycle tests; E2E approve; waitlist integration test |
| Check-in + initial condition | Lifecycle test + E2E |
| Return + final condition | Lifecycle test + E2E |
| Owner confirmation | Lifecycle test + E2E |
| Incidents | Integration tests for review and self-review |
| Audit history | Append-only trigger tests + lifecycle audit assertions |
| Atomic conflict prevention | Service test + direct DB bypass test |
| Fair waitlist | Ordering unit tests + promotion integration test |
| Server-side authz | Role/ownership tests + E2E redirect |
| Human credential review | Integration test for verification and reviewer recording |

## What is not tested

Be explicit with judges and reviewers:

- **Supabase/PostgreSQL migrations have never run.** There is no database or
  credential. The RLS matrix in `docs/SECURITY.md` is a plan, not a result.
- **No managed-host/HA/load acceptance.** Current laptop public workflow, security,
  restart and fresh restore passed; uptime depends on laptop/network/tunnel.
- **Browser coverage limited.** Chromium desktop/phone viewport checks plus
  user-confirmed real phone catalog/dashboard; no Firefox/WebKit or screen-reader matrix.
- **No automated accessibility audit.** Semantics, labels and focus styles were
  implemented and manually reviewed; axe/Lighthouse was not run. Do not claim a
  WCAG conformance level.
- **No load, soak or concurrency stress test.** Overlap behavior is tested
  sequentially plus a direct database trigger test.
- **No email, upload or payment flow**, because those features do not exist.

## Manual verification checklist

Useful when a judge wants to confirm behavior without reading code:

1. `npm run db:setup` then `npm run dev` (preserves existing records)
2. Public `/resources`: search "printer", filter categories, open a listing.
3. Sign in as Priya; submit a bench request starting 15 minutes from now.
4. As Maya, open Requests; approve with a reason.
5. As Priya, check in; confirm the initial condition report appears.
6. Return with a "fair" final condition; status becomes return pending.
7. As Maya, confirm; timeline and both condition reports remain.
8. As Maya, pause a listing; it disappears from the public catalog.
9. As Riya, verify Arjun's pending Materials Lab Certification.
10. Try `/owner/requests` as a student; you are redirected to dashboard.
11. Toggle light/dark; resize to mobile; navigate the menu by keyboard.

## Test hygiene

- Tests use fixed clocks or seeded relative times; they do not wait on wall-clock
  hours except the E2E check-in window (15 minutes ahead).
- In-memory DBs are closed in `afterEach`.
- E2E database prep is destructive only to `data/e2e.db`.
- There are no sleeps in unit/integration tests. Playwright auto-waits on
  assertions.
- The Vitest config emits a benign Vite warning about ESM syntax in a
  CommonJS-loaded config. It does not affect results; changing module settings is
  deferred to avoid destabilizing Next's build.
