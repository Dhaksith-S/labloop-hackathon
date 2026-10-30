<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# LabLoop — agent guidance

This file is for coding agents working in this repository. It describes what is
real, what is prepared, and which invariants must not be broken.

## Current state (30 Oct 2026)

- Runnable monolith: Next.js 16 App Router + SQLite (`better-sqlite3`).
- Demo institution: fictional **Northstar Institute of Applied Technology**.
- Independently reverified: 44 Vitest tests, 5 Playwright E2E tests, typecheck,
  lint and production build. Local production restart/session/booking and
  backup checks also passed; see `docs/VERIFICATION.md`.
- Subsequent Funnel preparation: 48 Vitest tests and 5 E2E tests passed; existing
  production artifact retained. Isolated judge data is outside OneDrive. Tailscale
  1.104.4 installation and user sign-in are verified. The actual assigned origin
  is configured and tested locally. The user approved the exact Funnel route and
  enabled HTTPS/Funnel. CLI setup succeeded, but public verification timed out;
  the route was disabled and final status is `{}`. Do not automatically re-enable.
  That Funnel route is not working. See `docs/TAILSCALE_FUNNEL.md`.
- Configured Cloudflare origin: `https://headline-anticipated-trips-salaries.trycloudflare.com`.
  Its connector/TLS are verified, but app reconnection approval is pending.
  The previous `complexity-...` hostname is obsolete. On that previous route, real public
  custody/security checks and fresh backup restore pass. Latest 55 Vitest tests,
  typecheck/lint pass; original production artifact retained. App-only restart and
  independent mobile-data checks are pending. Do not claim all acceptance passed.
  See `docs/PUBLIC_DEMO_VERIFICATION.md` and `docs/CODEX_HANDOFF.md`.
- A subsequent HTTP probe found plaintext pages were served. Validated ingress
  source now upgrades HTTP reads and rejects plaintext POSTs; app/ingress are
  paused pending the requested manual restart and real transport/session retest.
  Keep cloudflared alive; its exact hostname has not changed.
- Public manager seed credentials are locked only in the isolated judge DB;
  student/owner accounts and history are preserved. Startup runs
  `scripts/harden-judge-demo.ts` idempotently. Do not restore shared privileged
  credentials or expose administrative workflows.
- Sessions/bookings/events/reports/audit and the DPAPI secret were verified
  unchanged while configuring the new hostname with the app stopped.
- Keep the current manually started cloudflared process/window alive. Recreating
  it changes the hostname. No power, service or unattended-startup change is approved.
- **Source is public** at
  <https://github.com/Dhaksith-S/labloop-hackathon>, branch `main`. A public
  repository is not a deployed application.
- `supabase/` is a **prepared, unapplied, unverified** PostgreSQL + RLS port.
  Do not describe it as the running backend.

## Commands

```bash
npm run dev          # predev runs setup-db; http://localhost:3000
npm run build
npm start            # prestart runs setup-db
npm run typecheck
npm run lint
npm test             # Vitest, 55 tests (44 baseline + 9 ingress + 2 judge-account tests)
npm run test:e2e     # prepare-e2e (data/e2e.db) then Playwright on :3100
npm run db:setup     # idempotent; seeds only when profiles table is empty
npm run db:reset     # deletes and reseeds data/labloop.db
npm run db:backup -- data/backups/UNIQUE.db  # WAL-safe; refuses overwrite
npm run start:production  # guarded configuration; real persistent mount required
npm run verify:production # requires build; creates isolated private fixture
```

Never run `db:reset` if the user has data they might need. E2E preparation now
refuses every target except the resolved `data/e2e.db`, and refuses production.
It still deletes that dedicated fixture: preserve valuable E2E records first.

## Architecture map

| Concern | File |
| --- | --- |
| DB connection + schema load | `src/lib/database.ts`, `src/lib/db.ts` |
| Runnable schema + triggers | `src/db/sqlite-schema.sql` |
| Booking lifecycle services | `src/lib/bookings.ts` |
| Eligibility + waitlist ordering | `src/lib/eligibility.ts` |
| Explicit state machine + check-in window | `src/lib/state-machine.ts` |
| Incident reporting/review | `src/lib/incidents.ts` |
| Qualification verification | `src/lib/qualifications.ts` |
| Audit/timeline/notifications | `src/lib/events.ts` |
| Auth + session | `src/lib/auth.ts`, `src/lib/password.ts` |
| Server actions | `src/lib/actions/*.ts` |
| Demo data | `src/lib/demo/seed.ts` |
| RLS/schema port | `supabase/migrations/` (unapplied) |

UI routes live under `src/app/(marketing)`, `(auth)` and `(app)`. Shared
components are in `src/components`.

## Non-negotiable domain invariants

1. **Authorization is server-side.** Page redirects are UX only. Every mutation
   must call `requireUser()` and then the service function, which re-checks
   membership, role and resource ownership.
2. **Eligibility never auto-approves.** A passing request enters `pending`.
   Approval re-runs eligibility in `approval` mode.
3. **No self-dealing.** An owner cannot decide their own request or confirm their
   own return (`SELF_APPROVAL`). An incident reporter cannot review that
   incident (`SELF_REVIEW`).
4. **No double booking.** Application checks plus SQLite triggers reject
   overlapping approved/checked-in/return-submitted rows. PostgreSQL uses a
   `tstzrange` exclusion constraint. Do not weaken either.
5. **History is append-only.** `audit_events`, `booking_events` and
   `condition_reports` reject UPDATE/DELETE through SQLite triggers. Add a
   correcting record; never rewrite history.
6. **Waitlist is transparent and human-final.** Queue order is `created_at`.
   Releasing an approved slot promotes the first *eligible* overlapping request
   back to `pending` for review, never to `approved`.
7. **Time handling.** Persist ISO-8601 UTC; interpret availability and display in
   `Asia/Kolkata` through `src/lib/time.ts`. Do not use server-local time.
8. **Validation at the boundary.** Every server action parses with Zod; services
   still enforce domain rules because actions are not the only caller.
9. **Demo data is fictional and idempotent.** The seed returns early if any
   profile exists. Do not overwrite judge-created records.
10. **No fake metrics.** Dashboard/stat numbers come from SQL. Do not add
    decorative counts, testimonials, logos, or "trusted by" claims.

## Testing expectations

- Pure rules → `tests/eligibility.test.ts` with a fixed clock.
- Lifecycle/integrity → `tests/lifecycle.test.ts` against a fresh in-memory
  seeded DB.
- User-visible flow → `e2e/labloop.spec.ts` against `data/e2e.db`, port 3100.
- Run at minimum: `npm test && npm run typecheck && npm run lint`.
- Run E2E for any routing, form, auth or booking UI change.
- After deleting routes, remove `.next` before typechecking if stale generated
  types appear.
- Tests must not touch `data/labloop.db`.

## Environment

Copy `.env.example` to `.env.local` only when needed. Important variables:

- `LABLOOP_DB_PATH` (default `data/labloop.db`)
- `LABLOOP_SESSION_SECRET` — **required** in production, 24+ chars
- `LABLOOP_INSECURE_COOKIES=1` only for local `next start` over HTTP
- `LABLOOP_SEED_DEMO=0` to suppress demo seeding
- `NEXT_PUBLIC_APP_URL`

Production fails closed without a session secret. Do not add a fallback secret.

## Deployment reality

Only claim checks recorded in `docs/PUBLIC_DEMO_VERIFICATION.md`. The current
public demo is under acceptance; Supabase/RLS and storage uploads are unverified.
For deployment changes:

1. Get explicit authorization and credentials.
2. Choose a persistent store (Supabase/Postgres port or a persistent volume).
3. For Postgres, port data access/auth/seed and run the RLS matrix. For SQLite,
   verify the actual volume mount, one instance, restart durability and backups.
4. Set `LABLOOP_SESSION_SECRET` and HTTPS cookies.
5. Only then run a deployment and record the real URL and command output.

Detailed continuation plan: `docs/CODEX_HANDOFF.md`.

The user authorized the previous Cloudflare app route and tests, **no paid resources**.
They explicitly requested approval before connecting the new `headline-...` URL;
a combined approval/conditional manual-start question is pending. Do not connect
the app without that reply. Automated tunnel
and app starts were rejected by automatic review; user manual starts resolved
those actions. Do not retry rejected launches through another tool/wrapper.
`deploy/render.yaml` is a paid template, unapplied. See `docs/DEPLOYMENT.md`.
Official brief/rubric: `docs/OFFICIAL_PROBLEM_STATEMENT.md`. Report/PDF remain
provisional pending the official template and verified participant information.
Never submit the form automatically.

## Next.js rule

Follow the generated Next.js block at the top of this file. This project uses
Next 16 conventions (async `cookies()` / `searchParams`, Server Actions,
Turbopack). Read `node_modules/next/dist/docs/` before assuming an older API.
