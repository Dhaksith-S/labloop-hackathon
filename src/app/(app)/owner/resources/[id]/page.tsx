import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  CalendarOff,
  ClipboardCheck,
  ExternalLink,
  Lock,
  Plus,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { assertCanManageResource, getResourceById } from "@/lib/resources";
import {
  addAvailabilityAction,
  addBlackoutAction,
  addRequirementAction,
  removeAvailabilityAction,
  removeBlackoutAction,
  removeRequirementAction,
  updateResourceAction,
} from "@/lib/actions/resources";
import { CATEGORY_LABELS, RESOURCE_CATEGORIES } from "@/lib/domain";
import { WEEKDAY_LONG_LABELS, formatDateTimeRange, formatMinuteOfDay } from "@/lib/time";
import { DomainError } from "@/lib/state-machine";
import { ActionForm, InlineAction } from "@/components/forms/action-form";
import { Field, Input, Select, Textarea } from "@/components/ui/fields";
import { Alert } from "@/components/ui/feedback";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page";

export const metadata: Metadata = { title: "Manage listing" };

export default async function OwnerResourceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const user = await requireUser(`/owner/resources/${id}`);
  const db = getDb();
  const resource = getResourceById(db, id);
  if (!resource) notFound();
  try {
    assertCanManageResource(db, user, id);
  } catch (error) {
    if (error instanceof DomainError) notFound();
    throw error;
  }

  const upcomingBookings = db
    .prepare(
      `SELECT b.id, b.status, b.starts_at, b.ends_at, p.full_name AS borrower_name
       FROM bookings b JOIN profiles p ON p.id = b.borrower_id
       WHERE b.resource_id = ? AND b.status IN ('approved','checked_in','return_submitted')
       ORDER BY b.starts_at ASC LIMIT 5`,
    )
    .all(id) as Array<{
    id: string;
    status: string;
    starts_at: string;
    ends_at: string;
    borrower_name: string;
  }>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/owner/resources"
          className="inline-flex items-center gap-1.5 text-[0.78rem] font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> Listings
        </Link>
        <Link
          href={`/resources/${resource.id}`}
          className="inline-flex items-center gap-1.5 text-[0.78rem] font-semibold text-primary hover:underline"
        >
          Open public page <ExternalLink className="size-3.5" />
        </Link>
      </div>

      {query.created ? (
        <Alert tone="success" title="Listing published">
          The resource is now visible in the catalog. Add any further requirements, availability
          windows or blackout periods below.
        </Alert>
      ) : null}

      <PageHeader
        eyebrow={`${CATEGORY_LABELS[resource.category]} · ${resource.organization.name}`}
        title={resource.name}
        description={resource.location}
        actions={
          <>
            <Badge
              tone={
                resource.status === "active"
                  ? "success"
                  : resource.status === "paused"
                    ? "warning"
                    : "neutral"
              }
              dot
            >
              {resource.status}
            </Badge>
            <Link href={`/owner/requests`} className={buttonStyles({ variant: "outline" })}>
              Request queue <ArrowRight className="size-3.5" />
            </Link>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_330px] lg:items-start">
        <div className="space-y-6">
          <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
            <h2 className="text-[0.95rem] font-bold">Listing details</h2>
            <p className="mt-1 text-[0.74rem] text-muted-foreground">
              Changes are visible immediately on the public listing and recorded in the audit log.
            </p>
            <div className="mt-4">
              <ActionForm
                action={updateResourceAction}
                submitLabel="Save listing"
                pendingLabel="Saving…"
                className="space-y-4"
              >
                <input type="hidden" name="resourceId" value={resource.id} />
                <div className="grid gap-4 sm:grid-cols-[1.4fr_1fr]">
                  <Field label="Resource name" htmlFor="name">
                    <Input id="name" name="name" defaultValue={resource.name} required minLength={3} maxLength={100} />
                  </Field>
                  <Field label="Category" htmlFor="category">
                    <Select id="category" name="category" defaultValue={resource.category} required>
                      {RESOURCE_CATEGORIES.map((category) => (
                        <option key={category} value={category}>
                          {CATEGORY_LABELS[category]}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
                <Field label="Description" htmlFor="description">
                  <Textarea
                    id="description"
                    name="description"
                    defaultValue={resource.description}
                    required
                    minLength={20}
                    maxLength={2000}
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Location" htmlFor="location">
                    <Input id="location" name="location" defaultValue={resource.location} required maxLength={140} />
                  </Field>
                  <Field label="Condition" htmlFor="conditionSummary">
                    <Input
                      id="conditionSummary"
                      name="conditionSummary"
                      defaultValue={resource.condition_summary}
                      required
                      minLength={5}
                      maxLength={600}
                    />
                  </Field>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Max hours" htmlFor="maxDurationHours">
                    <Input
                      id="maxDurationHours"
                      name="maxDurationHours"
                      type="number"
                      min={1}
                      max={24}
                      defaultValue={resource.max_duration_hours}
                      required
                    />
                  </Field>
                  <Field label="Fair-use cap" htmlFor="fairUseLimit">
                    <Input
                      id="fairUseLimit"
                      name="fairUseLimit"
                      type="number"
                      min={1}
                      max={10}
                      defaultValue={resource.fair_use_limit}
                      required
                    />
                  </Field>
                  <Field label="Status" htmlFor="status">
                    <Select id="status" name="status" defaultValue={resource.status}>
                      <option value="active">Active — accepting requests</option>
                      <option value="paused">Paused — hide new requests</option>
                      <option value="archived">Archived — retire listing</option>
                    </Select>
                  </Field>
                </div>
                <Field label="Usage rules" htmlFor="usageRules">
                  <Textarea
                    id="usageRules"
                    name="usageRules"
                    defaultValue={resource.usage_rules}
                    required
                    minLength={10}
                    maxLength={2000}
                    className="min-h-32"
                  />
                </Field>
                <Field label="Eligibility note" htmlFor="eligibilityNote" optional>
                  <Input
                    id="eligibilityNote"
                    name="eligibilityNote"
                    defaultValue={resource.eligibility_note ?? ""}
                    maxLength={600}
                  />
                </Field>
                <Alert tone="info">
                  Archiving is rejected while approved, checked-in or return-pending bookings exist.
                  Pause the listing instead if you only want to stop new requests.
                </Alert>
              </ActionForm>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-primary" aria-hidden />
              <h2 className="text-[0.95rem] font-bold">Access requirements</h2>
              <Badge tone="outline" className="ml-auto">
                {resource.requirements.length}
              </Badge>
            </div>
            <p className="mt-1 text-[0.74rem] leading-relaxed text-muted-foreground">
              Qualification requirements are satisfied only by a verified credential with an exact
              name match. Advisory requirements are shown but do not block a request.
            </p>
            <ul className="mt-4 space-y-2">
              {resource.requirements.length > 0 ? (
                resource.requirements.map((requirement) => (
                  <li
                    key={requirement.id}
                    className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border bg-muted/20 px-3.5 py-3"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[0.8rem] font-bold">{requirement.label}</p>
                        <Badge tone={requirement.is_required ? "warning" : "outline"}>
                          {requirement.is_required ? "Required" : "Advisory"}
                        </Badge>
                        <span className="text-[0.62rem] uppercase tracking-[0.08em] text-muted-foreground">
                          {requirement.kind}
                        </span>
                      </div>
                      {requirement.description ? (
                        <p className="mt-0.5 text-[0.72rem] leading-relaxed text-muted-foreground">
                          {requirement.description}
                        </p>
                      ) : null}
                    </div>
                    <InlineAction
                      action={removeRequirementAction}
                      fields={{ resourceId: resource.id, requirementId: requirement.id }}
                      label="Remove"
                      pendingLabel="Removing…"
                      variant="ghost"
                      className="text-destructive hover:bg-destructive/10"
                      icon={<Trash2 className="size-3.5" />}
                      confirmMessage={`Remove the requirement “${requirement.label}”?`}
                    />
                  </li>
                ))
              ) : (
                <li className="rounded-xl border border-dashed border-border px-3.5 py-4 text-[0.76rem] text-muted-foreground">
                  No requirements beyond active membership.
                </li>
              )}
            </ul>
            <div className="mt-4 border-t border-border pt-4">
              <ActionForm
                action={addRequirementAction}
                submitLabel="Add requirement"
                pendingLabel="Adding…"
                submitVariant="outline"
                className="space-y-3"
              >
                <input type="hidden" name="resourceId" value={resource.id} />
                <input type="hidden" name="isRequired" value="on" />
                <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
                  <Field label="Label" htmlFor="label" hint="Must exactly match a verified qualification name.">
                    <Input id="label" name="label" required minLength={3} maxLength={100} placeholder="e.g. Laser cutter safety" />
                  </Field>
                  <Field label="Kind" htmlFor="kind">
                    <Select id="kind" name="kind" defaultValue="qualification">
                      <option value="qualification">Qualification</option>
                      <option value="training">Training</option>
                      <option value="membership">Membership</option>
                    </Select>
                  </Field>
                </div>
                <Field label="Description" htmlFor="description" optional>
                  <Input id="description" name="description" maxLength={500} placeholder="What the member must demonstrate." />
                </Field>
              </ActionForm>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
            <div className="flex items-center gap-2">
              <CalendarClock className="size-4 text-primary" aria-hidden />
              <h2 className="text-[0.95rem] font-bold">Weekly availability</h2>
              <Badge tone="outline" className="ml-auto">
                {resource.availability.length} windows
              </Badge>
            </div>
            <ul className="mt-4 divide-y divide-border overflow-hidden rounded-xl border border-border">
              {resource.availability.length > 0 ? (
                resource.availability.map((window) => (
                  <li key={window.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                    <div>
                      <p className="text-[0.78rem] font-semibold">{WEEKDAY_LONG_LABELS[window.weekday]}</p>
                      <p className="font-mono text-[0.68rem] text-muted-foreground">
                        {formatMinuteOfDay(window.start_minute)} – {formatMinuteOfDay(window.end_minute)}
                      </p>
                    </div>
                    <InlineAction
                      action={removeAvailabilityAction}
                      fields={{ resourceId: resource.id, windowId: window.id }}
                      label="Remove"
                      pendingLabel="Removing…"
                      className="text-muted-foreground hover:text-destructive"
                      icon={<Trash2 className="size-3.5" />}
                      confirmMessage="Remove this availability window?"
                    />
                  </li>
                ))
              ) : (
                <li className="px-3.5 py-4 text-[0.76rem] text-muted-foreground">
                  No windows. Members cannot find a valid slot until you add hours.
                </li>
              )}
            </ul>
            <div className="mt-4 border-t border-border pt-4">
              <ActionForm
                action={addAvailabilityAction}
                submitLabel="Add window"
                pendingLabel="Adding…"
                submitVariant="outline"
                className="space-y-3"
              >
                <input type="hidden" name="resourceId" value={resource.id} />
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Day" htmlFor="weekday">
                    <Select id="weekday" name="weekday" defaultValue="1">
                      {WEEKDAY_LONG_LABELS.map((label, weekday) => (
                        <option key={label} value={weekday}>
                          {label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Opens" htmlFor="startTime">
                    <Input id="startTime" name="startTime" type="time" defaultValue="09:00" required />
                  </Field>
                  <Field label="Closes" htmlFor="endTime">
                    <Input id="endTime" name="endTime" type="time" defaultValue="17:00" required />
                  </Field>
                </div>
              </ActionForm>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
            <div className="flex items-center gap-2">
              <CalendarOff className="size-4 text-warning" aria-hidden />
              <h2 className="text-[0.95rem] font-bold">Maintenance blackouts</h2>
              <Badge tone="outline" className="ml-auto">
                {resource.blackouts.length}
              </Badge>
            </div>
            <p className="mt-1 text-[0.74rem] leading-relaxed text-muted-foreground">
              Blackouts block new requests that overlap the window. They never cancel an already
              approved booking — handle that through the custody queue with a written reason.
            </p>
            <ul className="mt-4 space-y-2">
              {resource.blackouts.length > 0 ? (
                resource.blackouts.map((blackout) => (
                  <li
                    key={blackout.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/20 bg-warning-soft/40 px-3.5 py-3"
                  >
                    <div>
                      <p className="text-[0.78rem] font-semibold text-warning">{blackout.reason}</p>
                      <p className="mt-0.5 font-mono text-[0.66rem] text-warning/90">
                        {formatDateTimeRange(blackout.starts_at, blackout.ends_at)}
                      </p>
                    </div>
                    <InlineAction
                      action={removeBlackoutAction}
                      fields={{ resourceId: resource.id, blackoutId: blackout.id }}
                      label="Remove"
                      pendingLabel="Removing…"
                      className="text-warning hover:bg-warning/10"
                      icon={<Trash2 className="size-3.5" />}
                      confirmMessage="Remove this blackout?"
                    />
                  </li>
                ))
              ) : (
                <li className="rounded-xl border border-dashed border-border px-3.5 py-4 text-[0.76rem] text-muted-foreground">
                  No blackouts scheduled.
                </li>
              )}
            </ul>
            <div className="mt-4 border-t border-border pt-4">
              <ActionForm
                action={addBlackoutAction}
                submitLabel="Add blackout"
                pendingLabel="Adding…"
                submitVariant="outline"
                className="space-y-3"
              >
                <input type="hidden" name="resourceId" value={resource.id} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Starts" htmlFor="startsAt">
                    <Input id="startsAt" name="startsAt" type="datetime-local" required />
                  </Field>
                  <Field label="Ends" htmlFor="endsAt">
                    <Input id="endsAt" name="endsAt" type="datetime-local" required />
                  </Field>
                </div>
                <Field label="Reason" htmlFor="reason">
                  <Input id="reason" name="reason" required minLength={5} maxLength={300} placeholder="Scheduled nozzle replacement and recalibration" />
                </Field>
              </ActionForm>
            </div>
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24">
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="eyebrow">Upcoming custody</p>
            {upcomingBookings.length > 0 ? (
              <ul className="mt-3 space-y-2.5">
                {upcomingBookings.map((booking) => (
                  <li key={booking.id} className="rounded-lg border border-border bg-muted/20 p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[0.74rem] font-semibold">{booking.borrower_name}</p>
                      <Badge tone={booking.status === "approved" ? "primary" : "info"}>
                        {booking.status.replaceAll("_", " ")}
                      </Badge>
                    </div>
                    <p className="mt-1 font-mono text-[0.64rem] text-muted-foreground">
                      {formatDateTimeRange(booking.starts_at, booking.ends_at)}
                    </p>
                    <Link
                      href={`/bookings/${booking.id}`}
                      className="mt-1.5 inline-flex text-[0.68rem] font-bold text-primary hover:underline"
                    >
                      Open booking →
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[0.76rem] text-muted-foreground">
                No approved or active custody for this listing.
              </p>
            )}
            <Link href="/owner/custody" className={buttonStyles({ variant: "outline", size: "sm", className: "mt-4 w-full" })}>
              Custody queue
            </Link>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="size-4 text-primary" aria-hidden />
              <p className="text-[0.82rem] font-bold">Requirement matching</p>
            </div>
            <p className="mt-2 text-[0.72rem] leading-relaxed text-muted-foreground">
              A requirement named “Bambu X1 operator training” passes only when a member holds a
              verified qualification with exactly that name. Pending records are shown to the
              reviewer but never satisfy a blocking gate.
            </p>
            <Link href="/admin" className={buttonStyles({ variant: "ghost", size: "sm", className: "mt-3 w-full" })}>
              Review credentials <Plus className="size-3.5" />
            </Link>
          </div>

          <div className="rounded-2xl border border-dashed border-border p-4">
            <p className="flex items-center gap-1.5 text-[0.72rem] font-bold text-muted-foreground">
              <Lock className="size-3.5" aria-hidden /> Append-only history
            </p>
            <p className="mt-1.5 text-[0.68rem] leading-relaxed text-muted-foreground">
              Listing edits, requirement changes, availability updates and blackouts are written to
              the organization audit log. The log rejects updates and deletes at database level.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
