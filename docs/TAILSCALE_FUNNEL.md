# Windows judge demo: Tailscale Funnel preparation and evidence

**30 October 2026 - authenticated device and production preparation verified;
public exposure awaiting approval. No live public URL yet.**
The user selected a zero-cost laptop-hosted demonstration and requires separate
approval for installing software, signing into an account and public exposure.
No paid resources, router forwarding, power-policy changes, startup tasks or
Supabase migration were created. Existing app records and Git history remain.

## Current evidence

| Area | Observed result |
| --- | --- |
| Starting source | Clean `main`, `17fa246912f1ac9c4bd958298acd75a3ccccd4b8` |
| Existing production artifact | `.next/BUILD_ID` = `itApzfwuOZ96pav7ZpWPX`; retained, not rebuilt or replaced by a dev server |
| Initial Tailscale state | No installed CLI/package/service found; authentication unavailable |
| Installer prepared | Official `tailscale-setup-1.104.4-amd64.msi`, valid Tailscale Inc. Authenticode signature; SHA-256 `1d12cd8b1d6dbb447da8579b1a5268ae2fc050967bebfaa02e32d2bb645ef6ee` matched manifest |
| Installation | Initial automated installer command was rejected; subsequent manual installation succeeded. Installed CLI version 1.104.4 independently verified |
| Authentication / connectivity | User completed GitHub SSO; CLI reports Running, online, no pending authentication URL; Windows service Running/Automatic |
| Public prerequisites | MagicDNS enabled; no HTTPS certificate domains or Funnel capability currently advertised. HTTPS/Funnel enablement remains part of the pending public setup |
| Serve / Funnel | Both configuration status commands return empty objects; no existing mappings to overwrite |
| Exposure approval | Required and still pending; no public exposure command has been run |
| Isolated judge store | `%LOCALAPPDATA%/LabLoop/judge-demo/fictional-judge.db`, fresh fictional seed, outside OneDrive/repository |
| Secret | Unique random 32-byte session secret, persisted encrypted with Windows DPAPI; directory ACL restricted to current Windows user and SYSTEM; never printed |
| Listeners | Backend `127.0.0.1:3210`; filtered ingress `127.0.0.1:3211`; no LAN binding |
| Current local state | App and ingress running on loopback only, using the exact authenticated device origin stored in the private profile; Funnel remains off |
| Local proxy journey | Catalog, unauthenticated route guard, admin-path denial, student request, owner approval, check-in, initial/final conditions, return confirmation, completed history, Secure/HttpOnly/SameSite=Lax cookie passed |
| Current checks | 48 tests across 5 Vitest files, 5 Playwright tests, typecheck and lint passed; production artifact retained as requested |
| Restart | Reused existing browser session after stopping/starting app and ingress; completed booking and both reports remained; repeated Prepare preserved records and encrypted secret |
| Backup | Online backup and fresh-file restore passed SQLite `integrity_check`; original application database SHA-256 unchanged |
| Original app DB | `data/labloop.db` hash remained `6bb86410d65288e6620f552ce4340271a6483e351d27baf00befdde1d828666a` |
| Public URL / external device | Not available or verified; `labloop-preflight.invalid` is a reserved local simulation hostname, never a deployment claim |

After authenticated device discovery, `--loopback` exercised the actual production
app under the exact assigned device hostname while intercepting requests locally.
That mode records `publicUrl: null` in its private evidence file so it cannot be
mistaken for public verification. The actual hostname is shown to the owner for
approval and retained in the private profile; it is not published here before
public exposure is approved.

This continuation reran 48 Vitest tests, typecheck and lint. The configured-origin
production browser journey passed, then the existing authenticated session,
completed transaction and both condition reports survived a real process restart.
The new online backup was restored into a fresh private file and passed integrity
checking. Direct requests confirmed admin/developer/hidden-file/API denial and
foreign Host/Origin rejection. Public certificate, off-tailnet access and actual
Funnel URL stability remain unverified until public setup is approved.

## Official requirements verified

Funnel needs a sufficiently recent client, an authenticated tailnet device,
MagicDNS, HTTPS certificates and permission through the `funnel` node attribute.
It is offered on all plans, including Personal. The Personal pricing page lists
a zero-cost plan. Funnel accepts TLS on 443, 8443 or 10000 and has bandwidth
limits. Visitors do **not** need Tailscale accounts; the application must enforce
its own permissions. See [Funnel requirements](https://tailscale.com/docs/features/tailscale-funnel)
and [Personal pricing](https://tailscale.com/pricing).

The official Windows installer requires Windows 10+ / Server 2016+. This laptop
reported Windows 10.0.26300.0. The installer was downloaded to the private
`%LOCALAPPDATA%/LabLoop/installers` directory; software installation was not
performed by the rejected automated command. See [Windows setup](https://tailscale.com/docs/install/windows).

Funnel's supported reverse-proxy target is loopback HTTP. `--bg` persists the
configuration and resumes sharing when Tailscale/device restarts; the matching
`off` command disables it. Read the [CLI reference](https://tailscale.com/docs/reference/tailscale-cli/funnel)
before running the exposure command below. Public DNS propagation can take time.

## Architecture and restricted surface

```text
Internet HTTPS :443 -> Tailscale Funnel -> 127.0.0.1:3211 (filtered ingress)
                                            -> 127.0.0.1:3210 (next start)
                                                 -> private local judge SQLite
```

Only the exact authenticated device origin is configured. The ingress has one
fixed upstream; it cannot serve directories, forward arbitrary URLs, or expose
Windows/Tailscale consoles or another local service. It blocks `/admin`, API,
development, hidden-file and unknown paths (including encoded traversal), while
allowing the catalog and borrower/owner journey. No management interface for
this deployment is available over HTTP. The app's organization-admin screen is
intentionally blocked at the public ingress; owner review remains available.

Tailscale's reviewed v1.104.4 proxy implementation replaces `X-Forwarded-Host`
with the public request host. The ingress checks that exact host, rejects foreign
Origins and Origin-less POSTs, strips untrusted forwarding/identity headers and
forwards the exact public Host and HTTPS scheme to Next. Next's existing
Origin/Host comparison therefore works without any `allowedOrigins` change or
wildcard. The local full browser journey exercised actual production Server
Actions through this boundary. Sources: [official proxy implementation](https://raw.githubusercontent.com/tailscale/tailscale/v1.104.4/ipn/ipnlocal/serve.go)
and installed `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/serverActions.md`.

## Safe commands available now

Run in the repository root. These commands do not install Tailscale or enable
public access. Prepare is idempotent; no reset operation exists in this helper.

```powershell
powershell.exe -NoProfile -File scripts/funnel/judge-demo.ps1 -Action Prepare
powershell.exe -NoProfile -File scripts/funnel/judge-demo.ps1 -Action Start -LocalPreflight
node --import tsx scripts/verify-funnel-demo.ts --local
powershell.exe -NoProfile -File scripts/funnel/judge-demo.ps1 -Action Stop
powershell.exe -NoProfile -File scripts/funnel/judge-demo.ps1 -Action Start -LocalPreflight
node --import tsx scripts/verify-funnel-demo.ts --local --revisit
powershell.exe -NoProfile -File scripts/funnel/judge-demo.ps1 -Action Backup
powershell.exe -NoProfile -File scripts/funnel/judge-demo.ps1 -Action Status
```

Logs, profile, session-state QA files and backups stay in the private runtime
directory. Do not attach or commit those files. The local preflight intercepts
browser HTTPS requests and fulfills them from the loopback ingress; it does not
create a real TLS certificate or prove public reachability. The test's negative
unauthenticated navigation verifies the real 307 response directly because
Playwright routing does not intercept the browser's subsequent network redirect.

Checks executed: `npm test` (48 passed), `npm run typecheck`, `npm run lint`,
`npm run test:e2e` (5 passed, about 1.8 minutes), the local full journey and
`--revisit` after actual process restart. The existing E2E fixture was backed up
privately before its reset. Initial test-fixture header mismatches and a trailing
newline in DPAPI secret loading were corrected; no secret was regenerated or
published. The original app DB hash and production build identity were checked
again after testing and remain unchanged.

## Installation, sign-in and public exposure gates

1. **Installation complete:** the user manually installed the verified package;
   installed version was independently checked. The earlier automatic rejection
   was not bypassed with another installer command.
2. **Sign-in complete:** the user completed GitHub SSO independently. No agent
   sign-in or credential entry is needed. Do not dump account/peer inventories or
   commit authentication URLs/credentials.
3. Read only `BackendState` and the current device `Self.DNSName`; avoid dumping
   the peer/account inventory. Stop local preflight before configuration.
4. Configure the actual `https://<Self.DNSName>` using `-Action Configure -PublicUrl
   <actual-url>`. The helper verifies that it matches the authenticated device.
   Restart with `-Action Start` (without `-LocalPreflight`). Secure cookies remain
   enabled; seeding is disabled after the initial fictional setup.
   This configuration/start step is complete; `--loopback` and its `--revisit`
   check have passed without enabling Tailscale forwarding.
5. Inspect existing `funnel status --json` and `serve status --json`; do not
   overwrite unrelated mappings or reset an existing configuration.
6. **Separate public approval required, currently pending:** review the exact URL, only ingress
   port 3211, fictional accounts, public visitor access and persistent background
   behavior with the user. Funnel may require explicit HTTPS/node-policy approval
   in Tailscale's web UI. No public command has been run during preparation.

To repeat the configured-origin test without exposing the app:

```powershell
node --import tsx scripts/verify-funnel-demo.ts --loopback
# After stopping/starting the recorded app and ingress:
node --import tsx scripts/verify-funnel-demo.ts --loopback --revisit
```

Only after gate 6 is approved, the supported command prepared for this service is:

```powershell
& "$env:ProgramFiles\Tailscale\tailscale.exe" funnel --bg --https=443 http://127.0.0.1:3211
& "$env:ProgramFiles\Tailscale\tailscale.exe" funnel status --json
```

Record the actual CLI URL; compare it with the configured origin before sharing.
Do not use a file/directory target or expose backend 3210, RDP, SSH or other ports.

## Public acceptance - all pending

- Confirm official HTTPS certificate and real catalog response at the generated URL.
- Run `node --import tsx scripts/verify-funnel-demo.ts` through that URL.
- Where possible set `LABLOOP_FUNNEL_PUBLIC_IP` to the independently resolved
  public relay IPv4 to avoid MagicDNS taking a private tailnet route in the
  browser. Never call that an independent-device test by itself.
- Stop/start the app, then run the verifier with `--revisit`; check existing
  session, SQL integrity, reports and history; create and restore a backup.
- Ask a user on mobile data with Tailscale/Wi-Fi disabled to open the actual URL
  and exercise the demo. Record their confirmed result and timestamp; do not
  infer it from a laptop-only test.
- Disable/re-enable this Funnel and verify that the generated URL is identical;
  retest external reachability. Do not rename/remove/re-register the device or
  change the tailnet DNS name during judging.
- Only after genuine verification update README, deployment status, handoff
  and provisional report with the actual URL and limits. No form submission.

If public verification fails, disable this service promptly:

```powershell
& "$env:ProgramFiles\Tailscale\tailscale.exe" funnel --https=443 off
powershell.exe -NoProfile -File scripts/funnel/judge-demo.ps1 -Action Stop
```

## Restart after Windows restarts and uptime limits

After signing into Windows and restoring internet access, check Tailscale status,
run the judge helper with `-Action Start`, then check Funnel status. With the
approved `--bg` configuration, Funnel resumes when Tailscale reconnects; if it is
off, use the same exact approved exposure command. The profile retains the
database, origin and DPAPI secret; startup refuses a changed production build
or occupied ports rather than exposing an unrelated service.

No automatic startup task or unattended-mode change has been installed. Windows
Tailscale normally depends on a signed-in user; running before Windows login
requires the separately reviewed unattended option. See [Windows unattended mode](https://tailscale.com/docs/how-to/run-unattended).
Do not change sleep/lid/power settings without user approval. Laptop shutdown,
sleep, Windows updates, logout, network failure or expired authentication can
interrupt judging. This is a laptop demo, not an uptime guarantee.

The URL is based on the device/tailnet DNS names, so retaining those identities
matters; stability still needs the actual restart test above. See [machine names](https://tailscale.com/docs/concepts/machine-names).

## No-cost alternative if Tailscale cannot be completed

Cloudflare Quick Tunnels can issue an accountless temporary `trycloudflare.com`
URL for a local HTTP service. They have no uptime guarantee, change hostname on
each new tunnel and require the `cloudflared` executable. This would need separate
software/public-exposure approval and an exact-host configuration adjustment;
it has not been installed, enabled or tested here. It is a fallback demonstration
route, not an equally stable substitute. [Official Quick Tunnel documentation](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/).
