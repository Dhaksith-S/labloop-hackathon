# Fairness

LabLoop exists because scarce equipment is often allocated through informal
access: who knows the lab steward, who is already in the room, who asks first in
a group chat. The product replaces that with published rules, visible reasons and
a human decision that is recorded.

Fairness here is **procedural**: the same written rules apply to every member,
and every exception is explained. This document does not claim measured
demographic equity, and LabLoop does not collect demographic data, so it cannot
prove equitable outcomes.

## 1. Principles

1. **Rules before relationships.** Eligibility is computed from membership,
   verified credentials, published hours, duration caps, blackouts, conflicts
   and fair-use limits. An owner cannot skip a required credential for a friend
   through the UI.
2. **Humans decide, but must explain.** Passing eligibility only creates a
   pending request. Rejection and waitlisting require a written reason of at
   least five characters, stored in the timeline and audit log.
3. **No self-dealing.** An owner cannot approve their own request or confirm
   their own return. An incident reporter cannot close their own incident.
4. **Transparent queue.** Waitlist position is calculated from submission time
   and shown as "position N of M". It is not a hidden score.
5. **Release is not an award.** When an approved slot is cancelled, the first
   eligible overlapping waitlist request returns to human review. LabLoop never
   auto-approves it.
6. **Equal caps.** Every member has the same per-resource active-request limit
   (configured 1–10 per listing; demo listings use 1–2). Owning a resource does
   not raise your fair-use cap for someone else's resource.
7. **Competing demand is visible.** Overlapping open requests produce an
   advisory warning to the requester and appear in the owner's queue, instead of
   being silently deleted or blocked.
8. **Custody evidence is symmetric.** Both check-in and return conditions are
   append-only and shown together. A borrower can record existing wear before
   taking custody; the borrower records final condition and the owner inspects
   the hand-back and can add a confirmation note. Neither can rewrite condition
   evidence after it has been recorded.
9. **No automated punishment.** A reported incident does not automatically
   suspend a member or alter eligibility. A reviewer records an outcome with a
   note. Qualification status is the only credential gate, and a human verifies
   it.
10. **Bounded authority.** A resource owner manages only their own listings. A
    manager/admin can review across the organization, and that concentration is
    visible in the role label and audit trail.

## 2. How allocation works

### Request time

A request is accepted only if all blocking checks pass. Warnings (competing
requests, optional credential) do not block. Accepted requests enter `pending`;
they do not reserve the slot.

### Owner decision

The owner sees the request window, purpose, eligibility result, competing open
requests and the borrower's relevant booking context. They may:

- **approve** — eligibility is re-run in `approval` mode; if the window has
  become invalid, approval is refused with reasons and the owner must waitlist
  or reject it;
- **reject** — written reason required;
- **waitlist** — written reason required, position exposed to the borrower.

Approval is the only operation that reserves a slot. The database rejects an
overlapping approved row even if two reviewers act at once.

### Waitlist release

On cancellation of an approved future booking:

1. find waitlisted requests for the same resource that overlap the released
   window;
2. sort by `created_at` (oldest first);
3. re-run eligibility for each, excluding its own row;
4. return the first eligible request to `pending` for human review;
5. notify the borrower and staff; write `waitlist_review_opened` and an audit
   entry.

Consequences:

- A waitlisted request with a missing credential is skipped, not approved.
- A later request can be considered if earlier ones are no longer eligible.
- Position is not a guarantee; eligibility and owner judgment still apply.
- Nothing reopens automatically on a timer in this build. If no cancellation
  occurs, the queue waits for a human or for the slot to pass.

### Check-in and return

- Check-in opens 30 minutes before start and closes 120 minutes after.
- Only the approved borrower can check in.
- Rules must be acknowledged.
- Initial and final condition reports are separate immutable rows.
- The owner (or org manager) confirms the hand-back; the borrower cannot close
  their own custody.

## 3. Fair-use limits

The cap counts a member's `pending`, `waitlisted` and `approved` bookings for the
same resource whose end time is still in the future. Completed, rejected and
cancelled rows do not count. This prevents one person from parking requests on
every popular slot.

Trade-off: a pending request consumes capacity before approval. That is
intentional — it discourages speculative queueing — but it can disadvantage a
member who legitimately needs to compare two windows. The limit is published on
the listing and shown in the eligibility panel.

## 4. Reasons, records and reviewability

Every material action writes:

- a human-readable `booking_events` row (timeline);
- an `audit_events` row with actor, action, entity and summary;
- notifications to the affected borrower or staff.

Reject/waitlist reasons and manager cancellation reasons are mandatory. Return
confirmation notes are optional but recorded if supplied. Incident resolution
requires at least 10 characters.

This makes it possible for a student to ask, "Why was I declined?" and for a
manager to answer from the record. It also makes retrospective review possible:
the organization activity page and booking timeline show who did what.

## 5. Risks and mitigations

| Risk | Current mitigation | Residual risk |
| --- | --- | --- |
| Owner favors friends | Written reasons, audit, role separation, no self-approval | Owners still exercise judgment; no second-review requirement |
| Insider gets first look | Public catalog, same request path, visible queue | Staff can still see demand earlier |
| Credential gate excludes capable students | Requirements are published; optional credentials warn; managers can verify | Training access itself may be uneven |
| Waitlist feels arbitrary | Position shown, FIFO by submission, promotion is explicit | No SLA or expiry; owner may never decide |
| Popular resource monopolized | Fair-use caps per member | Caps are per resource, not per person across all resources |
| Retaliatory incident report | Human review, self-review block, resolution note | No independent appeal body |
| Manager overreach | Role checks, audit, organization-scoped authority | Managers can review all org resources by design |
| Timezone confusion | IST interpretation and explicit display | Users outside IST may misread local times |
| Accessibility barriers | Semantic forms, focus states, responsive layout | No automated WCAG audit or user testing |
| Queue starvation | Oldest-first and eligibility re-check | Ineligible early requests are skipped; no notification that they were skipped |

## 6. What is intentionally not automated

- No auto-approval based on eligibility.
- No auto-rejection based on incident count.
- No hidden reputation score.
- No priority for owners, managers or early sign-ups.
- No automatic suspension.
- No demographic targeting or quota.

These omissions are deliberate. A small institution needs human context — a
broken printer, a disability accommodation, a lab tech who knows the student —
and an algorithm should not pretend to capture that. The human decision is
bounded by published rules and recorded reasons.

## 7. Recommendations before real use

1. Publish a service-level target for review (for example, two working days) and
   show aging requests to reviewers.
2. Add an appeal path: a student can request a second reviewer, with the original
   decision preserved in the timeline.
3. Add waitlist expiry and a "slot passed" notice so members are not left
   waiting indefinitely.
4. Require a conflict-of-interest declaration when an owner reviews a close
   collaborator, or route those requests to another manager.
5. Add a "not eligible yet" path that tells a student exactly how to obtain the
   missing credential.
6. Review incident outcomes periodically for consistency; no automated penalty
   exists today.
7. If equity is a policy goal, define metrics and collect data with informed
   consent. Do not infer demographic fairness from usage counts alone.
8. Test with students who use screen readers, keyboards and mobile devices.

## 8. Known fairness gaps

- No formal appeal or second-review workflow.
- No review SLA or escalation.
- No waitlist expiry/re-notification job.
- No automated detection of reviewers deciding repeatedly for the same people.
- No cross-resource per-person cap; a member could hold one request on every
  listing.
- No incident-to-eligibility policy; incidents are recorded but do not affect
  future eligibility.
- No accommodation workflow for accessibility or caregiving needs.
- No demographic or outcome-equity measurement.

These are documented so judges and future maintainers can distinguish a working
procedure from a fully audited fairness program.
