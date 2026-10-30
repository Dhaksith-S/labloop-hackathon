# Demo script

A complete, factual walkthrough for judges. Everything below works against the
local SQLite build. Nothing here implies a public deployment.

## 0. Start clean

```bash
npm install
npm run db:reset
npm run dev
```

Open `http://localhost:3000`.

- Node 24+.
- No Supabase, Vercel, email or storage account is needed.
- `data/labloop.db` is recreated with the fictional Northstar dataset.
- The landing page is public. The workspace requires sign-in.

### Accounts

All five demo accounts use **`LabLoop!2026`**.

| Email | Who | Role |
| --- | --- | --- |
| `student@labloop.demo` | Arjun Mehta | Student |
| `owner@labloop.demo` | Maya Iyer | Resource owner |
| `manager@labloop.demo` | Riya Sen | Lab manager |
| `priya@labloop.demo` | Priya Nair | Student |
| `dev@labloop.demo` | Dev Patel | Student |

The login page has a demo picker that fills the form. The accounts are fictional;
the password is intentionally public.

## 1. The 90-second product story

1. Open the landing page. Read the headline and the three-step loop.
2. Open **Discover**. Search `printer`, filter by **3D printing**, then clear the
   filter.
3. Open **Bambu Lab X1 Carbon**. Point out: condition summary, usage rules,
   published hours, required **3D Printing Safety** credential, owner, location,
   blackout, and "Sign in to request".
4. Toggle light/dark. Resize to a phone width and open the menu.
5. Open **How it works** for the full lifecycle.

No fake customer logos, usage charts or testimonials appear anywhere.

## 2. The seeded state (sign in as Arjun)

Sign in as `student@labloop.demo`.

**Dashboard / My bookings** contains three real records:

- **Open Maker Bench 04** — pending request starting about 20–25 minutes from
  seed time, ending two hours later. Because check-in opens 30 minutes before
  the start, this request is immediately actionable once approved.
- **Rigol DS1054Z Oscilloscope** — currently checked in, with an initial
  condition report. Its seeded end time is 15 minutes after seed; it may show as
  overdue if you wait. Custody is still open.
- **Open Maker Bench 04** — completed history from four days ago, with both
  condition reports and a closed timeline.

Also notice:

- verified **3D Printing Safety** and **Electronics Bench Safety** credentials;
- pending **Materials Lab Certification** (cannot be used as proof);
- an unread welcome notification.

## 3. Full loop using the seeded pending request

This is the fastest end-to-end demonstration.

### As Arjun (student)

1. Open the pending **Open Maker Bench 04** request.
2. Show the eligibility panel: every check with pass/warning detail.
3. Leave it pending and sign out.

### As Maya (owner)

1. Sign in as `owner@labloop.demo`.
2. Open **Requests**. The pending request is at the top with the borrower,
   window, purpose and eligibility result.
3. Choose **Approve**, write a reason such as
   "Bench is free and the member is active," and record the decision.
4. The page shows **Approved** and "Awaiting borrower check-in".
5. Sign out.

### Back as Arjun

1. Open the booking. The check-in form is available because the start is within
   30 minutes.
2. Choose condition **Good**, confirm accessories, write "Bench clear, vice
   mounted, task lamp working," acknowledge the rules, and take custody.
3. The status becomes **In use**. The initial condition report is appended.
4. Submit the return with condition **Fair**, accessories OK, and a note about
   light residue.
5. The status becomes **Return pending**.

### As Maya

1. Open **Custody**. The return is waiting.
2. Open the booking, write a confirmation note, and close custody.
3. The status is **Completed**. The timeline shows submitted, approved, checked
   in, return submitted and return confirmed. Both condition reports remain
   visible and immutable.

This is the same loop covered by the Playwright test.

## 4. Fresh request from discovery (optional)

If you prefer to create a new record:

1. Sign in as **Priya**.
2. **Discover → Open Maker Bench 04 → Request a slot**.
3. Choose a start about 15 minutes from now and an end one hour later.
4. Enter a purpose of at least 10 characters and acknowledge the rules.
5. Submit. The request is **pending**, not approved.
6. Complete the same owner/check-in/return/confirm sequence.

Use the bench, not a credentialed resource, so the demo does not depend on
Priya's credentials.

## 5. Eligibility, refusal and transparency

### Missing credential

Sign in as **Priya** and open **50 kN Universal Testing Machine** or the paused
**Epilog Zing Laser Cutter**. The eligibility panel explains the missing
Materials Lab Certification or the paused listing. The request button is
unavailable or the request is refused with named blocking reasons.

### Competing requests

The printer has a seeded **approved** booking for Dev tomorrow 14:00–16:00 IST
and a **waitlisted** request from Priya for the same window. Open the printer as
Maya to see the competing demand. The waitlist position is visible on Priya's
booking.

### Waitlist release — human review, not auto-approval

1. As **Maya**, open **Custody** (approved future bookings appear there) and find
   Dev's approved printer booking for tomorrow afternoon.
2. Cancel it with a reason.
3. Open Priya's booking or the review queue. Priya's request has moved from
   **waitlisted** to **pending**, position is cleared, and the timeline says the
   slot was released and returned to owner review — **not auto-approved**.
4. Approve or decline it yourself.

This is the fairness behaviour asserted by the integration test.

## 6. Listings and operations

### Owner studio (Maya)

- **Owner studio** shows only Maya's resources and real counts.
- **Listings** shows active, paused and archived states.
- Open **Epilog Zing Laser Cutter**: paused for exhaust servicing, with a
  maintenance blackout.
- Open **Bambu Lab X1 Carbon → Edit**: change the fair-use limit or pause the
  listing. Pausing removes it from the public catalog; existing history remains.
- **New listing** creates a resource with category, location, rules, duration
  cap, fair-use cap, weekly hours and one required credential. It is immediately
  visible if active and is written to the audit log.

### Incidents (Maya or Riya)

- **Incidents** contains an unresolved, in-review laser-extraction report from
  Priya.
- Open it and record a review outcome. A resolution note of at least 10
  characters is required.
- You cannot resolve an incident you reported yourself. Maya can review Priya's
  report; Riya can review either.
- The reporter receives a notification.

### Credentials (Riya)

- Sign in as `manager@labloop.demo` and open **Organization**.
- Counts are SQL rows, not invented metrics.
- Find Arjun's pending **Materials Lab Certification**.
- Verify it with a note and expiry. The member is notified and the credential can
  now satisfy the tester requirement.
- A student cannot verify their own credential; only manager/admin can.

### Activity and notifications

- **Activity** combines booking events, incidents and organization audit rows.
- **Notifications** persists decisions, waitlist changes, custody notices,
  incident outcomes and credential reviews. Mark one read or mark all read.

## 7. Security and role boundaries to demonstrate

1. As a student, navigate directly to `/owner/requests` or `/admin`. You are
   redirected to the dashboard.
2. As Maya, try to review a request on a resource owned by someone else. The
   service rejects it.
3. As Maya, create a request on a resource you own and try to approve it. The UI
   does not offer self-approval; the service returns `SELF_APPROVAL`.
4. Try to check in before the window opens, or as a different user. The service
   refuses.
5. Sign out; `/bookings` redirects to login.
6. Inspect the database directly and attempt
   `UPDATE audit_events SET summary='rewritten'` — SQLite rejects it with
   `AUDIT_APPEND_ONLY`.
7. Attempt a direct overlapping approved insert — SQLite rejects it with
   `BOOKING_CONFLICT`.

Commands 6–7 are automated in `tests/lifecycle.test.ts`; you do not need to run
SQL manually.

## 8. What to say about deployment

Say exactly this:

> "The product is fully runnable locally and verified by 29 integration/unit
> tests and 3 browser tests. It is not publicly deployed. We had no Vercel or
> Supabase authorization, and the current SQLite store is not persistent on a
> serverless host. The Supabase schema and RLS are prepared but unapplied and
> unverified."

Do not claim a live URL, production readiness, RLS coverage, storage uploads or
real institutional adoption.

## 9. Reset between judges

```bash
npm run db:reset
```

The seed is idempotent on setup but `db:reset` intentionally deletes and
recreates the demo database. It refuses any path that does not end in `.db`.
`npm run test:e2e` uses a separate `data/e2e.db` and does not touch the demo.
