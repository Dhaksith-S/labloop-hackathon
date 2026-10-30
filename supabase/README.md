# Supabase deployment path — prepared, not applied

> **Status: unverified and not wired to the application.**
> No Supabase project, database password, API keys or CLI authorization were
> available in this workspace. These files have **never been executed against
> PostgreSQL**, so they are a prepared migration path, not a tested deployment.

The runnable LabLoop application uses a persistent SQLite database through
`better-sqlite3` (`src/db/sqlite-schema.sql`, `src/lib/database.ts`). That is the
store every test, seed and local run exercises.

This directory contains the equivalent PostgreSQL model for a future Supabase
port:

| File | Purpose |
| --- | --- |
| `migrations/20261030000100_initial_schema.sql` | Tables, checks, indexes, updated-at triggers, append-only triggers, GiST exclusion constraint for booking conflicts, and the `auth.users` → `profiles` trigger. |
| `migrations/20261030000200_rls_policies.sql` | Helper functions, RLS enablement, grants and row policies for every table. |

## What the SQL is designed to do

- `bookings_no_overlap` uses a PostgreSQL `exclude` constraint on
  `tstzrange(starts_at, ends_at, '[)')` for custody-bearing statuses, so two
  concurrent approvals cannot double-book a resource even if application code
  races.
- `audit_events`, `booking_events` and `condition_reports` reject `update` and
  `delete` in triggers. This applies to the table owner and `service_role` too,
  unlike a policy-only approach.
- RLS lets anonymous visitors read only active listings and their public
  configuration. Participants read their own bookings; owners and managers read
  bookings for resources they manage.
- Authenticated clients receive **no** `INSERT`/`UPDATE`/`DELETE` grant on
  lifecycle tables. The only client mutation is updating `notifications.read_at`
  on your own row. Lifecycle transitions, eligibility, waitlist promotion and
  audit writes run in trusted server code with the service role. The runnable
  implementation keeps those rules in `src/lib/bookings.ts`,
  `src/lib/eligibility.ts` and `src/lib/incidents.ts`.

## Why this is not wired in

Porting the application would require replacing more than a connection string:

1. `src/lib/database.ts` and every `db.prepare(...)` call use synchronous
   `better-sqlite3`. Supabase requires an asynchronous PostgreSQL client.
2. `src/lib/auth.ts` implements scrypt passwords and opaque session cookies.
   Supabase Auth should replace it, with `profiles.id` referencing
   `auth.users.id`.
3. The demo seed writes SQLite-specific SQL and fixed IDs. A PostgreSQL seed
   must be rewritten and must never run against production.
4. Storage-backed condition photos are modelled (`photo_url`) but not uploaded
   in this build. No bucket or storage policy is claimed to exist.

## If you have Supabase credentials

These commands are **not verified** in this workspace and are provided as the
intended path:

```bash
# 1. Link a project (requires an access token and project ref).
npx supabase login
npx supabase link --project-ref <project-ref>

# 2. Review first; this has never run here.
npx supabase db push

# 3. Regenerate types (optional, after the port).
npx supabase gen types typescript --linked > src/lib/supabase-types.ts
```

Then complete the port above and run the RLS matrix in
[`../docs/SECURITY.md`](../docs/SECURITY.md) with real clients:

- anonymous catalog read succeeds for active resources and fails for paused ones;
- student A cannot read student B's booking, condition report or notification;
- an owner cannot read another owner's resource bookings;
- a manager can read organization bookings but cannot bypass append-only triggers;
- a manager cannot review their own incident;
- a non-manager cannot verify a qualification;
- two concurrent approvals for the same window: exactly one succeeds;
- `service_role` can still not update or delete audit rows.

Until that matrix has run against a real project, treat these migrations as
review-ready SQL, not as a deployed backend.
