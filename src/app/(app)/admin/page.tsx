import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  Boxes,
  CheckCircle2,
  ClipboardList,
  Clock3,
  ShieldCheck,
  Users,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getOrganizationOverview } from "@/lib/stats";
import { listOrganizationQualifications } from "@/lib/qualifications";
import { reviewQualificationAction } from "@/lib/actions/qualifications";
import { ROLE_LABELS, type Role } from "@/lib/domain";
import { formatDateTime, formatRelative } from "@/lib/time";
import { PageHeader, StatCard } from "@/components/ui/page";
import { ActionForm } from "@/components/forms/action-form";
import { Field, Input, Select, Textarea } from "@/components/ui/fields";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { Alert, EmptyState } from "@/components/ui/feedback";

export const metadata: Metadata = { title: "Organization overview" };

const QUALIFICATION_TONES = {
  verified: "success",
  pending: "warning",
  expired: "danger",
  revoked: "neutral",
} as const;

export default async function AdminPage() {
  const user = await requireUser("/admin");
  const membership = user.memberships.find(
    (entry) => entry.status === "active" && ["manager", "admin"].includes(entry.role),
  );
  if (!membership) redirect("/dashboard");
  const db = getDb();
  const overview = getOrganizationOverview(db, user, membership.organizationId);
  const qualifications = listOrganizationQualifications(db, membership.organizationId);
  const pending = qualifications.filter((qualification) => qualification.status === "pending");
  const verified = qualifications.filter((qualification) => qualification.status === "verified");
  const declined = qualifications.filter((qualification) =>
    ["expired", "revoked"].includes(qualification.status),
  );
  const inCustody =
    (overview.bookings.checked_in ?? 0) + (overview.bookings.return_submitted ?? 0);

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow={`${membership.organizationName} · ${ROLE_LABELS[membership.role]}`}
        title="Organization overview"
        description="A database-backed view of listings, custody, membership and credential review. No fabricated usage charts — every number is a row in this workspace."
        actions={
          <>
            <Link href="/activity" className={buttonStyles({ variant: "outline" })}>
              Audit activity <ArrowRight className="size-4" />
            </Link>
            <Link href="/owner/resources/new" className={buttonStyles()}>
              New listing
            </Link>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Active listings"
          value={overview.resources.active}
          hint={`${overview.resources.paused} paused · ${overview.resources.archived} archived`}
          icon={<Boxes className="size-4" />}
          tone="primary"
        />
        <StatCard
          label="Active members"
          value={overview.members}
          hint={`${overview.roles.length} role${overview.roles.length === 1 ? "" : "s"} in use`}
          icon={<Users className="size-4" />}
        />
        <StatCard
          label="Custody-bearing"
          value={inCustody}
          hint={`${overview.upcomingCustody} approved / checked in / return pending`}
          icon={<ShieldCheck className="size-4" />}
          tone={inCustody > 0 ? "warning" : "default"}
        />
        <StatCard
          label="Pending credentials"
          value={pending.length}
          hint="Verified human review required"
          icon={<BadgeCheck className="size-4" />}
          tone={pending.length ? "warning" : "default"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
        <div className="space-y-6">
          <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-2">
              <BadgeCheck className="size-4 text-primary" aria-hidden />
              <h2 className="text-[0.98rem] font-bold">Pending qualification review</h2>
              <Badge tone={pending.length ? "warning" : "outline"} className="ml-auto">
                {pending.length} waiting
              </Badge>
            </div>
            <p className="mt-1 text-[0.74rem] leading-relaxed text-muted-foreground">
              Verify only what has been demonstrated in person. A verified credential satisfies a
              resource requirement with the exact same name; pending records never do.
            </p>

            {pending.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-border bg-muted/25 px-4 py-6 text-center text-[0.78rem] text-muted-foreground">
                No pending credentials. New submissions from members appear here for review.
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {pending.map((qualification) => {
                  const isSelf = qualification.user_id === user.id;
                  return (
                    <article key={qualification.id} className="rounded-xl border border-border bg-muted/20 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-[0.84rem] font-bold">{qualification.name}</p>
                          <p className="mt-0.5 text-[0.72rem] text-muted-foreground">
                            {qualification.user_name} · {qualification.user_email}
                          </p>
                          <p className="mt-0.5 text-[0.64rem] text-muted-foreground">
                            Submitted {formatRelative(qualification.created_at)} · kind{" "}
                            {qualification.kind.replaceAll("_", " ")}
                          </p>
                        </div>
                        <Badge tone={QUALIFICATION_TONES[qualification.status]}>
                          {qualification.status}
                        </Badge>
                      </div>
                      {qualification.notes ? (
                        <p className="mt-2 rounded-lg border border-border bg-card px-3 py-2 text-[0.72rem] leading-relaxed text-muted-foreground">
                          {qualification.notes}
                        </p>
                      ) : null}
                      {isSelf ? (
                        <p className="mt-3 rounded-lg border border-warning/25 bg-warning-soft px-3 py-2 text-[0.72rem] font-medium text-warning">
                          This is your own credential. Another manager must verify it.
                        </p>
                      ) : (
                        <details className="group mt-3">
                          <summary className="cursor-pointer text-[0.74rem] font-bold text-primary">
                            Review credential
                          </summary>
                          <div className="mt-3 border-t border-border pt-3">
                            <ActionForm
                              action={reviewQualificationAction}
                              submitLabel="Save review"
                              pendingLabel="Saving…"
                              submitVariant="outline"
                              className="space-y-3"
                            >
                              <input type="hidden" name="organizationId" value={membership.organizationId} />
                              <input type="hidden" name="qualificationId" value={qualification.id} />
                              <div className="grid gap-3 sm:grid-cols-2">
                                <Field label="Decision" htmlFor={`status-${qualification.id}`}>
                                  <Select id={`status-${qualification.id}`} name="status" defaultValue="verified">
                                    <option value="verified">Verify</option>
                                    <option value="expired">Mark expired</option>
                                    <option value="revoked">Revoke</option>
                                    <option value="pending">Keep pending</option>
                                  </Select>
                                </Field>
                                <Field
                                  label="Expires"
                                  htmlFor={`expires-${qualification.id}`}
                                  optional
                                  hint="Leave blank for no expiry."
                                >
                                  <Input id={`expires-${qualification.id}`} name="expiresAt" type="datetime-local" />
                                </Field>
                              </div>
                              <Field
                                label="Reviewer note"
                                htmlFor={`notes-${qualification.id}`}
                                hint="Stored with the credential and sent to the member."
                              >
                                <Textarea
                                  id={`notes-${qualification.id}`}
                                  name="notes"
                                  maxLength={800}
                                  className="min-h-20"
                                  placeholder="Describe the assessment, practical check or evidence reviewed."
                                />
                              </Field>
                            </ActionForm>
                          </div>
                        </details>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-2">
              <CheckCircle2 className="size-4 text-success" aria-hidden />
              <h2 className="text-[0.98rem] font-bold">Verified credentials</h2>
              <Badge tone="outline" className="ml-auto">
                {verified.length}
              </Badge>
            </div>
            {verified.length === 0 ? (
              <p className="mt-3 text-[0.78rem] text-muted-foreground">
                No verified credentials yet in this organization.
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-border overflow-hidden rounded-xl border border-border">
                {verified.map((qualification) => (
                  <li key={qualification.id} className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-3">
                    <div className="min-w-0">
                      <p className="text-[0.78rem] font-semibold">{qualification.name}</p>
                      <p className="text-[0.68rem] text-muted-foreground">
                        {qualification.user_name}
                        {qualification.expires_at
                          ? ` · expires ${formatDateTime(qualification.expires_at)}`
                          : " · no expiry"}
                      </p>
                    </div>
                    <Badge tone="success" dot>
                      verified
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
            {declined.length > 0 ? (
              <p className="mt-3 text-[0.68rem] text-muted-foreground">
                {declined.length} credential{declined.length === 1 ? "" : "s"} expired or revoked
                and do not satisfy requirements.
              </p>
            ) : null}
          </section>
        </div>

        <aside className="space-y-5">
          <section className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-2">
              <ClipboardList className="size-4 text-primary" aria-hidden />
              <h2 className="text-[0.95rem] font-bold">Booking pipeline</h2>
            </div>
            <dl className="mt-3 space-y-2">
              {[
                ["pending", "Awaiting review"],
                ["waitlisted", "Waitlisted"],
                ["approved", "Approved"],
                ["checked_in", "In use"],
                ["return_submitted", "Return pending"],
                ["completed", "Completed"],
                ["rejected", "Not approved"],
                ["cancelled", "Cancelled"],
              ].map(([key, label]) => (
                <div key={key} className="flex items-center justify-between gap-3">
                  <dt className="text-[0.76rem] text-muted-foreground">{label}</dt>
                  <dd className="text-[0.8rem] font-bold number-tabular">
                    {overview.bookings[key] ?? 0}
                  </dd>
                </div>
              ))}
            </dl>
            <Link href="/owner/requests" className={buttonStyles({ variant: "outline", size: "sm", className: "mt-4 w-full" })}>
              Request queue
            </Link>
          </section>

          <section className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-2">
              <Users className="size-4 text-primary" aria-hidden />
              <h2 className="text-[0.95rem] font-bold">Members by role</h2>
            </div>
            <ul className="mt-3 space-y-2">
              {overview.roles.map((entry) => (
                <li key={entry.role} className="flex items-center justify-between gap-3">
                  <span className="text-[0.76rem] text-muted-foreground">
                    {ROLE_LABELS[entry.role as Role] ?? entry.role}
                  </span>
                  <span className="text-[0.8rem] font-bold number-tabular">{entry.count}</span>
                </li>
              ))}
            </ul>
            {overview.openIncidents > 0 ? (
              <p className="mt-3 rounded-lg border border-warning/25 bg-warning-soft px-3 py-2 text-[0.72rem] font-medium text-warning">
                {overview.openIncidents} open incident{overview.openIncidents === 1 ? "" : "s"} need
                human review.
              </p>
            ) : (
              <p className="mt-3 text-[0.72rem] text-muted-foreground">No open incidents.</p>
            )}
          </section>

          <section className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-2">
              <Activity className="size-4 text-primary" aria-hidden />
              <h2 className="text-[0.95rem] font-bold">Recent audit events</h2>
            </div>
            {overview.recentAudit.length > 0 ? (
              <ol className="mt-3 space-y-2.5">
                {overview.recentAudit.slice(0, 8).map((event) => (
                  <li key={event.id} className="border-l-2 border-border pl-2.5">
                    <p className="text-[0.72rem] font-semibold capitalize">
                      {event.action.replaceAll(".", " · ").replaceAll("_", " ")}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-[0.68rem] leading-relaxed text-muted-foreground">
                      {event.summary}
                    </p>
                    <p className="mt-0.5 text-[0.62rem] text-muted-foreground">
                      {event.actor_name ?? "System"} · {formatRelative(event.created_at)}
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-2 text-[0.76rem] text-muted-foreground">No audit events yet.</p>
            )}
            <Link href="/activity" className={buttonStyles({ variant: "ghost", size: "sm", className: "mt-3 w-full" })}>
              Full activity log <ArrowRight className="size-3.5" />
            </Link>
          </section>

          <div className="rounded-2xl border border-dashed border-border p-4">
            <p className="flex items-center gap-1.5 text-[0.72rem] font-bold text-muted-foreground">
              <Clock3 className="size-3.5" aria-hidden /> Timezone
            </p>
            <p className="mt-1.5 text-[0.68rem] leading-relaxed text-muted-foreground">
              All bookings are displayed in {membership.timezone}. Timestamps are stored as UTC ISO
              strings and converted only for display and form input.
            </p>
          </div>
        </aside>
      </div>

      {pending.length > 0 ? (
        <Alert tone="warning" title="Credentials are not self-declared">
          A pending qualification does not satisfy a requirement even if the member claims it. The
          eligibility engine checks only verified, unexpired records.
        </Alert>
      ) : null}

      {qualifications.length === 0 ? (
        <EmptyState
          icon={<BadgeCheck className="size-5" />}
          title="No credential records"
          description="Members' training and lab badges will appear here for verification. You can add requirements to a listing at any time."
          action={
            <Link href="/owner/resources" className={buttonStyles({ variant: "outline" })}>
              Manage listings
            </Link>
          }
        />
      ) : null}
    </div>
  );
}
