# Cloudflare Quick Tunnel: local preparation and approval gates

**30 October 2026: software/local preparation verified; URL allocation approved
but automated launch blocked. No tunnel started or Cloudflare URL generated.**
Tailscale Funnel remains disabled after its failed public acceptance test. This
fallback keeps the same production build, fictional judge SQLite database and
persistent DPAPI-protected session secret. No account, service installation,
subscription, power change or database migration is needed for this preparation.

## Verified evidence

| Check | Actual result |
| --- | --- |
| Portable executable | `cloudflared` 2026.10.6, official Windows amd64 release; `--version` and `tunnel --help` executed after user approval |
| Integrity | SHA-256 `d521b3bf68982165f0d06d76732f22d9a105ef057ff3ae4c0986f3a23190950f` matches official release asset digest; Authenticode Valid, Cloudflare, Inc. |
| Executable location | `%LOCALAPPDATA%/LabLoop/installers/cloudflared-2026.10.6-windows-amd64.exe`; no Windows service installed |
| Current automated checks | 51 Vitest tests, typecheck and lint passed; three new tests cover provider validation and Cloudflare host/origin/header boundaries |
| Production build | Existing `.next/BUILD_ID` `itApzfwuOZ96pav7ZpWPX` retained; no development server or rebuild used |
| Local browser journey | Cloudflare Host mode: catalog, anonymous guard, admin denial, student request, owner approval, check-in, initial/final reports, return confirmation, history and Secure/HttpOnly/SameSite=Lax cookies passed |
| Restart | Existing browser session, completed booking and both condition reports passed `--revisit` after a real process stop/start |
| Backup | Fresh online SQLite backup restored to a new private file; `integrity_check=ok`, completed booking and two condition reports verified |
| Preservation | Original app DB, encrypted session-secret file, configured profile and production build unchanged against pre-preparation hashes/identity |
| Tested listeners / current state | Local preflight used app `127.0.0.1:3210` and filtered ingress `127.0.0.1:3211`; both are now stopped for allocation and ports 3210/3211/3212 are closed |
| Public state | No cloudflared process running; Funnel status `{}`; no public Cloudflare acceptance or URL stability evidence |

The five standard Playwright E2E tests passed during the earlier Funnel work;
they were not rerun for these ingress-only changes. The production browser
journey and its restart revisit above were executed for this change.

The verifier uses `https://labloop-preflight.invalid`, explicitly intercepted to
loopback. Evidence has mode `cloudflare-local-preflight` and `publicUrl: null`.
It verifies the actual production app and Cloudflare-mode ingress contract; it
does **not** test Cloudflare's live transport, public TLS or an external device.
Private evidence, browser cookies, runtime logs and database backups remain in
the ACL-restricted runtime directory outside OneDrive/Git.

## Exact-host ingress and Next.js

`scripts/lib/funnel-proxy.ts` supports explicit `tailscale` and `cloudflare`
providers. The default remains Tailscale. Cloudflare configuration accepts one
single-label `https://<allocated-name>.trycloudflare.com` origin; credentials,
extra labels, arbitrary hosts, paths, query strings, non-default ports and
wildcards are rejected. This is hostname-format validation, not a wildcard
permission: every incoming Host must equal the one configured origin.

Cloudflare mode uses the incoming **Host**, ignoring untrusted
X-Forwarded-Host for acceptance. All POSTs require the exact HTTPS Origin.
Forwarding/identity headers are stripped and Host/X-Forwarded-Host/HTTPS are
normalized before forwarding to the one fixed loopback backend. Cloudflare
Access and Tailscale identity headers are not application authentication.
Admin, API, hidden-file, metrics and development paths remain blocked; the
existing 1MB body and method restrictions remain.

The versioned cloudflared source preserves Request.Host unless an explicit
HTTP host override is configured. Do not pass `--http-host-header`. See the
[official 2026.10.6 origin proxy implementation](https://github.com/cloudflare/cloudflared/blob/2026.10.6/ingress/origin_proxy.go).
The installed Next.js Server Actions and self-hosting guides were read. Next's
same-origin check succeeds because the normalized forwarded host matches the
browser Origin. No `serverActions.allowedOrigins` exception or wildcard was added.

## Repeat local checks (no public tunnel)

First confirm Funnel is off and no cloudflared process is forwarding. Stop only
the recorded judge processes; do not reset any database.

```powershell
powershell.exe -NoProfile -File scripts/funnel/judge-demo.ps1 -Action Stop
powershell.exe -NoProfile -File scripts/funnel/judge-demo.ps1 -Action Start -LocalPreflight -Provider Cloudflare
node --import tsx scripts/verify-funnel-demo.ts --cloudflare-local
# Stop/start with the same local flags, then:
node --import tsx scripts/verify-funnel-demo.ts --cloudflare-local --revisit
powershell.exe -NoProfile -File scripts/funnel/judge-demo.ps1 -Action Backup
```

Local flags do not overwrite the saved configured origin/profile. `Status`
shows both the saved URL and the currently running origin/provider, avoiding a
local simulation being mistaken for the saved public configuration.

During verification, an initial cleanup race disposed the request client while
Next prefetches were still in flight. A raw error contained one fictional session
cookie. That exact demo session was revoked without changing the secret or
booking history. The verifier now drains route handlers, suppresses raw request
errors and records acceptance only after successful cleanup. A fresh full
journey and restart revisit completed successfully. A restore check initially
compared a newer transaction with an older backup; a new backup taken after the
final journey restored and verified successfully.

## Public configuration - allocation approved, app connection unapproved

The user approved gate 1 below. Automatic approval review rejected the automated
allocation command with **blocked by policy**, without additional rationale.
The rejected command did not run. The recorded local app/ingress were then
stopped separately and all three ports verified closed. No cloudflared process
or process record exists; Funnel remains `{}`. No default config file or
`TUNNEL_*`/`CF_TUNNEL*` process-environment override was present at the final check.
The next action is for the user to run the already-approved allocation command
manually and report only the generated HTTPS URL or concise error. Do not retry
the rejected launch using a different tool, shell wrapper or obfuscated command.

Cloudflare assigns its random public hostname only when a Quick Tunnel starts.
An exact generated URL cannot be shown beforehand. Use two approval gates to
honor the user's requirement to review the actual app URL before exposure:

1. **Allocation-only approval:** stop app/ingress and confirm both 3210/3211 are
   unused. Confirm no existing tunnel process/configuration would be reused.
   Start one accountless Quick Tunnel to the closed ingress port. It may show a
   Cloudflare gateway error, but serves no LabLoop app/data. Record the process
   ID/start time privately so only this process can be stopped.
2. Show the actual generated HTTPS URL and this exact mapping to the user:
   `generated HTTPS hostname -> 127.0.0.1:3211 -> 127.0.0.1:3210 -> fictional SQLite`.
   Obtain separate approval to connect LabLoop and publish the fictional
   student/owner accounts. Stop the allocation process if approval is declined.
3. While keeping that same cloudflared process alive and the app stopped,
   configure the exact printed URL using the helper below, then start the app.
   Retest the full workflow through the real URL before describing it as working.

The command approved for gate 1 is below. It may now be run **manually by the
user**, with app/ingress left stopped. These flags were checked in the installed
CLI's help; the network command has not yet executed:

```powershell
& "$env:LOCALAPPDATA\LabLoop\installers\cloudflared-2026.10.6-windows-amd64.exe" tunnel --no-autoupdate --metrics 127.0.0.1:3212 --management-diagnostics=false --url http://127.0.0.1:3211
```

Metrics bind only to loopback 3212, never the tunnel target. Reject occupied
ports. No `--http-host-header`, TLS bypass, debug logging, SOCKS, file serving,
remote config, service install, login, token or paid resource is proposed.
Check for existing `~/.cloudflared/config.yml`/`config.yaml` and `TUNNEL_*`
overrides before launch; stop for review rather than alter/reuse unrelated
configuration. None of the two default config files was present at inspection.
When launched by automation, use a hidden process and private stdout/stderr
logs; never print raw request headers or cookie/session files.

Only after gate 2 approval:

```powershell
# Replace the placeholder with the actual approved generated origin.
powershell.exe -NoProfile -File scripts/funnel/judge-demo.ps1 -Action Configure -Provider Cloudflare -PublicUrl https://ACTUAL-ALLOCATED-NAME.trycloudflare.com
powershell.exe -NoProfile -File scripts/funnel/judge-demo.ps1 -Action Start
node --import tsx scripts/verify-funnel-demo.ts
```

The placeholder above is not a real deployed URL. Confirm normal public TLS,
no browser interception or resolver override, exact-host/foreign-origin denial,
protected paths, complete custody lifecycle and cookie flags. Restart only the
app/ingress, keeping cloudflared alive; run `--revisit`. Restore a fresh backup.
Then have a device on mobile data with Wi-Fi/Tailscale disabled exercise the
URL. Record genuine results and timing. If public verification fails, stop the
recorded cloudflared process promptly and leave Funnel off.

## Restart, shutdown and judging limits

Stopping app/ingress with `-Action Stop` does not stop cloudflared. Stop only its
recorded process after checking its creation time; do not kill all instances.
After a Windows restart, Cloudflare needs a new process and gets a new URL.
Repeat the approved allocation/exact-host configuration process, update judge
links and retest. Secure sessions are host-bound, so a new URL needs a new login.
The SQLite records and DPAPI secret persist independently of that hostname.
An app-only restart may keep the same URL if the tunnel process stays alive;
this is not yet verified publicly here.

There is no startup task/service or power-policy change. Availability depends
on Windows, the laptop, cloudflared and the network remaining online. Do not
promise stable links across tunnel recreation. Quick Tunnels have no uptime
guarantee, allow up to 200 in-flight requests and do not support SSE. That makes
this a temporary judge-demo candidate, not completed production hosting.

Official sources: [Quick Tunnel setup and limitations](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/),
[run parameters and metrics/logging](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/configure-tunnels/run-parameters/),
[verified release](https://github.com/cloudflare/cloudflared/releases/tag/2026.10.6).
