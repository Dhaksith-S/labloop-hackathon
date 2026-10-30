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
- All 29 Vitest tests, 3 Playwright E2E tests, typecheck, lint and production
  build passed on this date.
- **Not deployed.** No public URL. See `README.md` and
  `docs/CODEX_HANDOFF.md` before touching deployment claims.
- `supabase/` is a **prepared, unapplied, unverified** PostgreSQL + RLS port.
  Do not describe it as the running backend.

## Commands

```bash
npm run dev          # predev runs setup-db; http://localhost:3000
npm run build
npm start            # prestart runs setup-db
npm run typecheck
npm run lint
npm test             # Vitest, 29 tests
npm run test:e2e     # prepare-e2e (data/e2e.db) then Playwright on :3100
npm run db:setup     # idempotent; seeds only when profiles table is empty
npm run db:reset     # deletes and reseeds data/labloop.db
```

Never run `db:reset` or `prepare-e2e` if the user has data they might need; the
scripts refuse paths that do not end in `.db`, but they still delete that file.

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

Do not claim deployment, a public URL, Supabase verification, RLS coverage, or
storage uploads. Those do not exist. If asked to deploy:

1. Get explicit authorization and credentials.
2. Choose a persistent store (Supabase/Postgres port or a persistent volume).
3. Port data access, auth and seed; run the RLS matrix in `docs/SECURITY.md`.
4. Set `LABLOOP_SESSION_SECRET` and HTTPS cookies.
5. Only then run a deployment and record the real URL and command output.

Detailed continuation plan: `docs/CODEX_HANDOFF.md`.

## Next.js rule

Follow the generated Next.js block at the top of this file. This project uses
Next 16 conventions (async `cookies()` / `searchParams`, Server Actions,
Turbopack). Read `node_modules/next/dist/docs/` before assuming an older API.
