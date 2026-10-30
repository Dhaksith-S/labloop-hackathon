# Architecture

LabLoop is a maintainable monolith: one Next.js application, one relational
database, and domain rules expressed in ordinary TypeScript that both pages and
tests can call. It is intentionally not a microservice system.

> **Runtime truth:** the shipped backend is SQLite via `better-sqlite3`. The
> Supabase/PostgreSQL files in `supabase/` are a prepared port, not the running
> system.

## 1. System context

```
┌─────────────────────────────────────────────────────────────────────┐
│ Browser                                                             │
│  Public catalog · auth forms · workspace · owner studio · admin    │
└───────────────────────────────┬─────────────────────────────────────┘
                                │ HTTPS (local: HTTP)
┌───────────────────────────────▼─────────────────────────────────────┐
│ Next.js 16 server (Node runtime)                                    │
│                                                                     │
│  App Router pages (RSC)          Server Actions ("use server")      │
│  ├─ marketing / auth             ├─ auth.ts                         │
│  ├─ dashboard / bookings         ├─ bookings.ts                     │
│  ├─ owner studio                 ├─ resources.ts                    │
│  └─ admin / activity             └─ qualifications.ts               │
│                                                                     │
│  Domain services                                                    │
│  ├─ bookings.ts       lifecycle, authz, waitlist, custody           │
│  ├─ eligibility.ts    deterministic rules + queue position          │
│  ├─ state-machine.ts  legal transitions + check-in window           │
│  ├─ incidents.ts      report/review, no self-review                 │
│  ├─ qualifications.ts human verification                            │
│  ├─ events.ts         timeline + audit + notifications              │
│  └─ auth.ts           scrypt + HMAC session tokens                  │
└───────────────────────────────┬─────────────────────────────────────┘
                                │ synchronous SQL, prepared statements
┌───────────────────────────────▼─────────────────────────────────────┐
│ SQLite (WAL, foreign_keys=ON)                                       │
│  schema + append-only triggers + overlap triggers + seed            │
└─────────────────────────────────────────────────────────────────────┘
```

No external API, queue, object store or email provider is required to run the
demo. No condition photo is uploaded; `photo_url` exists in the model but the UI
does not claim an upload feature.

## 2. Rendering and request flow

- **Public pages** (`(marketing)`) are server-rendered from SQL. The catalog only
  returns `status = 'active'` resources. Paused and archived listings stay out of
  discovery but remain in custody history.
- **Auth pages** validate with Zod, hash or verify with scrypt, create a session
  row, set an HttpOnly cookie, then redirect.
- **Workspace pages** (`(app)`) call `requireUser(nextPath)`; the layout resolves
  the first active membership and builds role-aware navigation. A page redirect
  is convenience only — services re-check permissions.
- **Server Actions** parse `FormData` with Zod, call a domain service, then
  `revalidatePath` and either return field errors or redirect. There is no
  separate REST API in this build.
- **Mutations** run inside `db.transaction(...).immediate()` when they touch more
  than one row (booking + timeline + audit + notification). `immediate()` takes
  the write lock up front to avoid SQLite upgrade deadlocks.

The synchronous SQLite driver is safe here because the app is a single Node
process. It is the main reason the app is not directly serverless-deployable.

## 3. Data model

| Table | Purpose | Key constraints |
| --- | --- | --- |
| `organizations` | Fictional institution, timezone, location | unique slug |
| `profiles` | Person + scrypt password hash | unique case-insensitive email |
| `organization_members` | Role (`student/owner/manager/admin`), status | unique org+user |
| `resources` | Listing, rules, duration cap, fair-use cap | status enum, positive limits |
| `resource_requirements` | Membership/qualification/training requirements | optional vs required |
| `user_qualifications` | Credential claims + human verification | reviewer, expiry, status |
| `availability_windows` | Weekly bookable minutes in IST | weekday 0–6, end > start |
| `resource_blackouts` | Maintenance closures | start < end |
| `bookings` | Request + custody state, decision evidence | state enum, start < end |
| `booking_events` | Append-only human-readable timeline | triggers reject update/delete |
| `condition_reports` | Append-only check-in/check-out evidence | unique booking+phase, triggers |
| `incidents` | Report, severity, review outcome | reviewer, resolution note |
| `notifications` | Persistent in-app notices | read/unread |
| `audit_events` | Organization-level append-only action log | triggers reject update/delete |
| `sessions` | HMAC hash of opaque token, expiry | token hash indexed/unique |

Timestamps are ISO-8601 UTC strings. Availability minutes and display logic are
interpreted in `Asia/Kolkata` by `src/lib/time.ts`. This avoids depending on the
server's local timezone.

## 4. Booking lifecycle

```
                 ┌──────────┐
    submit ─────▶│ pending  │──── approve ───▶ approved ── check-in ──▶ checked_in
                 └────┬─────┘                     │                        │
                      │ reject                    │ cancel                 │ return
                      ▼                           ▼                        ▼
                 ┌──────────┐               ┌──────────┐            return_submitted
                 │ rejected │               │ cancelled│                    │
                 └──────────┘               └──────────┘                    │ owner confirms
                      │ waitlist                                           ▼
                      ▼                                              ┌───────────┐
                 ┌───────────┐   slot released, eligible            │ completed │
                 │ waitlisted│──────────────▶ pending (human)       └───────────┘
                 └───────────┘
```

- `BOOKING_TRANSITIONS` in `src/lib/state-machine.ts` is the single source of
  legal transitions. Illegal transitions raise `INVALID_TRANSITION`.
- **Overdue is derived**, not stored. `isOverdue()` compares `ends_at` with now
  for `approved`/`checked_in`. This keeps custody states honest.
- **Check-in window:** opens 30 minutes before `starts_at`, closes 120 minutes
  after it. Only the borrower may check in, and only with the rules
  acknowledged.
- **Return:** only the borrower; appends the final condition report.
- **Confirmation:** owner of that resource, or manager/admin of the org, and not
  the borrower. Closes custody.

## 5. Eligibility engine

`evaluateEligibility()` is pure, deterministic, and returns a check list rather
than a boolean alone. Each check has `pass`, `warning` or `fail`, a label and a
human-readable detail. Blocking reasons are shown to the borrower and stored in
the timeline metadata.

Checks, in order:

1. **Resource status** — only active listings accept requests.
2. **Membership** — active membership required; suspended/none fails.
3. **Credential requirements** — exact normalized name match; must be `verified`
   and unexpired. Pending is explicitly not accepted as proof. Optional missing
   credentials warn rather than block.
4. **Time validity** — end after start.
5. **Future window** — at request time the start must be in the future; at
   approval time the window must not already have ended.
6. **Maximum duration** — listing's per-booking cap (1–24 h).
7. **Published availability** — interval must fit the 7-day weekly windows in IST,
   including single-midnight crossings.
8. **Blackout** — any overlap blocks.
9. **Resource conflict** — overlap with `approved`, `checked_in` or
   `return_submitted` blocks.
10. **Borrower conflict** — the borrower's own overlapping custody blocks.
11. **Competing requests** — overlapping `pending`/`waitlisted` requests warn;
    they do not block, because the owner decides among competing demand.
12. **Fair-use cap** — count of the borrower's non-expired `pending`, `waitlisted`
    and `approved` rows for that resource must stay below the listing cap.
13. **Approval mode** — excludes the booking being decided from its own conflicts.

There are two modes:

- `request`: future start required, run before insert.
- `approval`: window may already be underway, still cannot have ended; run again
  when an owner approves or when a waitlist candidate is reopened.

## 6. Waitlist fairness mechanism

- Waitlist order is `created_at` ascending, scoped to the resource.
- Position is computed on read, not stored, so it cannot drift.
- When an **approved** booking is cancelled and its window is still in the future,
  `promoteWaitlistCandidate()` scans overlapping `waitlisted` rows in order.
- Each candidate is re-checked with the full eligibility engine, excluding
  itself.
- The first eligible candidate returns to `pending`, with `decided_by` cleared,
  a `waitlist_review_opened` timeline event, an audit row and notifications to
  both borrower and staff.
- It is **not** approved. The owner still makes the decision.
- Ineligible candidates are skipped, not silently approved.
- Current limitation: reopening runs on cancellation, not on a background timer.
  Expiry/reminder scheduling is a documented next step.

## 7. Authentication and authorization

- Passwords: Node `scrypt`, 16-byte random salt, 64-byte derived key, stored as
  `scrypt$salt$hash`. Verification is `timingSafeEqual`. Unknown accounts still
  perform a dummy derivation.
- Sessions: 32 random bytes, returned to the browser; only an HMAC-SHA-256 hash
  is stored in `sessions`. TTL is 14 days. Expired rows are cleaned on login.
- Cookie: `labloop_session`, HttpOnly, SameSite=Lax, `Secure` in production
  unless explicitly disabled for local HTTP.
- Login throttling: in-process map, 8 attempts per 15 minutes per email. This is
  per-process only and resets on restart; a production deployment needs a shared
  limiter.
- Authorization matrix:

| Capability | Student | Resource owner | Manager | Admin |
| --- | --- | --- | --- | --- |
| Browse public catalog | yes | yes | yes | yes |
| Request a resource | yes | yes (not own review) | yes | yes |
| Decide request | no | only own resources | all org | all org |
| Confirm return | no | only own resources | all org | all org |
| Create/edit listing | no | own/org listings | all org | all org |
| Review incident | no | own resources, not own report | all org, not own report | all org |
| Verify qualification | no | no | yes | yes |
| Organization overview | no | no | yes | yes |

Self-approval and self-return-confirmation are rejected even for managers and
admins. Owners are not implicitly managers of the whole organization.

## 8. Integrity layers

1. **UI** hides impossible actions for clarity.
2. **Server Action** validates shapes with Zod and requires a session.
3. **Domain service** re-checks role, ownership, state transition, eligibility
   and required reasons.
4. **Transaction** writes booking + timeline + audit + notification atomically.
5. **Database trigger** rejects updates/deletes on history tables and rejects
   overlapping custody rows even if application code is bypassed.
6. **PostgreSQL path** adds an exclusion constraint (`tstzrange &&`) and trigger
   functions that apply to `service_role` as well.

The overlap check is intentionally in both service and database layers: the
service produces a useful message; the database closes the race.

## 9. UI architecture

- Server Components fetch data; small client components handle theme, mobile
  menu, demo picker and form pending state.
- Design tokens live in `src/app/globals.css` (light/dark variables, type scale,
  grain, surfaces). Fonts are bundled locally through Fontsource.
- Shared primitives: `Button`, `Badge`, `Field/Input/Select/Textarea`, `Card`,
  `Alert`, `EmptyState`, `PageHeader`, `StatCard`, `Avatar`.
- Accessibility: semantic headings and lists, labelled form fields, visible
  focus styles, `aria-current` navigation, status text in addition to color,
  reduced-motion media query, skip link, responsive layout down to mobile.
- No stock photography. Listing art is deterministic CSS/SVG by category.

## 10. Supabase port plan

The prepared path is documented in `supabase/README.md`. In order:

1. Create a project; apply both migrations.
2. Replace `src/lib/database.ts` and the synchronous prepared statements with an
   async PostgreSQL client.
3. Replace `src/lib/auth.ts` with Supabase Auth; map `profiles.id` to
   `auth.users.id`.
4. Rewrite the seed and scripts for Postgres; never run demo seed in production.
5. Add storage policies before enabling condition photos.
6. Run the RLS matrix in `docs/SECURITY.md` with anon, student, owner, manager
   and service-role clients.
7. Load-test overlapping approvals to confirm the exclusion constraint behaves
   under concurrency.

Until steps 1–7 are executed against a real project, the Supabase path remains
unverified SQL.

## 11. Deliberate trade-offs

| Decision | Why | Cost |
| --- | --- | --- |
| SQLite monolith | Zero external dependencies, real persistence, judge can run offline | Not serverless-deployable as-is |
| Synchronous DB calls | Simple, transactional, fast local tests | Blocking I/O; needs async port for Postgres |
| Self-hosted auth | Runs without Supabase credentials; demonstrates security reasoning | No email verification, reset, OAuth or MFA |
| No upload pipeline | Avoids fake storage claims | Condition evidence is text-only |
| Single-capacity resources | Matches the equipment brief | No quantity/seat inventory |
| In-process rate limit | Adequate for a single demo process | Not distributed |
| No background scheduler | Keeps demo deterministic | Waitlist reopening only on cancellation; no auto-expiry |

These are documented limitations, not hidden claims.
