import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileCheck2,
  History,
  Info,
  MapPin,
  PackageCheck,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Stethoscope,
  UserRound,
  XCircle,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import {
  evaluateBookingEligibility,
  getBookingDetail,
  getBookingEventDetails,
  getBookingIncidents,
  getBookingWaitlist,
  getConditionReports,
} from "@/lib/bookings";
import { isOverdue, checkInAvailability } from "@/lib/state-machine";
import {
  cancelBookingAction,
  checkInAction,
  confirmReturnAction,
  decideBookingAction,
  reportIncidentAction,
  submitReturnAction,
} from "@/lib/actions/bookings";
import { CONDITION_GRADES, CONDITION_LABELS, INCIDENT_SEVERITIES, INCIDENT_TYPES, INCIDENT_TYPE_LABELS } from "@/lib/domain";
import { formatDateTime, formatDateTimeRange, formatDuration, formatRelative, nowIso } from "@/lib/time";
import { ActionForm } from "@/components/forms/action-form";
import { EligibilityPanel } from "@/components/bookings/eligibility-panel";
import { BookingStatusBadge } from "@/components/bookings/status-badge";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/feedback";
import { Field, Input, Select, Textarea } from "@/components/ui/fields";
import { buttonStyles } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";

export const metadata: Metadata = { title: "Booking detail" };

const EVENT_LABELS: Record<string, string> = {
  submitted: "Request submitted",
  eligibility_checked: "Eligibility checked",
  approved: "Approved by owner",
  rejected: "Request declined",
  waitlisted: "Waitlisted",
  waitlist_review_opened: "Waitlist review opened",
  cancelled: "Booking cancelled",
  checked_in: "Checked in",
  return_submitted: "Return submitted",
  return_confirmed: "Return confirmed",
  incident_opened: "Incident reported",
  incident_updated: "Incident updated",
  incident_resolved: "Incident resolved",
};

export default async function BookingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const user = await requireUser(`/bookings/${id}`);
  const db = getDb();

  let booking;
  try {
    booking = getBookingDetail(db, user, id);
  } catch {
    notFound();
  }
  if (!booking) notFound();

  const isBorrower = booking.borrower_id === user.id;
  const membership = user.memberships.find((entry) => entry.organizationId === booking.organization_id);
  const isReviewer = Boolean(
    membership &&
      membership.status === "active" &&
      (membership.role === "manager" ||
        membership.role === "admin" ||
        (membership.role === "owner" && booking.resource.owner_id === user.id)),
  );
  const events = getBookingEventDetails(db, id);
  const conditions = getConditionReports(db, id);
  const incidents = getBookingIncidents(db, id);
  const waitlist = booking.status === "waitlisted" ? getBookingWaitlist(db, id) : null;
  const now = nowIso();
  const overdue = isOverdue(booking, now);
  const checkIn = checkInAvailability(booking, now);
  const eligibility =
    isReviewer && ["pending", "waitlisted"].includes(booking.status)
      ? evaluateBookingEligibility(db, id, "approval", now)
      : null;
  const checkInReport = conditions.find((report) => report.phase === "check_in");
  const checkOutReport = conditions.find((report) => report.phase === "check_out");
  const canReportIncident =
    (isBorrower || isReviewer) &&
    ["approved", "checked_in", "return_submitted", "completed"].includes(booking.status);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={isReviewer && !isBorrower ? "/owner/requests" : "/bookings"}
          className="inline-flex items-center gap-1.5 text-[0.78rem] font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          {isReviewer && !isBorrower ? "Request queue" : "My bookings"}
        </Link>
        <span className="font-mono text-[0.62rem] uppercase tracking-[0.1em] text-muted-foreground">
          Booking {booking.id.slice(0, 8)}
        </span>
      </div>

      {query.created ? (
        <Alert tone="success" title="Request submitted">
          Your request is now in the owner&apos;s review queue. Eligibility checks passed at
          submission and will be re-checked if the owner approves.
        </Alert>
      ) : null}

      <header className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <BookingStatusBadge status={booking.status} overdue={overdue} />
              {waitlist ? <Badge tone="info">Position {waitlist.position} of {waitlist.total}</Badge> : null}
              {booking.status === "completed" ? (
                <Badge tone="success" dot>
                  Custody closed
                </Badge>
              ) : null}
            </div>
            <h1 className="mt-3 text-[1.7rem] font-bold leading-tight tracking-[-0.035em] sm:text-[2.1rem]">
              {booking.resource.name}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[0.78rem] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <CalendarClock className="size-3.5" />
                {formatDateTimeRange(booking.starts_at, booking.ends_at)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock3 className="size-3.5" /> {formatDuration(booking.starts_at, booking.ends_at)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-3.5" /> {booking.resource.location}
              </span>
            </div>
          </div>
          <Link
            href={`/resources/${booking.resource.id}`}
            className={buttonStyles({ variant: "outline", size: "sm" })}
          >
            View listing
          </Link>
        </div>

        <dl className="mt-5 grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
          <div>
            <dt className="specimen-code">Requested by</dt>
            <dd className="mt-1.5 flex items-center gap-2">
              <Avatar name={booking.borrower.full_name} color={booking.borrower.avatar_color} size="sm" />
              <span>
                <span className="block text-[0.8rem] font-bold">{booking.borrower.full_name}</span>
                <span className="block text-[0.68rem] text-muted-foreground">
                  {booking.borrower.email}
                </span>
              </span>
            </dd>
          </div>
          <div>
            <dt className="specimen-code">Resource owner</dt>
            <dd className="mt-1.5 flex items-center gap-2">
              <Avatar name={booking.resourceOwner.full_name} size="sm" />
              <span>
                <span className="block text-[0.8rem] font-bold">{booking.resourceOwner.full_name}</span>
                <span className="block text-[0.68rem] text-muted-foreground">
                  {booking.resourceOwner.email}
                </span>
              </span>
            </dd>
          </div>
        </dl>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
        <div className="space-y-6">
          <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
            <h2 className="text-[0.95rem] font-bold">Purpose & notes</h2>
            <p className="mt-2 whitespace-pre-line text-[0.86rem] leading-[1.8] text-ink-soft">
              {booking.purpose}
            </p>
            {booking.notes ? (
              <div className="mt-4 rounded-xl border border-border bg-muted/30 p-3.5">
                <p className="specimen-code">Requester notes</p>
                <p className="mt-1 whitespace-pre-line text-[0.8rem] leading-relaxed text-muted-foreground">
                  {booking.notes}
                </p>
              </div>
            ) : null}
            {booking.decision_reason ? (
              <div className="mt-4 rounded-xl border border-border bg-muted/30 p-3.5">
                <p className="specimen-code">Owner decision / reason</p>
                <p className="mt-1 text-[0.8rem] leading-relaxed text-ink-soft">
                  {booking.decision_reason}
                </p>
                {booking.decided_at ? (
                  <p className="mt-1 text-[0.66rem] text-muted-foreground">
                    Recorded {formatDateTime(booking.decided_at)}
                  </p>
                ) : null}
              </div>
            ) : null}
          </section>

          {isReviewer && ["pending", "waitlisted"].includes(booking.status) ? (
            <section className="rounded-2xl border border-primary/25 bg-card p-5 sm:p-6">
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                <div>
                  <h2 className="text-[0.95rem] font-bold">Review this request</h2>
                  <p className="mt-0.5 text-[0.72rem] leading-relaxed text-muted-foreground">
                    You are seeing this as an authorized reviewer. Approval re-runs every
                    eligibility check and the conflict guard inside one transaction.
                  </p>
                </div>
              </div>
              {eligibility ? <EligibilityPanel result={eligibility} compact className="mt-4" /> : null}
              {booking.borrower_id === user.id ? (
                <Alert tone="warning" className="mt-4">
                  You cannot review your own request. Another manager or owner must decide it.
                </Alert>
              ) : (
                <div className="mt-4 border-t border-border pt-4">
                  <ActionForm
                    action={decideBookingAction}
                    submitLabel="Record decision"
                    pendingLabel="Recording decision…"
                    className="space-y-4"
                  >
                    <input type="hidden" name="bookingId" value={booking.id} />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Decision" htmlFor="decision">
                        <Select id="decision" name="decision" defaultValue="approve" required>
                          <option value="approve">Approve the request</option>
                          <option value="reject">Decline the request</option>
                          <option value="waitlist">Waitlist the request</option>
                        </Select>
                      </Field>
                      <Field label="Reviewer" htmlFor="reviewer-display">
                        <Input id="reviewer-display" value={user.fullName} disabled />
                      </Field>
                    </div>
                    <Field
                      label="Written reason"
                      htmlFor="reason"
                      hint="Required for decline or waitlist. Stored in the timeline and audit log."
                    >
                      <Textarea
                        id="reason"
                        name="reason"
                        maxLength={600}
                        className="min-h-20"
                        placeholder="Explain the decision, the conflicting window, or the condition the member must meet."
                      />
                    </Field>
                    <Alert tone="info">
                      Approving holds the slot immediately. If another approved booking already
                      occupies this window, the mutation is rejected — no double booking.
                    </Alert>
                  </ActionForm>
                </div>
              )}
            </section>
          ) : null}

          {isBorrower && booking.status === "approved" ? (
            <section className="rounded-2xl border border-primary/25 bg-card p-5 sm:p-6">
              <div className="flex items-start gap-2.5">
                <PackageCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                <div>
                  <h2 className="text-[0.95rem] font-bold">Check in & record initial condition</h2>
                  <p className="mt-0.5 text-[0.72rem] leading-relaxed text-muted-foreground">
                    Check-in opens 30 minutes before the start and closes 2 hours after it. Custody
                    transfers to you when this is recorded.
                  </p>
                </div>
              </div>
              <p className="mt-3 rounded-lg border border-border bg-muted/30 px-3 py-2 text-[0.72rem] text-muted-foreground">
                Window: {formatDateTime(checkIn.opensAt)} → {formatDateTime(checkIn.closesAt)}
              </p>
              {checkIn.allowed ? (
                <div className="mt-4 border-t border-border pt-4">
                  <ActionForm
                    action={checkInAction}
                    submitLabel="Check in & take custody"
                    pendingLabel="Recording custody…"
                    className="space-y-4"
                  >
                    <input type="hidden" name="bookingId" value={booking.id} />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Initial condition" htmlFor="condition">
                        <Select id="condition" name="condition" defaultValue="good" required>
                          {CONDITION_GRADES.map((grade) => (
                            <option key={grade} value={grade}>
                              {CONDITION_LABELS[grade]}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <Field label="Condition notes" htmlFor="condition-notes" optional>
                        <Input
                          id="condition-notes"
                          name="notes"
                          maxLength={1000}
                          placeholder="Existing marks, missing parts, setup state"
                        />
                      </Field>
                    </div>
                    <label className="flex items-start gap-2.5 rounded-xl border border-border bg-muted/30 p-3 text-[0.78rem]">
                      <input
                        type="checkbox"
                        name="accessoriesOk"
                        defaultChecked
                        className="mt-0.5 size-4 shrink-0 accent-[var(--primary)]"
                      />
                      All listed accessories and safety equipment are present.
                    </label>
                    <label className="flex items-start gap-2.5 rounded-xl border border-border bg-muted/30 p-3 text-[0.78rem]">
                      <input
                        type="checkbox"
                        name="rulesAcknowledged"
                        required
                        className="mt-0.5 size-4 shrink-0 accent-[var(--primary)]"
                      />
                      I acknowledge the usage rules and will operate this resource safely.
                    </label>
                  </ActionForm>
                </div>
              ) : (
                <Alert tone="warning" className="mt-4">
                  {checkIn.reason ?? "Check-in is not open yet."} You can return to this page inside
                  the window.
                </Alert>
              )}
            </section>
          ) : null}

          {isBorrower && booking.status === "checked_in" ? (
            <section className="rounded-2xl border border-primary/25 bg-card p-5 sm:p-6">
              <div className="flex items-start gap-2.5">
                <RotateCcw className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                <div>
                  <h2 className="text-[0.95rem] font-bold">Submit the return</h2>
                  <p className="mt-0.5 text-[0.72rem] leading-relaxed text-muted-foreground">
                    Record the final condition honestly. The owner must confirm the hand-back before
                    custody closes. This report is append-only.
                  </p>
                </div>
              </div>
              <div className="mt-4 border-t border-border pt-4">
                <ActionForm
                  action={submitReturnAction}
                  submitLabel="Submit return & condition"
                  pendingLabel="Submitting return…"
                  className="space-y-4"
                >
                  <input type="hidden" name="bookingId" value={booking.id} />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Final condition" htmlFor="final-condition">
                      <Select id="final-condition" name="condition" defaultValue="good" required>
                        {CONDITION_GRADES.map((grade) => (
                          <option key={grade} value={grade}>
                            {CONDITION_LABELS[grade]}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Return notes" htmlFor="return-notes" optional>
                      <Input
                        id="return-notes"
                        name="notes"
                        maxLength={1000}
                        placeholder="Anything the owner should inspect"
                      />
                    </Field>
                  </div>
                  <label className="flex items-start gap-2.5 rounded-xl border border-border bg-muted/30 p-3 text-[0.78rem]">
                    <input
                      type="checkbox"
                      name="accessoriesOk"
                      defaultChecked
                      className="mt-0.5 size-4 shrink-0 accent-[var(--primary)]"
                    />
                    All accessories are returned and the workspace is clear.
                  </label>
                </ActionForm>
              </div>
            </section>
          ) : null}

          {isReviewer && booking.status === "return_submitted" ? (
            <section className="rounded-2xl border border-success/25 bg-card p-5 sm:p-6">
              <div className="flex items-start gap-2.5">
                <FileCheck2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                <div>
                  <h2 className="text-[0.95rem] font-bold">Confirm the return</h2>
                  <p className="mt-0.5 text-[0.72rem] leading-relaxed text-muted-foreground">
                    {booking.borrower.full_name} submitted the final condition. Inspect the
                    resource, then close custody. This action completes the booking.
                  </p>
                </div>
              </div>
              <div className="mt-4 border-t border-border pt-4">
                <ActionForm
                  action={confirmReturnAction}
                  submitLabel="Confirm return & close custody"
                  pendingLabel="Closing custody…"
                  className="space-y-4"
                >
                  <input type="hidden" name="bookingId" value={booking.id} />
                  <Field label="Confirmation note" htmlFor="confirm-note" optional>
                    <Textarea
                      id="confirm-note"
                      name="note"
                      maxLength={600}
                      className="min-h-20"
                      placeholder="Condition verified, accessories counted, bay left clean."
                    />
                  </Field>
                </ActionForm>
              </div>
            </section>
          ) : null}

          {isReviewer && booking.status === "approved" ? (
            <Alert tone="info" title="Awaiting borrower check-in">
              The slot is held. The borrower can check in from 30 minutes before the start. If they
              do not, the resource remains reserved until the booking is cancelled or resolved.
            </Alert>
          ) : null}

          {isReviewer && booking.status === "checked_in" ? (
            <Alert tone="info" title="Resource is in borrower custody">
              {booking.borrower.full_name} checked in {booking.checked_in_at ? formatRelative(booking.checked_in_at) : ""}.
              The return will appear here for your confirmation.
            </Alert>
          ) : null}

          {isBorrower && ["pending", "waitlisted", "approved"].includes(booking.status) ? (
            <details className="group rounded-2xl border border-border bg-card p-5">
              <summary className="flex cursor-pointer items-center justify-between gap-3 text-[0.86rem] font-bold">
                <span className="inline-flex items-center gap-2">
                  <XCircle className="size-4 text-muted-foreground" aria-hidden /> Cancel this booking
                </span>
                <span className="text-[0.68rem] font-medium text-muted-foreground group-open:hidden">
                  Open
                </span>
              </summary>
              <p className="mt-2 text-[0.72rem] leading-relaxed text-muted-foreground">
                Cancelling is recorded in the timeline. If this booking held an approved slot, the
                earliest eligible waitlisted request returns to human review.
              </p>
              <div className="mt-3 border-t border-border pt-3">
                <ActionForm
                  action={cancelBookingAction}
                  submitLabel="Cancel booking"
                  pendingLabel="Cancelling…"
                  submitVariant="danger"
                  className="space-y-3"
                >
                  <input type="hidden" name="bookingId" value={booking.id} />
                  <Field label="Reason" htmlFor="cancel-reason" optional>
                    <Input id="cancel-reason" name="reason" maxLength={500} placeholder="Optional for the borrower" />
                  </Field>
                </ActionForm>
              </div>
            </details>
          ) : null}

          <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
            <h2 className="flex items-center gap-2 text-[0.95rem] font-bold">
              <ClipboardCheck className="size-4 text-primary" aria-hidden /> Condition reports
            </h2>
            {conditions.length > 0 ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {conditions.map((report) => (
                  <div key={report.id} className="rounded-xl border border-border bg-muted/20 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[0.66rem] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                        {report.phase === "check_in" ? "Initial · check-in" : "Final · return"}
                      </p>
                      <Badge tone={report.condition === "excellent" || report.condition === "good" ? "success" : report.condition === "damaged" ? "danger" : "warning"}>
                        {CONDITION_LABELS[report.condition]}
                      </Badge>
                    </div>
                    <p className="mt-2 text-[0.78rem] font-semibold">
                      Accessories {report.accessories_ok ? "present" : "missing"}
                    </p>
                    <p className="mt-1 text-[0.74rem] leading-relaxed text-muted-foreground">
                      {report.notes ?? "No additional notes."}
                    </p>
                    <p className="mt-2 text-[0.64rem] text-muted-foreground">
                      {formatDateTime(report.created_at)} · append-only
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-[0.8rem] text-muted-foreground">
                Condition reports appear when the borrower checks in and submits the return.
              </p>
            )}
          </section>

          <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h2 className="flex items-center gap-2 text-[0.95rem] font-bold">
                <Stethoscope className="size-4 text-primary" aria-hidden /> Incidents
              </h2>
              {isReviewer ? (
                <Link href="/owner/incidents" className="text-[0.72rem] font-bold text-primary hover:underline">
                  Incident desk →
                </Link>
              ) : null}
            </div>
            {incidents.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {incidents.map((incident) => (
                  <li key={incident.id} className="rounded-xl border border-border bg-muted/20 p-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[0.78rem] font-bold">
                        {INCIDENT_TYPE_LABELS[incident.type]} · {incident.severity} severity
                      </p>
                      <Badge
                        tone={
                          incident.status === "resolved"
                            ? "success"
                            : incident.status === "dismissed"
                              ? "neutral"
                              : incident.status === "reviewing"
                                ? "info"
                                : "warning"
                        }
                      >
                        {incident.status}
                      </Badge>
                    </div>
                    <p className="mt-1.5 text-[0.76rem] leading-relaxed text-muted-foreground">
                      {incident.description}
                    </p>
                    {incident.resolution_notes ? (
                      <p className="mt-1.5 border-t border-border pt-1.5 text-[0.72rem] leading-relaxed">
                        <span className="font-bold">Resolution:</span> {incident.resolution_notes}
                      </p>
                    ) : (
                      <p className="mt-1.5 text-[0.66rem] font-medium text-warning">
                        Awaiting human review · no automatic penalty
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[0.8rem] text-muted-foreground">
                No incidents are attached to this booking.
              </p>
            )}

            {canReportIncident ? (
              <details className="group mt-4 border-t border-border pt-4">
                <summary className="flex cursor-pointer items-center gap-2 text-[0.78rem] font-bold text-primary">
                  <ShieldAlert className="size-3.5" aria-hidden /> Report an incident
                </summary>
                <div className="mt-3">
                  <ActionForm
                    action={reportIncidentAction}
                    submitLabel="Submit incident for review"
                    pendingLabel="Recording incident…"
                    className="space-y-3"
                  >
                    <input type="hidden" name="bookingId" value={booking.id} />
                    <input type="hidden" name="resourceId" value={booking.resource.id} />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Issue type" htmlFor="incident-type">
                        <Select id="incident-type" name="type" defaultValue="damage" required>
                          {INCIDENT_TYPES.map((type) => (
                            <option key={type} value={type}>
                              {INCIDENT_TYPE_LABELS[type]}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <Field label="Severity" htmlFor="incident-severity">
                        <Select id="incident-severity" name="severity" defaultValue="medium" required>
                          {INCIDENT_SEVERITIES.map((severity) => (
                            <option key={severity} value={severity}>
                              {severity}
                            </option>
                          ))}
                        </Select>
                      </Field>
                    </div>
                    <Field label="What happened?" htmlFor="incident-description">
                      <Textarea
                        id="incident-description"
                        name="description"
                        required
                        minLength={15}
                        maxLength={1500}
                        className="min-h-24"
                        placeholder="Describe the damage, missing item, late return or access conflict. Do not assign blame."
                      />
                    </Field>
                    <p className="text-[0.66rem] leading-relaxed text-muted-foreground">
                      Reporting an incident never applies an automatic penalty. A reviewer records
                      the outcome in writing.
                    </p>
                  </ActionForm>
                </div>
              </details>
            ) : null}
          </section>

          <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
            <h2 className="flex items-center gap-2 text-[0.95rem] font-bold">
              <History className="size-4 text-primary" aria-hidden /> Timeline
            </h2>
            <ol className="mt-4">
              {events.map((event, index) => (
                <li key={event.id} className="relative flex gap-3 pb-5 last:pb-0">
                  {index < events.length - 1 ? (
                    <span className="absolute left-[9px] top-5 h-full w-px bg-border" aria-hidden />
                  ) : null}
                  <span
                    className={`relative z-10 mt-1 flex size-[19px] shrink-0 items-center justify-center rounded-full border-2 ${
                      index === events.length - 1
                        ? "border-primary bg-primary"
                        : "border-border bg-card"
                    }`}
                    aria-hidden
                  >
                    {index === events.length - 1 ? (
                      <span className="size-1.5 rounded-full bg-primary-foreground" />
                    ) : null}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <p className="text-[0.8rem] font-bold">
                        {EVENT_LABELS[event.kind] ?? event.kind.replaceAll("_", " ")}
                      </p>
                      <time className="text-[0.64rem] text-muted-foreground" dateTime={event.created_at}>
                        {formatDateTime(event.created_at)}
                      </time>
                    </div>
                    <p className="mt-0.5 text-[0.74rem] leading-relaxed text-muted-foreground">
                      {event.summary}
                    </p>
                    <p className="mt-0.5 text-[0.64rem] text-muted-foreground">
                      {event.actorName ? `By ${event.actorName}` : "System action"}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-4 border-t border-border pt-3 text-[0.66rem] leading-relaxed text-muted-foreground">
              Timeline events are append-only. The application cannot edit or delete them once
              written.
            </p>
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24">
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="eyebrow">Custody state</p>
            <div className="mt-3 space-y-2.5">
              {[
                ["Created", booking.created_at, true],
                ["Decision", booking.decided_at, Boolean(booking.decided_at)],
                ["Checked in", booking.checked_in_at, Boolean(booking.checked_in_at)],
                ["Return submitted", booking.return_submitted_at, Boolean(booking.return_submitted_at)],
                ["Completed", booking.completed_at, Boolean(booking.completed_at)],
              ].map(([label, timestamp, done]) => (
                <div key={String(label)} className="flex items-start gap-2">
                  {done ? (
                    <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-success" aria-hidden />
                  ) : (
                    <span className="mt-1 size-3.5 shrink-0 rounded-full border border-border" aria-hidden />
                  )}
                  <div>
                    <p className="text-[0.74rem] font-semibold">{String(label)}</p>
                    <p className="text-[0.65rem] text-muted-foreground">
                      {timestamp ? formatDateTime(String(timestamp)) : "Not yet"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {waitlist ? (
            <div className="rounded-2xl border border-info/25 bg-info-soft p-5 text-info">
              <p className="flex items-center gap-1.5 text-[0.78rem] font-bold">
                <Info className="size-3.5" aria-hidden /> Waitlist position
              </p>
              <p className="mt-2 text-2xl font-bold tracking-[-0.04em]">
                {waitlist.position} <span className="text-sm font-semibold opacity-70">of {waitlist.total}</span>
              </p>
              <p className="mt-1 text-[0.72rem] leading-relaxed opacity-90">
                If an approved booking is cancelled, the first eligible waitlisted request returns
                to owner review — never an automatic approval.
              </p>
            </div>
          ) : null}

          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="flex items-center gap-1.5 text-[0.78rem] font-bold">
              <ShieldCheck className="size-3.5 text-primary" aria-hidden /> Fair access
            </p>
            <p className="mt-2 text-[0.72rem] leading-relaxed text-muted-foreground">
              This resource allows {booking.resource.fair_use_limit} active request
              {booking.resource.fair_use_limit === 1 ? "" : "s"} per member and up to{" "}
              {booking.resource.max_duration_hours} hours per booking. Conflict checks run at both
              approval and database level.
            </p>
          </div>

          {checkInReport ? (
            <div className="rounded-2xl border border-border bg-card p-5">
              <p className="eyebrow">Initial condition</p>
              <p className="mt-2 text-[0.82rem] font-bold">{CONDITION_LABELS[checkInReport.condition]}</p>
              <p className="mt-1 text-[0.72rem] leading-relaxed text-muted-foreground">
                {checkInReport.notes ?? "No notes recorded."}
              </p>
              {checkOutReport ? (
                <div className="mt-3 border-t border-border pt-3">
                  <p className="eyebrow">Final condition</p>
                  <p className="mt-2 text-[0.82rem] font-bold">{CONDITION_LABELS[checkOutReport.condition]}</p>
                  <p className="mt-1 text-[0.72rem] leading-relaxed text-muted-foreground">
                    {checkOutReport.notes ?? "No notes recorded."}
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="rounded-2xl border border-dashed border-border p-4">
            <p className="flex items-center gap-1.5 text-[0.72rem] font-bold text-muted-foreground">
              <UserRound className="size-3.5" aria-hidden /> Who can see this
            </p>
            <p className="mt-1.5 text-[0.68rem] leading-relaxed text-muted-foreground">
              The borrower, the resource owner and authorized organization managers. Other members
              cannot open this booking.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
