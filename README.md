# LabLoop

**Unlock underused equipment and spaces — without losing control of who uses them.**

LabLoop is a complete campus resource-sharing loop for a fictional institution,
Northstar Institute of Applied Technology. Verified owners publish equipment;
students discover it, see exactly which rules they meet, request a slot, and
track a human-reviewed custody record from approval to return.

**Public judge demo:** <https://headline-anticipated-trips-salaries.trycloudflare.com>

**Source repository:** <https://github.com/Dhaksith-S/labloop-hackathon>

> Required public acceptance passed: owner listing through full custody,
> security, same-URL session/history after app restart, fresh backup restore and
> user-confirmed external phone access. The existing production build and SQLite
> run on the owner's laptop through Cloudflare Quick Tunnel. Keep the laptop,
> network and current tunnel window online; no guaranteed uptime. See
> [verified deployment evidence](docs/PUBLIC_DEMO_VERIFICATION.md).
> Supabase schema/RLS remain prepared, unapplied and unverified.

---

## The loop that actually works

1. **Owner lists a resource** — category, location, condition, usage rules,
   weekly availability, maximum duration, fair-use cap and required credentials.
2. **Student discovers it** — public catalog with search, category filters,
   availability and the owner's stated rules.
3. **Eligibility is checked deterministically** — membership, verified and
   unexpired qualifications, duration cap, published hours, blackouts, resource
   conflicts, the borrower's own overlapping bookings and the fair-use cap.
   Every check is shown with a pass / warning / fail reason. Passing never means
   approval; human review is always required.
4. **Owner decides** — approve, reject with a written reason, or waitlist with a
   transparent position. Approval re-runs eligibility at decision time, so a
   request that became invalid cannot slip through.
5. **Borrower checks in** — only inside the check-in window (30 minutes before
   start through 120 minutes after start), only the approved borrower, only
   after acknowledging the rules, with an immutable initial condition report.
6. **Borrower returns** — final condition, accessories status and notes are
   appended as a second immutable condition report.
7. **Owner confirms the hand-back** — custody closes, the borrower is notified,
   and the complete timeline and organization audit log remain.
8. **Incidents and credentials** — members report incidents; an authorized
   reviewer who did not report the incident records the outcome. Managers verify
   qualifications; members cannot self-certify.

A released approved slot reopens the **first eligible waitlisted request for
human review**. It is never auto-approved.

## Demo accounts

The local development seed creates a fictional institution and five accounts. All use the password
**`LabLoop!2026`**. These credentials are intentionally public demo data.

| Email | Person | Role | Useful for |
| --- | --- | --- | --- |
| `student@labloop.demo` | Arjun Mehta | Student | A pending bench request, live oscilloscope custody, completed history |
| `owner@labloop.demo` | Maya Iyer | Resource owner | Review queue, custody confirmation, listings, incidents |
| `manager@labloop.demo` | Riya Sen | Lab manager | Organization overview, credential verification, all-org review |
| `priya@labloop.demo` | Priya Nair | Student | An existing waitlisted print request |
| `dev@labloop.demo` | Dev Patel | Student | An approved 3D-printer booking |

The login page includes a demo-account picker that fills the form.
For the public judge demo, use `priya@labloop.demo` and `owner@labloop.demo` with
that password. The isolated public store locks the manager's shared credential;
its demo-picker button will not authenticate there. Administrative workflows
are not exposed publicly. The development database is unchanged.

## Quick start

Requirements: **Node.js 24+** and npm (verified with Node 24.18.0). No external services are required.

```bash
npm install
npm run db:setup     # create + seed data/labloop.db (idempotent)
npm run dev          # http://localhost:3000
```

`npm run dev` and `npm start` also run the idempotent setup step automatically.
The SQLite file lives in `data/` and is gitignored. Preserve any judge/user records
with `npm run db:backup -- data/backups/UNIQUE.db` first. Only for a disposable
database, return to a clean demo with:

```bash
npm run db:reset
```

## Five-minute judge walkthrough

1. Sign in as **Priya** and open **Discover → Open Maker Bench 04**. Submit a
   request for a slot starting in ~15 minutes and ending an hour later.
2. Sign out, sign in as **Maya** (owner), open **Requests**, approve it with a
   reason.
3. Sign back in as **Priya**, open the booking, check in with an initial
   condition, then submit the return with a final condition.
4. Sign in as **Maya**, open **Custody**, confirm the return. The timeline,
   condition reports and audit record are complete.
5. As **Maya**, open **Listings → New listing** to publish a resource with rules,
   hours and a required credential.
6. **Local development only:** as **Riya** (manager), open **Organization** to see database-backed counts and
   verify a pending qualification.

The full script, including the seeded pending request and waitlist behaviour, is
in [`docs/DEMO.md`](docs/DEMO.md).

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the Next.js dev server on port 3000 |
| `npm run build` | Production build |
| `npm start` | Serve the production build (runs DB setup first) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | 44 Vitest unit + integration tests |
| `npm run test:watch` | Vitest in watch mode |
| `npm run test:e2e` | Fresh `data/e2e.db`, then 5 Playwright Chromium tests |
| `npm run db:setup` | Create schema and seed only when empty |
| `npm run db:seed` | Seed an empty database |
| `npm run db:reset` | Delete and recreate the demo database |
| `npm run db:backup -- NEW-PATH.db` | WAL-safe backup, integrity check, refuses overwrite |
| `npm run start:production` | Validate production configuration, idempotent setup, start on `$PORT` |
| `npm run verify:production` | Verify an existing production build with a private fixture, browser custody and restart |

## Stack

- **Next.js 16.4.3** App Router, React 19.3, strict TypeScript
- **Tailwind CSS v4** with custom design tokens, light/dark themes, Manrope +
  Newsreader + JetBrains Mono via Fontsource
- **SQLite via better-sqlite3** with WAL mode, foreign keys, transactions and SQL
  triggers for append-only history and overlapping-custody prevention
- **Zod 4** for every form boundary
- **Vitest 5** and **Playwright 1.64** for verification
- Self-hosted auth: scrypt password hashes, HMAC-hashed opaque session tokens,
  HttpOnly SameSite=Lax cookies, server-side role checks

No UI component kit, ORM or external API is used. The visual system is original
CSS, Lucide icons and locally bundled fonts. See
[`docs/THIRD_PARTY_DISCLOSURES.md`](docs/THIRD_PARTY_DISCLOSURES.md).

## Independent verification (Codex takeover, 30 Oct 2026)

| Check | Result |
| --- | --- |
| `npm test` | 4 files, **44 passed** |
| `npm run test:e2e` | **5 passed** in Chromium (catalog/theme, role guard, custody, listing/discovery, phone viewport) |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed |
| `npm run build` | Passed; all application routes compiled |
| `npm run verify:production` | HTTP 200 and security headers; production browser custody, Secure cookie, session/booking/condition persistence after restart; backup integrity |

The E2E suite runs against a separate, freshly seeded `data/e2e.db` on port
3100. It refuses a different reset path, including `data/labloop.db`. Existing
demo data was backed up and preserved during this takeover. Command log and
failures/fixes: [`docs/VERIFICATION.md`](docs/VERIFICATION.md). Coverage mapping:
[`docs/TESTING.md`](docs/TESTING.md).

## Verified public judge demo

<https://headline-anticipated-trips-salaries.trycloudflare.com>

**Required public acceptance checks passed on 30 October 2026:** owner listing
and student discovery, complete request-to-return lifecycle on that same new
resource, HTTPS/security/credential checks, saved session/history after an
app-only restart at the same URL, fresh backup restore, and user-confirmed
external phone/mobile-data access.

Use `priya@labloop.demo` and `owner@labloop.demo`, password `LabLoop!2026`.
Manager shared credentials are locked in the public judge store.
[Executed evidence, screenshot and judge walkthrough](docs/PUBLIC_DEMO_VERIFICATION.md).

The original production build runs on loopback behind filtered ingress and an
accountless Cloudflare Quick Tunnel; fictional SQLite and the DPAPI session
secret persist outside OneDrive. **Keep the laptop, network and cloudflared
window/process online. No guaranteed uptime is claimed.** The URL changes if
cloudflared is recreated or Windows restarts. App-only `RestartApp` preserves the
running tunnel/URL and was verified. [Restart/recovery guide](docs/CLOUDFLARE_QUICK_TUNNEL.md).

Old `underlying-...` and `complexity-...` URLs are obsolete. Tailscale Funnel is
off. No paid hosting, Windows app service, automatic startup task or power change
was created. Render's paid template and Supabase/Postgres port remain unapplied.

## Submission readiness

Latest source checks: **55 tests across 6 Vitest files, typecheck and lint pass**.
The real public production tests and restart/restore evidence are recorded above.
The earlier table records the initial `17fa246` baseline, including five standard
browser tests; those were not rerun for the operations-only changes.

The authoritative organiser brief and 100-point rubric are transcribed in
[`docs/OFFICIAL_PROBLEM_STATEMENT.md`](docs/OFFICIAL_PROBLEM_STATEMENT.md).
[`docs/JUDGING_TRACEABILITY.md`](docs/JUDGING_TRACEABILITY.md) maps all seven
criteria to implementation, tests and gaps. The report and PDF are provisional:
the official template and verified participant/contribution details are pending.
Public demo acceptance is verified. No form has been submitted.
Deadline: **1 November 2026, 10:00 AM IST**.

[Download the provisional report PDF](output/pdf/LabLoop-Provisional-Report.pdf).
Its source is `docs/HACKATHON_REPORT.md`; regenerate with
`python scripts/build-report.py` after installing documentation-only dependencies
`reportlab` and `pymupdf`. The application does not need Python.

## Project map

```
src/app/(marketing)/      public landing, catalog, resource detail, how it works
src/app/(auth)/           login, signup, demo picker
src/app/(app)/            dashboard, bookings, owner studio, admin, activity, profile
src/lib/                  domain rules, eligibility, bookings, incidents, auth, DB
src/lib/actions/          server actions with Zod validation and authz
src/db/sqlite-schema.sql  runnable schema, append-only + overlap triggers
src/lib/demo/seed.ts      idempotent fictional demo data
supabase/migrations/      prepared PostgreSQL schema + RLS (unapplied)
tests/ e2e/               Vitest and Playwright suites
docs/                     architecture, security, fairness, demo, handoff
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Testing](docs/TESTING.md)
- [Security](docs/SECURITY.md)
- [Fairness](docs/FAIRNESS.md)
- [Demo script](docs/DEMO.md)
- [Hackathon report](docs/HACKATHON_REPORT.md)
- [Official brief](docs/OFFICIAL_PROBLEM_STATEMENT.md)
- [Judging traceability](docs/JUDGING_TRACEABILITY.md)
- [Verification log](docs/VERIFICATION.md)
- [Persistent hosting preparation](docs/DEPLOYMENT.md)
- [Third-party disclosures](docs/THIRD_PARTY_DISCLOSURES.md)
- [Changelog](docs/CHANGELOG.md)
- [Codex handoff](docs/CODEX_HANDOFF.md)

## Fictional data notice

Northstar Institute of Applied Technology, every person, email address,
qualification, incident and booking in the seed are fictional. Any resemblance
to a real institution is coincidental. The public demo password exists only for
this fictional dataset.

## License

No open-source license has been selected for this repository. Third-party
packages and fonts remain under their own licenses.
