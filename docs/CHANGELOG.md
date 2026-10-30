# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions use semantic
versioning for the application.

## [1.0.0] — 2026-10-30

First complete hackathon build. Locally runnable; not publicly deployed.

### Added

- Next.js 16 App Router application with marketing, auth and authenticated
  workspace route groups.
- Public resource catalog with search, category filters, resource detail,
  published availability, blackouts, usage rules and required credentials.
- Student workspace: dashboard, bookings, booking detail, activity,
  notifications and profile.
- Owner studio: dashboard, listing management, requests, custody and incidents.
- Manager organization console with SQL-backed counts and credential review.
- End-to-end custody lifecycle: request → approve/reject/waitlist → check-in with
  initial condition → return with final condition → owner confirmation.
- Deterministic eligibility engine with 13 named checks and pass/warning/fail
  explanations.
- Approval-time eligibility re-check and fair-use caps.
- Transparent waitlist ordering and human-review reopening after an approved slot
  is released.
- Self-approval, self-return-confirmation and self-incident-review rejection.
- Incident reporting and human resolution with mandatory notes.
- Qualification claims and manager/admin verification with expiry.
- Append-only timeline, condition and organization audit records.
- Persistent in-app notifications for decisions, waitlists, custody, incidents and
  credentials.
- scrypt password hashing, HMAC-hashed opaque session tokens, HttpOnly SameSite
  cookies, login throttling and open-redirect protection.
- SQLite schema with foreign keys, WAL mode, append-only triggers and overlapping
  custody triggers.
- Idempotent fictional demo seed for Northstar Institute of Applied Technology,
  five accounts and seven resources.
- Setup, seed, reset and E2E preparation scripts.
- Vitest unit/integration suite (29 tests) and Playwright Chromium suite
  (3 tests).
- Prepared PostgreSQL schema and RLS migrations under `supabase/`, explicitly
  marked unapplied and unverified.
- Documentation: README, architecture, testing, security, fairness, demo script,
  hackathon report, third-party disclosures and Codex handoff.
- Project-specific `AGENTS.md` guidance alongside the generated Next.js block.

### Changed

- Replaced the create-next-app starter README with project documentation.
- Demo oscilloscope custody now ends before Arjun's pending bench request starts,
  removing an artificial borrower conflict at approval time.
- Seeded pending bench request is placed inside the check-in window so a judge
  can approve and check in immediately.
- Added `allowedDevOrigins` for local `127.0.0.1`/`localhost` development.
- Added `data-scroll-behavior="smooth"` to the root `<html>` to match global
  smooth scrolling.
- E2E tests use a separate `data/e2e.db` and port 3100 to protect the demo
  database.
- RLS migration model made read-first: authenticated clients receive no
  lifecycle write grants; mutations are service-role server code.

### Fixed

- Removed E2E flakiness caused by asserting transient success banners after a
  server action; tests now assert durable state after reload.
- Fixed theme-toggle E2E check to wait for hydration via the demo picker.
- Fixed login-redirect assertion to accept the encoded/decoded `next` parameter.
- Corrected test type narrowing for requirement `is_required` (`0 | 1`).
- Corrected ownership-boundary test to use a genuine owner role that does not own
  the resource.
- Corrected qualification verification test to use a manager, not an owner.

### Security

- Production requires `LABLOOP_SESSION_SECRET` (24+ characters); no fallback.
- Session tokens are stored only as HMAC hashes.
- Unknown-account logins still perform a scrypt derivation.
- Security headers added for MIME sniffing, framing, referrer and permissions.
- All SQL uses bound prepared statements.
- Supabase RLS enables read isolation and denies client lifecycle writes until
  the port is verified.

### Tests

- `npm test`: 29 passed.
- `npm run test:e2e`: 3 passed in Chromium.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.

### Deployment

- No public deployment. No Vercel or Supabase authorization was available.
- SQLite is not persistent on serverless hosting; a persistent volume or the
  PostgreSQL port is required.
- `supabase/migrations/` has never been executed against PostgreSQL.

### Known limitations

- No email verification, password reset, MFA or OAuth.
- No photo uploads despite the `photo_url` field.
- No background scheduler for waitlist expiry or reminders.
- No appeal/second-review workflow.
- No automated accessibility, load or cross-browser verification.
- In-process login throttle only.
- No CSP/HSTS at the application layer.
- Single-capacity resources only.

<!--
Future releases: add sections under [Unreleased] using Added / Changed / Fixed /
Security. Do not record a deployment or Supabase verification until it actually
happens.
-->
