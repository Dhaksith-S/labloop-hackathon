# Official judging criteria: implementation traceability

Source: [organiser brief transcribed from project-owner input](OFFICIAL_PROBLEM_STATEMENT.md).
These are the seven official criteria and weights, not a predicted score.
Verification evidence is recorded in [VERIFICATION.md](VERIFICATION.md).
The two 20-point criteria receive priority. Real public custody/security checks
passed on the recovered Cloudflare route; final restart and off-tailnet device
acceptance remain. See [current evidence](PUBLIC_DEMO_VERIFICATION.md).
That hostname was subsequently recreated by the user. The new exact hostname
is configured with app stopped pending explicit reconnection approval/retests;
the prior-host checks are preserved evidence, not passes at the new hostname.
The subsequent approved Tailscale Funnel attempt failed public reachability and
was disabled; locally intercepted production tests do not satisfy public judge
access. See [attempt evidence](TAILSCALE_FUNNEL.md).
Current source checks pass 55 tests/typecheck/lint. Manager/admin shared demo
credentials are locked only in the public judge store; their management
interfaces remain outside public scope. See the [operations runbook](CLOUDFLARE_QUICK_TUNNEL.md).

| Official criterion | Weight | Actual product evidence and code | Executed checks / evidence | Remaining gap |
| --- | --- | --- | --- | --- |
| Understanding of the Problem | 15 | Campus use case, eligibility plus accountability, owner control; report sections 1-2 and target-user section; `src/lib/eligibility.ts` | Explainable membership, credentials, availability, conflict and fair-use cases in `tests/eligibility.test.ts` | No interviews, measured utilisation, external research or adoption evidence; scenario reasoning is not empirical research |
| Strength of the Core Solution | 20 | `src/lib/resources.ts`, `src/lib/bookings.ts`, `src/lib/incidents.ts`; listing through custody closure, written decisions, notifications | Lifecycle integration tests; browser listing publication/discovery and request-to-return checks | Text condition evidence only; no photo storage; scheduled overdue reminders absent |
| Working End-to-End Product | 20 | `/resources`, `/resources/[id]/request`, `/bookings/[id]`, `/owner/requests`, `/owner/custody`, `/owner/incidents`; both parties see timeline and condition records | `e2e/labloop.spec.ts` local browser listing/custody; `tests/lifecycle.test.ts` incidents/integrity; `scripts/verify-funnel-demo.ts` real public HTTPS custody passed | Independent off-tailnet device and public app-restart acceptance pending; laptop/tunnel uptime dependency |
| Technical Depth and Reliability | 15 | Next.js Server Actions + Zod, domain services, SQLite immediate transactions, overlap and append-only triggers; `src/db/sqlite-schema.sql`, `src/lib/database.ts` | Typecheck, lint, production build; database-bypass regression tests; `tests/operations.test.ts` verifies WAL backup and restore | No hosted reliability/load claim; prepared Supabase SQL/RLS not applied or verified; one Node instance |
| Trust, Safety and Accountability | 10 | `src/lib/auth.ts`, `src/lib/password.ts`, service authorization, independent credential/incident review, initial/final immutable condition evidence | `tests/security.test.ts` checks private staff data, owner/org scope, suspension, tokens and redirect handling; lifecycle checks self-dealing and illegal transitions | Roles are institution-assigned demo records, not external identity verification; no formal dispute/appeal flow, password recovery or MFA |
| Fair Allocation and Accessibility | 10 | FIFO waitlist, eligibility recheck, per-resource cap, human final decision; `src/lib/eligibility.ts`, `src/lib/bookings.ts`; labelled forms, text status and mobile navigation | Eligibility and waitlist tests; phone viewport browser check; auth form heading corrected for mobile | No WCAG certification, screen-reader study or automated accessibility scan; no cross-resource cap or review SLA |
| Originality and Real-World Potential | 10 | Integrated eligibility, human decision, custody evidence, incident review and transparent waitlist; architecture/deployment documentation | Working local product and auditable Git history; explicit operational limitations | No market validation, customer claims, cost savings or quantified impact; adoption and institutional review remain future work |
| **Total** | **100** | **No self-awarded marks** | **Only recorded checks count as verified** | **Submission is incomplete until the public app, official PDF format and participant details exist** |

## Mandatory workflow coverage

| Step | Implementation | Evidence |
| --- | --- | --- |
| 1. Owner lists resource with conditions | `createResource`, listing form, usage rules, hours, credentials | Browser listing test; role/ownership service test |
| 2. Discover and check eligibility | Public SQL catalog, search/category, requirement standing | Public browser test, listing discovery test, eligibility suite |
| 3-4. Request and verify requirements | `createBookingRequest`, Zod Server Action, deterministic checks | Browser request; missing/pending/expired/revoked credential tests |
| 5-6. Human review and decision | `decideBooking`, independent owner/manager, written reject/waitlist reasons | Approval browser flow, conflict/waitlist integration, self-approval denial |
| 7. Check-in and initial condition | `checkInBooking`, window, acknowledgement, append-only report | Lifecycle and browser custody tests |
| 8. Return and final condition | `submitReturn`, `confirmReturn`, independent confirmation | Lifecycle and browser custody tests; two visible condition records |
| 9. Handle delays/damage/conflicts | Derived overdue indicator; incident types including `late_return`, `damage`, `access_conflict`; human review | Incident review/self-review tests; overlap trigger and service tests; no scheduled overdue notification claim |
| 10. Both parties inspect records | Authorized booking detail, timeline, condition reports and attached incidents | Borrower/owner browser sessions; authorized detail and append-only service tests |

## Expected capabilities requiring qualification

- Approval/cancellation/custody notifications are persisted in-app. Overdue is
  displayed from timestamps; scheduled overdue notifications are **not built**.
- Owners are verified by assignment of an active staff role; signup creates a
  student. There is no real institution identity integration or email verification.
- Condition reports are text and accessory checks. A `photo_url` column is not
  an upload feature.
- Fairness is procedural. No demographic equity or measured accessibility claim
  is made.
- The original five commits have author timestamps on 30 October 2026 between
  13:11 and 13:41 IST. This is development evidence, not independent proof of
  every participant's contribution or the provenance of every line.
