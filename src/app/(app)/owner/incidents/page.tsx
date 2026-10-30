import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, ArrowRight, CheckCircle2, ShieldAlert, Stethoscope } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { listIncidentsForManager } from "@/lib/incidents";
import { reviewIncidentAction } from "@/lib/actions/bookings";
import {
  INCIDENT_SEVERITIES,
  INCIDENT_TYPE_LABELS,
  INCIDENT_TYPES,
} from "@/lib/domain";
import { formatDateTime, formatDateTimeRange, formatRelative } from "@/lib/time";
import { PageHeader, StatCard } from "@/components/ui/page";
import { ActionForm } from "@/components/forms/action-form";
import { Field, Select, Textarea } from "@/components/ui/fields";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState, Alert } from "@/components/ui/feedback";

export const metadata: Metadata = { title: "Incident desk" };

const TONES = {
  open: "warning",
  reviewing: "info",
  resolved: "success",
  dismissed: "neutral",
} as const;

export default async function OwnerIncidentsPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string; type?: string }>;
}) {
  const user = await requireUser("/owner/incidents");
  const membership = user.memberships.find(
    (entry) => entry.status === "active" && ["owner", "manager", "admin"].includes(entry.role),
  );
  if (!membership) redirect("/dashboard");
  const params = await searchParams;
  const scope = params.scope === "open" ? "open" : "all";
  const typeFilter = INCIDENT_TYPES.includes(params.type as (typeof INCIDENT_TYPES)[number])
    ? (params.type as (typeof INCIDENT_TYPES)[number])
    : "all";
  const db = getDb();
  const all = listIncidentsForManager(db, user, membership.organizationId, "all");
  const incidents = all.filter(
    (incident) =>
      (scope === "all" || incident.status === "open" || incident.status === "reviewing") &&
      (typeFilter === "all" || incident.type === typeFilter),
  );
  const open = all.filter((incident) => incident.status === "open");
  const reviewing = all.filter((incident) => incident.status === "reviewing");
  const closed = all.filter((incident) => ["resolved", "dismissed"].includes(incident.status));

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow={`${membership.organizationName} · incident desk`}
        title="Incidents & human review"
        description="Reports are statements, not verdicts. LabLoop never applies an automatic penalty: an authorized reviewer records the outcome in writing, and the reporter is notified."
        actions={
          <Link href="/owner/custody" className={buttonStyles({ variant: "outline" })}>
            Custody queue <ArrowRight className="size-4" />
          </Link>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Open" value={open.length} hint="Not yet reviewed" icon={<AlertTriangle className="size-4" />} tone={open.length ? "warning" : "default"} />
        <StatCard label="In review" value={reviewing.length} hint="Reviewer assigned in writing" icon={<Stethoscope className="size-4" />} tone={reviewing.length ? "primary" : "default"} />
        <StatCard label="Resolved" value={all.filter((incident) => incident.status === "resolved").length} hint="Outcome recorded" icon={<CheckCircle2 className="size-4" />} tone="primary" />
        <StatCard label="Dismissed" value={all.filter((incident) => incident.status === "dismissed").length} hint="No action required" icon={<ShieldAlert className="size-4" />} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/owner/incidents?scope=open${typeFilter !== "all" ? `&type=${typeFilter}` : ""}`}
          className={buttonStyles({ variant: scope === "open" ? "primary" : "outline", size: "sm" })}
        >
          Needs review
        </Link>
        <Link
          href={`/owner/incidents${typeFilter !== "all" ? `?type=${typeFilter}` : ""}`}
          className={buttonStyles({ variant: scope === "all" ? "primary" : "outline", size: "sm" })}
        >
          All ({all.length})
        </Link>
        <span className="mx-1 h-5 w-px bg-border" aria-hidden />
        <Link
          href={`/owner/incidents?scope=${scope}`}
          className={buttonStyles({ variant: typeFilter === "all" ? "secondary" : "ghost", size: "sm" })}
        >
          Every type
        </Link>
        {INCIDENT_TYPES.map((type) => (
          <Link
            key={type}
            href={`/owner/incidents?scope=${scope}&type=${type}`}
            className={buttonStyles({ variant: typeFilter === type ? "secondary" : "ghost", size: "sm" })}
          >
            {INCIDENT_TYPE_LABELS[type]}
          </Link>
        ))}
      </div>

      <Alert tone="info">
        <span className="font-semibold">Self-review is blocked.</span> If you reported an incident,
        another manager or administrator must review it. Resolution or dismissal requires a written
        note of at least 10 characters.
      </Alert>

      {incidents.length === 0 ? (
        <EmptyState
          icon={<Stethoscope className="size-5" />}
          title="No incidents match this view"
          description="When a member or owner reports damage, a missing accessory, a late return or an access conflict, it appears here for human review."
        />
      ) : (
        <div className="space-y-3">
          {incidents.map((incident) => {
            const canReview = incident.reporter_id !== user.id;
            return (
              <article key={incident.id} className="rounded-2xl border border-border bg-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={TONES[incident.status]} dot>
                        {incident.status}
                      </Badge>
                      <Badge tone={incident.severity === "high" ? "danger" : incident.severity === "medium" ? "warning" : "outline"}>
                        {incident.severity} severity
                      </Badge>
                      <span className="specimen-code">{INCIDENT_TYPE_LABELS[incident.type]}</span>
                    </div>
                    <h2 className="mt-2 text-[1rem] font-bold tracking-[-0.015em]">
                      {incident.resource.name}
                    </h2>
                    <p className="mt-0.5 text-[0.72rem] text-muted-foreground">
                      Reported by {incident.reporterName} · {formatRelative(incident.created_at)} ·{" "}
                      {formatDateTime(incident.created_at)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/resources/${incident.resource.id}`}
                      className={buttonStyles({ variant: "outline", size: "sm" })}
                    >
                      Listing
                    </Link>
                    {incident.booking ? (
                      <Link
                        href={`/bookings/${incident.booking.id}`}
                        className={buttonStyles({ variant: "outline", size: "sm" })}
                      >
                        Booking
                      </Link>
                    ) : null}
                  </div>
                </div>

                <p className="mt-3 whitespace-pre-line text-[0.84rem] leading-[1.75] text-ink-soft">
                  {incident.description}
                </p>

                {incident.booking ? (
                  <p className="mt-2 rounded-lg border border-border bg-muted/25 px-3 py-2 font-mono text-[0.66rem] text-muted-foreground">
                    Attached booking: {formatDateTimeRange(incident.booking.starts_at, incident.booking.ends_at)} ·{" "}
                    {incident.booking.status.replaceAll("_", " ")}
                  </p>
                ) : null}

                {incident.resolution_notes ? (
                  <div className="mt-3 rounded-xl border border-success/20 bg-success-soft/50 p-3.5">
                    <p className="text-[0.68rem] font-bold uppercase tracking-[0.08em] text-success">
                      Reviewer outcome
                    </p>
                    <p className="mt-1 whitespace-pre-line text-[0.78rem] leading-relaxed text-success">
                      {incident.resolution_notes}
                    </p>
                    {incident.resolved_at ? (
                      <p className="mt-1 text-[0.64rem] text-success/80">
                        Recorded {formatDateTime(incident.resolved_at)}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-3 flex items-center gap-1.5 text-[0.7rem] font-semibold text-warning">
                    <AlertTriangle className="size-3.5" aria-hidden /> Awaiting human review · no
                    penalty has been applied
                  </p>
                )}

                {canReview ? (
                  <details className="group mt-4 border-t border-border pt-4">
                    <summary className="flex cursor-pointer items-center justify-between gap-2 text-[0.8rem] font-bold text-primary">
                      Review this incident
                      <span className="text-[0.66rem] font-medium text-muted-foreground group-open:hidden">
                        Open
                      </span>
                    </summary>
                    <div className="mt-3">
                      <ActionForm
                        action={reviewIncidentAction}
                        submitLabel="Save review"
                        pendingLabel="Saving review…"
                        submitVariant="outline"
                        className="space-y-3"
                      >
                        <input type="hidden" name="incidentId" value={incident.id} />
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Field label="New status" htmlFor={`status-${incident.id}`}>
                            <Select
                              id={`status-${incident.id}`}
                              name="status"
                              defaultValue={
                                incident.status === "open" ? "reviewing" : incident.status
                              }
                            >
                              <option value="reviewing">Move to review</option>
                              <option value="resolved">Resolve</option>
                              <option value="dismissed">Dismiss</option>
                              <option value="open">Reopen</option>
                            </Select>
                          </Field>
                          <Field
                            label="Resolution / review note"
                            htmlFor={`notes-${incident.id}`}
                            hint="Required for resolve or dismiss."
                          >
                            <Textarea
                              id={`notes-${incident.id}`}
                              name="resolutionNotes"
                              maxLength={1500}
                              className="min-h-20"
                              placeholder="What did you inspect, who did you speak to, and what is the recorded outcome?"
                            />
                          </Field>
                        </div>
                        <p className="text-[0.66rem] leading-relaxed text-muted-foreground">
                          Saving sends a notification to the reporter and appends an audit event.
                          No automatic suspension, fine or penalty is applied.
                        </p>
                      </ActionForm>
                    </div>
                  </details>
                ) : (
                  <p className="mt-3 rounded-lg border border-warning/25 bg-warning-soft px-3 py-2 text-[0.72rem] font-medium text-warning">
                    You reported this incident, so it must be reviewed by another authorized
                    manager.
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2">
          <ShieldAlert className="size-4 text-primary" aria-hidden />
          <p className="text-[0.82rem] font-bold">Incident policy</p>
        </div>
        <div className="mt-2 grid gap-3 text-[0.76rem] leading-relaxed text-muted-foreground sm:grid-cols-3">
          <p>
            <span className="font-semibold text-foreground">No automatic penalties.</span> A report
            opens a human review; it never changes membership status, fair-use limits or access on
            its own.
          </p>
          <p>
            <span className="font-semibold text-foreground">No self-review.</span> The reporter
            cannot decide their own incident, and an outcome requires written notes.
          </p>
          <p>
            <span className="font-semibold text-foreground">No silent closure.</span> Every status
            change notifies the reporter and is appended to the immutable audit log.
          </p>
        </div>
        <p className="mt-3 text-[0.68rem] text-muted-foreground">
          {closed.length} closed incident{closed.length === 1 ? "" : "s"} retained in history.
          Severity values are {INCIDENT_SEVERITIES.join(", ")}.
        </p>
      </div>
    </div>
  );
}
