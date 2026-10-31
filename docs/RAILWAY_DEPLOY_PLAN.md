# Railway trial deployment gate — LabLoop (31 October 2026)

Status: **plan only**. No Railway account, service, volume, DNS endpoint, secret, public verification, or final submission has been created or confirmed by this document.

## Goal and hard constraints

Run the existing Next.js + better-sqlite3 monolith on an externally hosted Node service so judges can use it while the owner's Windows laptop is shut down. Use a Railway trial/free resource **only if available within a zero-spend limit**. Do not purchase or upgrade a plan, attach a payment method, or enable billing without separate user approval.

The repository's Windows Cloudflare Quick Tunnel is an **independent existing deployment**. Leave its DB, backups, startup profiles, session keys, cloudflared process and all existing public evidence unchanged. Its current hostname cannot be considered a laptop-independent judge URL.

Official references:
- https://docs.railway.com/pricing/free-trial — new-account $5 one-time credit, max 30 days, account verification rules
- https://docs.railway.com/pricing/plans — trial/free limits and variable costs
- https://docs.railway.com/volumes/reference — 0.5 GB volumes on trial/free
- https://docs.railway.com/volumes — mounted at runtime, not in build or pre-deploy stages
- https://docs.railway.com/guides/nextjs — Next.js GitHub deployment and generated domains
- https://docs.railway.com/config-as-code — optional railway.json configuration

## Step 0: blockers to resolve BEFORE public activation

1. **Privileged seeded credentials**: scripts/harden-judge-demo.ts is deliberately Windows-only. The cloud deploy MUST add a separate guarded, tested cross-platform way to lock privileged demo accounts / revoke their shared sessions in a brand-new isolated fictional judge DB before opening public access. Do not bypass this protection to make the deployment pass.
2. **Persist both data and secret**: use one Railway volume at /var/data with LABLOOP_DB_PATH=/var/data/labloop.db, LABLOOP_SEED_DEMO=1, and a securely generated stable LABLOOP_SESSION_SECRET stored in service variables, not Git/logs. Confirm public cookies remain Secure. A valid NEXT_PUBLIC_APP_URL must match the actual generated HTTPS domain.
3. **Build vs runtime**: Node 24+ and native better-sqlite3 built on Linux; include dev dependencies because scripts/start-production.ts loads tsx; run npm ci and npm run build in build stage; run npm run start:production in runtime. Volume mounts only at runtime. Never call a database reset on existing data.
4. **Safety and data migration**: create a new fictional cloud store; do not upload the Windows user/private DB or secret. Demo owner/student accounts can be seeded in the empty cloud store, but privileged manager/admin demo access must be locked first.
5. **Budget**: view trial credits/current usage and attach a hard spend cap where available. A trial is not perpetual free hosting; do not describe it as always-free or guaranteed. Free $1/mo credit does not guarantee continuous hosting after trial.
6. **Scale**: a single instance, one attached volume. No replicas, no simultaneous writers, no detached WAL database and no temporary disk masquerading as persistent volume. No new browser-visible debug endpoint or secret logs.

## Deployment steps after prerequisites are tested

1. Connect Railway to the GitHub repository Dhaksith-S/labloop-hackathon using user-authorized account access. Verify available trial/full networking and selected free plan; stop if paid setup is requested.
2. Create one Node web service using the current public main branch. Set production build/start commands as above; verify Node 24 and Linux better-sqlite3. Prepare/attach one 0.5 GB volume at /var/data, with filesystem permissions appropriate to the runtime process.
3. Generate the public railway.app domain, set NEXT_PUBLIC_APP_URL exactly to its https origin, generate a persistent secret using a secure CSPRNG and configure only through provider secret variables. Keep the cloud store isolated.
4. Run guarded setup and **cloud privileged-account hardening BEFORE external traffic**. Prove shared manager seed credentials cannot authenticate and student/owner login remains functional.
5. Verify public HTTPS catalog and session, request/approval/check-in/return/owner-confirmation, exact read/write persistence after real service restart and new login, both condition reports, role guards and SQL integrity. Also verify after laptop shutdown/on mobile data.
6. Check public cold start, URL reachability and Railway usage and retain a sanitized evidence log. The URL is not submission-ready until the full cloud journey passes.
7. Update README, current public-demo and deployment docs to clearly distinguish retired Windows tunnel evidence from actual Railway verification. Only after successful hosted tests replace final judge URL in the submission PDF.
8. Final submission: every participant must use their own account and confirm their own true role and specific contribution. Verify the organizer's **official PDF format**. Submit by 1 Nov 2026 10:00 IST and retain the confirmation. The form recorded in docs/OFFICIAL_PROBLEM_STATEMENT.md is https://forms.gle/QTD1ZRuPX37Yef37A — confirm it is still the exact official form.

## Go/no-go

**GO** only if cloud app, volume persistence after restart, secret stability, restricted admin login, full public custody workflow, and verified public URL succeed without violating budget.

**NO-GO** on transient/ephemeral SQLite, public admin demo password, a public link requiring the laptop to stay powered, failed login/session persistence, unverified database mount, exhausted credits, or an unchecked submission form.

This file records a deployment plan. It does not claim a deployment occurred, even if an automated build reports green.
