# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions use semantic
versioning for the application.

## [Unreleased] - 2026-10-30 Codex takeover

### Cloudflare fallback - approved software/local preparation only

- Manual app startup subsequently succeeded and local filtered catalog returned
  200. Public catalog failed with 530/error 1033: no cloudflared process or
  readiness listener remained. Process exit cause unknown. Stopped app/ingress;
  all judge ports closed, original DB/build preserved, recovery allocation pending.

- User manually allocated `https://underlying-living-milton-estimated.trycloudflare.com`.
  Verified exact process/target, loopback metrics/readiness and normal public TLS
  with expected 502 while disconnected. Backed up and pinned the exact profile.
- Exact app connection/public tests approved; automated app start separately
  rejected by review (`blocked by policy`, no additional reason). App/ingress
  remain stopped; manual app start is pending. No public app success claimed.

- Subsequent URL-allocation-only approval received. Automatic approval review
  rejected the automated launch (blocked by policy, no additional reason).
  App/ingress were stopped separately; ports 3210/3211/3212 are closed, no
  cloudflared process runs, Funnel remains off. Manual allocation is next;
  connecting LabLoop remains separately unapproved.

- Reverified official portable cloudflared 2026.10.6 checksum/signature; version
  and CLI help executed after approval. No tunnel/account/service was started.
- Added explicit Cloudflare exact-Host ingress mode, provider-specific origin
  validation, forwarding/identity-header sanitization and local verifier mode.
  Kept Tailscale default and Next.js configuration unchanged.
- Latest 51 tests, typecheck/lint, Cloudflare-mode production custody journey,
  restart/session persistence and fresh backup restoration pass locally.
- Fixed verifier route-cleanup race and raw header error output; revoked the one
  affected fictional session. Acceptance now records only after clean teardown.
- Original DB, saved profile, DPAPI secret and production build preserved.
  Funnel remains off; no Cloudflare URL allocated. App-exposure approval remains.

### Approved Funnel attempt (disabled after failed public verification)

- User approved the exact HTTPS hostname/443 -> loopback 3211 -> production
  3210 configuration and enabled HTTPS/Funnel in Tailscale's website.
- Official CLI accepted the background route and issued
  `https://dhaksith.tail3cd298.ts.net/`. Initial public curl and browser catalog
  probes timed out. No public lifecycle completed and no working URL is claimed.
- Disabled Funnel as requested; final status `{}`. Local catalog still HTTP 200,
  original DB hash unchanged; isolated judge records and secret preserved.
- Later read-only diagnostics resolved both public relay addresses and connected
  to TCP 443. Root cause remains unconfirmed; no ISP/provider/app blame inferred.
- Updated deployment docs and provisional report with this failed attempt.
  Cloudflare Quick Tunnels remains an unapplied, separately approved fallback.

### Subsequent zero-cost Funnel preparation (before public attempt)

- User completed Tailscale installation and GitHub SSO; CLI version 1.104.4,
  online device and empty Serve/Funnel configurations independently confirmed.
- Added configured-hostname loopback verification (`--loopback`); actual
  production custody, restart/session persistence and backup restoration pass.
- Reran 48 tests, typecheck and lint. Public verification remained pending at
  that stage; the later approved attempt and shutdown are recorded above.

- Retained the verified production build; added selectable loopback binding,
  exact-origin filtered ingress and private Windows judge-demo operations.
- Created a fictional judge DB outside OneDrive, persistent DPAPI session secret,
  restricted runtime ACL, restart helper and tested online backup/restore.
- Four ingress tests added: 48 Vitest tests and 5 browser tests pass; typecheck
  and lint pass. Actual local proxy custody journey and restart persistence pass.
- Verified official Tailscale MSI signature/hash; initial automatic installation
  was rejected by approval review; subsequent manual installation/sign-in are verified.
- No exposure occurred during that preparation stage. No paid resource,
  system power change or startup task was created.

### Fixed and verified

- Preserved the four interrupted documentation edits and private recovery copies.
- Denied direct student access to staff booking/incident/audit listing services.
- Scoped multi-organisation owner queues/listings and denied suspended staff reads.
- Rechecked current database membership before taking custody, preventing check-in
  after suspension while preserving the ability to return equipment.
- Rejected browser-normalized external/control-character login redirect targets.
- Added an overlap trigger for resource reassignment, including existing SQLite stores.
- Restricted destructive E2E preparation to its dedicated fixture and non-production execution.
- Made login/signup primary headings visible on mobile.
- Independently passed 44 Vitest tests, 5 Chromium browser tests, typecheck, lint
  and production build. Local production browser custody, Secure cookie, process
  restart persistence and backup integrity also passed.

### Prepared

- Guarded production startup, WAL-safe backup/restore and repeatable local restart verification.
- Single-instance persistent SQLite deployment template and operational runbook.
  The paid template is unapplied; no paid resources are authorized or created.
- Authoritative organiser brief transcription, exact seven-criterion traceability,
  comprehensive provisional report/PDF, team/contribution placeholders and AI disclosure.

### Still pending

- Authorized hosting/public URL and public full-flow/restart checks.
- Official PDF template, verified participant details, human review and individual submissions.
- Supabase/PostgreSQL execution and RLS verification (alternative route, deferred).

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
