# Persistent SQLite deployment preparation

**Subsequent zero-cost route:** Tailscale Funnel preparation is locally tested
using the existing production build, loopback-only backend/ingress and a private
judge database outside OneDrive. It is not publicly enabled. Tailscale 1.104.4
and user sign-in are verified; configured-origin production workflow/restart and
backup restoration pass locally. The user enabled HTTPS/Funnel and approved the
exact route. CLI setup issued `https://dhaksith.tail3cd298.ts.net/`, but public
verification timed out; Funnel was disabled and its final status is `{}`. No
working public URL, external-device access or public lifecycle is verified.
The timeout's cause remains unresolved. See [Funnel guide](TAILSCALE_FUNNEL.md)
for exact evidence, restart/stop commands and the accountless fallback. The paid
Render template below remains unapplied and unauthorized.

**Status: prepared locally, not deployed.** The user authorized preparation and
explicitly prohibited paid resources. No cloud service, disk, subscription or
cloud production URL was created. The attempted Funnel address is disabled and
unverified. Render is available as an optional integration but
was not connected during this work. GitHub authentication is working.

## Strategy decision

Choose a single Node.js instance with a genuinely persistent local volume for
this deadline. This preserves the running database, sessions, atomic services
and tests. A PostgreSQL migration would touch synchronous SQL throughout the
application and replace or port authentication; the prepared SQL alone does not
complete that work.

| Strategy | Complexity / test impact | Persistence and reliability | Access / cost constraints |
| --- | --- | --- | --- |
| Supabase + Vercel | Large async data-access/auth/seed port plus real RLS and concurrency verification | Managed Postgres when correctly wired; no local SQLite in functions | Neither project connected; Supabase free projects may pause with inactivity; requires authorization |
| Render Node + disk | Small startup/configuration change; same domain and browser tests | `/var/data` survives restarts and deploys; single instance; deploy interruption | Persistent disks require paid compute; currently **not authorized** |
| Railway Node + volume | Small configuration change; same services | Volume-backed SQLite; verify mount, restart and backup on the chosen plan | Trial/credits and ongoing plan limits require account inspection; no connected account or usage approval |

Official references checked 30 October 2026:
[Render disks](https://render.com/docs/disks),
[Render free limits](https://render.com/docs/free),
[Render pricing](https://render.com/pricing),
[Railway volumes](https://docs.railway.com/volumes),
[Railway plans](https://docs.railway.com/pricing/plans),
[Supabase free-project pausing](https://supabase.com/kb/faqs/platform/free-project-pausing).
Reconfirm plan availability and total price in the selected account before any
resource creation. No indefinite free persistent hosting is promised.

## Reviewable configuration

`deploy/render.yaml` is deliberately outside the root default Blueprint path.
It is a **paid plan template**, not an authorization to apply it. It specifies
one native Node service, manual deployment, a 1 GB disk at `/var/data`, the
existing public `main`, a generated session secret and explicit fictional seed.
The fields were reviewed against the
[Blueprint reference](https://render.com/docs/blueprint-spec); provider-side
validation and a Linux/native-module build remain pending.

Build: `npm ci --include=dev && npm run build`. Runtime needs `tsx` for setup and
the guarded startup script, so do not omit dev dependencies on this configuration.
Start: `npm run start:production`. Node is pinned in the template to the locally
verified 24.18.0. Native `better-sqlite3` must install for the host OS/Node ABI;
never upload Windows `node_modules` to Linux.

The startup guard rejects short/missing session secrets, relative DB paths,
insecure cookies, missing HTTPS public URLs and implicit seed settings **before
opening a database**. It then runs idempotent setup and binds Next to
`0.0.0.0:$PORT`. An absolute path does not prove that a volume is mounted; the
operator must verify the mount in the provider console.

| Variable | Value / treatment |
| --- | --- |
| `LABLOOP_DB_PATH` | `/var/data/labloop.db` on the actual mounted disk |
| `LABLOOP_SESSION_SECRET` | Generate securely in provider; retain across restarts; never commit or print |
| `LABLOOP_SEED_DEMO` | `1` only for the isolated fictional judge demo; `0` for an already initialized non-demo environment |
| `LABLOOP_INSECURE_COOKIES` | Unset; production cookies remain Secure |
| `NEXT_PUBLIC_APP_URL` | Actual assigned HTTPS URL, supplied before building |

The login page health check proves HTTP readiness, not database durability or
authorization correctness. Verify those separately below. Do not enable multiple
replicas or mount the same WAL database across independent machines. Keep the
service behind the provider's HTTPS reverse proxy. CSP/HSTS and edge/IP rate
limits remain pre-public-use configuration work; no hardened real-user service
is claimed.

## Backup and recovery

`npm run db:backup -- /var/data/backups/UNIQUE-NAME.db` uses SQLite Online Backup,
including committed WAL content, then runs `integrity_check`. It refuses an
existing destination or the source itself. Choose a new filename for every run.
The source is `LABLOOP_DB_PATH` (default local `data/labloop.db`). The CLI does not
load `.env.local`; export the path explicitly when using a custom source.

Before judge access, schedule daily backups and copy verified snapshots to
authorized private off-host storage. A backup on the same volume protects
against operator mistakes, not loss of the volume. Neither scheduling nor
off-host storage has been configured because no host is connected. Do not rely
solely on a live filesystem snapshot for a custom database.

Recovery procedure:

1. Stop the application and keep the old volume/database for diagnosis.
2. Download an authorized verified backup to a private path. Do not commit it.
3. Set `LABLOOP_DB_PATH` to that backup and run `npm run db:backup --
   /var/data/recovered-UNIQUE.db`. This validates and copies to a fresh file;
   it never overwrites the current store.
4. Set the service DB path to the recovered file. Keep the same session secret
   if existing sessions should survive. Restart one instance.
5. Verify integrity, account access, a known booking, both condition reports and
   timeline. Retain old files until recovery is accepted.

Local automated coverage proves committed WAL backup, fresh-file restore and
refusal to overwrite. Hosted scheduling, off-host restoration and host restart
durability must still be verified.

## Other persistent-host options (not the current zero-cost route)

For a separate hosted route, identify a provider account, service plan,
spending cap and persistent volume before creating resources. For the prepared Render path, the
user must install/connect Render and authorize the chosen paid compute plus disk.
With the current **no paid resources** instruction, do not apply the template.
An already-owned compatible persistent host can also be named without purchasing
anything. Do not request secrets in chat; use provider settings or a secret manager.

## Hosted-provider acceptance checklist - not executed

- [ ] Validate configuration with the provider and install native dependencies on Linux.
- [ ] Confirm disk mounted; set HTTPS URL, unique secret, secure cookies and demo isolation.
- [ ] Deploy existing repository, record commit, command, timestamp and real URL.
- [ ] Public catalog/search and restricted-route checks pass from an independent browser.
- [ ] Student requests; owner reviews eligibility and approves; student checks in/returns; owner confirms.
- [ ] Verify both condition reports, incidents, notifications and transaction timeline.
- [ ] Restart/redeploy; revisit the same booking and existing session; confirm rows remain.
- [ ] Run and restore a backup; configure private off-host retention and an operational owner.
- [ ] Reconfirm links remain accessible throughout judging, then update the report/handoff.
