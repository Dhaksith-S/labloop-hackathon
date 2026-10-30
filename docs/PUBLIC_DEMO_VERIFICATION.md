# Public judge demo: executed evidence

**30 October 2026 - prior-host public workflow/security checks passed; new-host
reconnection approval and public retests are pending.** Do not describe all
deployment acceptance checks as complete yet.
The user recreated the tunnel while reporting the restart, so the previous
hostname is obsolete and the same-URL restart/mobile checks are unverified.
The app is stopped, the new origin is pinned, and sessions/history/secret are
preserved. Public transport, saved-session restart and phone checks must pass
after approved reconnection with the validated HTTPS-upgrade fix.

New URL awaiting reconnection approval:
<https://headline-anticipated-trips-salaries.trycloudflare.com>
Registered connector/readiness and normal TLS are verified; gateway 502 is
expected while app/ingress are stopped. The executed public checks below used
`https://complexity-headphones-normal-nut.trycloudflare.com` before recreation.

This is the existing Next.js production build and persistent SQLite application,
served from the owner's Windows laptop through a manually started, accountless
Cloudflare Quick Tunnel. No paid resource, service installation, power change or
Supabase migration was created. Tailscale Funnel remains disabled.

## Exact configuration prepared for reconnection

```text
Public HTTPS :443, exact headline-anticipated-trips-salaries.trycloudflare.com
  -> manually started cloudflared 2026.10.6
  -> filtered ingress 127.0.0.1:3211 (Cloudflare exact-Host mode)
  -> Next.js production 127.0.0.1:3210
  -> %LOCALAPPDATA%/LabLoop/judge-demo/fictional-judge.db
```

- Existing build retained: `itApzfwuOZ96pav7ZpWPX`; no development server used.
- Exact configured HTTPS origin; no Server Actions wildcard/allowedOrigins
  exception. Incoming Host and mutation Origin are checked before forwarding.
- Session secret persists encrypted with Windows DPAPI, with private runtime ACL.
  Secure/HttpOnly/SameSite=Lax cookies were checked in the public browser.
- App and ingress bind loopback. Tunnel metrics bind only `127.0.0.1:3212`;
  `/metrics` is not forwarded by the public ingress.
- Only fictional student/owner demo credentials are available for public use.
  The manager account's shared seed password is locked in this isolated DB;
  privileged sessions are revoked. Manager/administrative workflows remain local
  capabilities, not part of the public judge demonstration. The existing manager
  demo-picker button will not authenticate on this public store.

## Executed checks

This table preserves genuine prior-host results; it does not claim a public
application pass at the new hostname before approval/retesting.

| Check | Result / evidence |
| --- | --- |
| Real public production journey | Passed at 2026-10-30 13:57:09 UTC / 19:27:09 IST after manager credential hardening |
| Network path | `public-cloudflare` verifier mode, actual HTTPS URL, no Playwright interception or resolver override; normal browser TLS validation |
| Discovery/authentication | Public catalog, anonymous booking guard, student and owner login passed |
| Custody lifecycle | Student request, owner eligibility review/approval, check-in, initial report, final return report, independent owner confirmation and completed timeline passed |
| Concrete fictional record | `/bookings/b63ffce7-bedd-4432-9dbc-471b5f100dd2`, visible to the borrower and owner after login |
| Restricted paths | `/admin`, `/.env.local`, `/.git/config`, `/api/debug`, `/__nextjs_original-stack-frame`, `/_next/webpack-hmr`, `/metrics`: HTTP 404 |
| Origin boundary | Foreign-Origin and Origin-less POSTs to `/login`: HTTP 403 |
| Response security | HSTS `max-age=86400`, CSP frame-ancestors/base-uri/object-src, nosniff and frame denial present |
| Privileged credential boundary | Real public manager login using the published seed password rejected; no session issued |
| Source validation | 55 Vitest tests across 6 files, typecheck, lint and PowerShell helper syntax passed |
| HTTP upgrade | A later plain-HTTP GET returned 200; validated source now redirects reads to exact HTTPS and rejects plaintext POSTs. Public retest pending manual reload |
| Fresh backup restore | `judge-20261030T135826191Z.db` restored to a fresh private file: integrity ok, completed booking, 2 condition reports, 6 booking events and manager credential lock present |
| Preservation | Original `data/labloop.db` SHA-256 unchanged; DPAPI secret file and production BUILD_ID unchanged |
| App restart through same public URL | Pending manual app-only restart and public `--revisit` |
| Independent off-tailnet device | Pending user phone test on mobile data with Wi-Fi/Tailscale disabled |

The original five standard Playwright tests passed earlier; they were not rerun
for these operations-only changes. The production browser journey above was
executed against the real public app after the credential hardening.

A repeat browser run between two successful public journeys reached completed
custody in SQLite but did not finish successfully. Its original error/stage was
not retained, so the cause is unclassified. Read-only public inspection showed
the completed record and both reports; a fresh full journey then passed. The
verifier now records sanitized failure stage/summary privately, while suppressing
raw request headers. Do not claim the intermittent failure was diagnosed or fixed.

Earlier attempts are preserved in the [Cloudflare runbook](CLOUDFLARE_QUICK_TUNNEL.md):
the first allocated tunnel exited, causing public 530/error 1033 while the app
worked locally. The previous hostname is expired and must not be submitted.
The recovered tunnel was verified registered, ready and connected before use.

## Judge walkthrough and scope

Open `/login`; use fictional student `priya@labloop.demo` and resource owner
`owner@labloop.demo`, password `LabLoop!2026`. Use Priya for a fresh walkthrough.
Do not choose the manager account on the public demo.

1. Priya discovers Open Maker Bench 04, reviews its rules/standing, requests an
   available slot starting approximately 15 minutes ahead and acknowledges rules.
2. Owner opens the request queue, reviews the request and approves with a reason.
3. Priya checks in, records initial condition, then submits the return/final report.
4. Owner confirms the hand-back. Both parties can inspect the completed timeline
   and both immutable condition reports. The concrete record above is also available.

All records are fictional and persistent; do not enter personal or confidential
information. Do not reset/reseed the database between judges. The startup helper
rechecks privileged demo credentials idempotently before starting the public app.

## Uptime, restart and recovery

Keep the cloudflared PowerShell window, laptop and internet connection running.
No sleep/lid/power settings or unattended startup were changed. This is a
temporary judge demo, with no uptime guarantee. Its URL changes when the tunnel
is recreated; the current URL must be kept alive throughout judging.

An app-only restart uses `scripts/funnel/judge-demo.ps1 -Action Stop`, then
`-Action Start`, keeping cloudflared alive. The helper preserves the DB/secret and
uses the saved exact origin. `Stop` does not stop cloudflared. Pending public
restart verification must establish the same tunnel identity/URL and saved session.

After a Windows/tunnel restart, manually allocate a new URL with the app stopped,
pin/review its exact hostname, configure `-Provider Cloudflare`, start production
and retest. Update judge links if the URL changed. Do not promise hostname
stability across tunnel recreation. See the detailed runbook for the supported
command, private process identity tracking and approval history.

Private diagnostic/session/backup evidence stays under `%LOCALAPPDATA%/LabLoop`;
no database, cookie, DPAPI secret, API key or raw private log belongs in Git.
