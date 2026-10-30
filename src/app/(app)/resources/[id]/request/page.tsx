import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  Info,
  MapPin,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getResourceById } from "@/lib/resources";
import {
  getBorrowerEligibilityContext,
  getEligibilityBookingsForBorrower,
  getEligibilityBookingsForResource,
} from "@/lib/bookings";
import { evaluateEligibility } from "@/lib/eligibility";
import { createBookingAction } from "@/lib/actions/bookings";
import { suggestLocalSlot } from "@/lib/availability";
import { formatDateTimeRange, formatDuration, fromDateTimeLocalValue, nowIso } from "@/lib/time";
import { CATEGORY_LABELS } from "@/lib/domain";
import { ActionForm } from "@/components/forms/action-form";
import { EligibilityPanel } from "@/components/bookings/eligibility-panel";
import { Field, Input, Textarea } from "@/components/ui/fields";
import { buttonStyles } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page";

export const metadata: Metadata = { title: "Request a resource" };

function isLocalDateTime(value: string | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value));
}

export default async function RequestResourcePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ startsAt?: string; endsAt?: string; preview?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const user = await requireUser(`/resources/${id}/request`);
  const db = getDb();
  const resource = getResourceById(db, id);
  if (!resource || resource.status === "archived") notFound();
  const membership = user.memberships.find(
    (entry) => entry.organizationId === resource.organization_id,
  );

  if (!membership || membership.status !== "active") {
    return (
      <div className="mx-auto max-w-2xl py-10">
        <Alert tone="error" title="Membership required">
          You need an active membership at {resource.organization.name} before you can request
          this resource.
        </Alert>
        <Link href={`/resources/${resource.id}`} className={buttonStyles({ variant: "outline", className: "mt-4" })}>
          Back to resource
        </Link>
      </div>
    );
  }

  const suggested = suggestLocalSlot({
    availability: resource.availability,
    blackouts: resource.blackouts,
    now: nowIso(),
    maxDurationHours: resource.max_duration_hours,
    durationMinutes: Math.min(90, resource.max_duration_hours * 60),
  });
  const previewStart = isLocalDateTime(query.startsAt) ? query.startsAt : suggested?.startsAt;
  const previewEnd = isLocalDateTime(query.endsAt) ? query.endsAt : suggested?.endsAt;
  const wantsPreview = query.preview === "1" || (isLocalDateTime(query.startsAt) && isLocalDateTime(query.endsAt));

  let preview = null as ReturnType<typeof evaluateEligibility> | null;
  let previewIso: { startsAt: string; endsAt: string } | null = null;
  if (wantsPreview && isLocalDateTime(previewStart) && isLocalDateTime(previewEnd)) {
    try {
      previewIso = {
        startsAt: fromDateTimeLocalValue(previewStart),
        endsAt: fromDateTimeLocalValue(previewEnd),
      };
      preview = evaluateEligibility({
        resource: {
          id: resource.id,
          name: resource.name,
          status: resource.status,
          maxDurationHours: resource.max_duration_hours,
          fairUseLimit: resource.fair_use_limit,
          requirements: resource.requirements,
          availability: resource.availability,
          blackouts: resource.blackouts,
        },
        borrower: getBorrowerEligibilityContext(db, user.id, resource.organization_id),
        requestedStartsAt: previewIso.startsAt,
        requestedEndsAt: previewIso.endsAt,
        now: nowIso(),
        resourceBookings: getEligibilityBookingsForResource(db, resource.id),
        borrowerBookings: getEligibilityBookingsForBorrower(db, user.id),
        mode: "request",
      });
    } catch {
      preview = null;
    }
  }

  const checkPreview = (preview?.checks ?? []).filter((check) => check.id !== "availability");

  return (
    <div className="space-y-6">
      <Link
        href={`/resources/${resource.id}`}
        className="inline-flex items-center gap-1.5 text-[0.78rem] font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Back to {resource.name}
      </Link>

      <PageHeader
        eyebrow="Access request"
        title={`Request ${resource.name}`}
        description="Choose a window inside the owner's published hours. Eligibility is re-checked on the server when you submit; this preview helps you fix issues first."
        actions={
          <Badge tone={resource.status === "active" ? "success" : "warning"} dot>
            {resource.status === "active" ? "Listing active" : "Listing paused"}
          </Badge>
        }
      />

      {resource.status !== "active" ? (
        <Alert tone="warning" title="This resource is not accepting requests">
          The owner has paused this listing. Existing bookings remain valid; new requests are
          closed until it is reopened.
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_380px] lg:items-start">
        <div className="space-y-6">
          <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
            <div className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-lg border border-border bg-muted/40">
                <CalendarCheck className="size-4 text-primary" aria-hidden />
              </span>
              <div>
                <h2 className="text-[0.95rem] font-bold">1. Choose a window</h2>
                <p className="text-[0.72rem] text-muted-foreground">
                  Times are in Asia/Kolkata. The request must be within one day and inside lab hours.
                </p>
              </div>
            </div>
            <form method="get" className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <input type="hidden" name="preview" value="1" />
              <Field label="Start" htmlFor="previewStart">
                <Input
                  id="previewStart"
                  name="startsAt"
                  type="datetime-local"
                  defaultValue={previewStart ?? ""}
                  required
                />
              </Field>
              <Field label="End" htmlFor="previewEnd">
                <Input
                  id="previewEnd"
                  name="endsAt"
                  type="datetime-local"
                  defaultValue={previewEnd ?? ""}
                  required
                />
              </Field>
              <button type="submit" className={buttonStyles({ variant: "outline", className: "h-11" })}>
                Check window
              </button>
            </form>
            {suggested ? (
              <p className="mt-2.5 flex items-center gap-1.5 text-[0.7rem] text-muted-foreground">
                <Sparkles className="size-3" aria-hidden />
                Suggested next slot: {previewStart?.replace("T", " ")} – {previewEnd?.split("T")[1]}
              </p>
            ) : (
              <p className="mt-2.5 text-[0.7rem] text-warning">
                The owner has no bookable windows in the next week.
              </p>
            )}
          </section>

          {preview ? (
            <section>
              <EligibilityPanel result={preview} />
              {previewIso ? (
                <p className="mt-2 flex items-center gap-1.5 text-[0.7rem] text-muted-foreground">
                  <Clock3 className="size-3" aria-hidden />
                  Preview window: {formatDateTimeRange(previewIso.startsAt, previewIso.endsAt)} ·{" "}
                  {formatDuration(previewIso.startsAt, previewIso.endsAt)} ·{" "}
                  {checkPreview.filter((check) => check.status === "fail").length} blocking issue
                  {checkPreview.filter((check) => check.status === "fail").length === 1 ? "" : "s"}
                </p>
              ) : null}
            </section>
          ) : null}

          <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
            <div className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-lg border border-border bg-muted/40">
                <ArrowRight className="size-4 text-primary" aria-hidden />
              </span>
              <div>
                <h2 className="text-[0.95rem] font-bold">2. Submit the request</h2>
                <p className="text-[0.72rem] text-muted-foreground">
                  The owner sees the purpose, your eligibility report and competing requests.
                </p>
              </div>
            </div>
            <div className="mt-4">
              <ActionForm
                action={createBookingAction}
                submitLabel="Submit request for review"
                pendingLabel="Submitting request…"
                className="space-y-4"
              >
                <input type="hidden" name="resourceId" value={resource.id} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Start" htmlFor="startsAt" hint="Asia/Kolkata">
                    <Input
                      id="startsAt"
                      name="startsAt"
                      type="datetime-local"
                      defaultValue={previewStart ?? ""}
                      required
                    />
                  </Field>
                  <Field label="End" htmlFor="endsAt" hint="Same day · within duration cap">
                    <Input
                      id="endsAt"
                      name="endsAt"
                      type="datetime-local"
                      defaultValue={previewEnd ?? ""}
                      required
                    />
                  </Field>
                </div>
                <Field
                  label="Purpose of use"
                  htmlFor="purpose"
                  hint="Be specific. Reviewers use this to assess fit and safety."
                >
                  <Textarea
                    id="purpose"
                    name="purpose"
                    required
                    minLength={10}
                    maxLength={300}
                    placeholder="What are you building, testing or documenting with this resource?"
                  />
                </Field>
                <Field label="Request notes" htmlFor="notes" optional>
                  <Textarea
                    id="notes"
                    name="notes"
                    maxLength={1000}
                    placeholder="Materials, setup needs, pickup constraints or anything the owner should know."
                    className="min-h-20"
                  />
                </Field>
                <div className="rounded-xl border border-border bg-muted/30 p-3.5">
                  <label className="flex items-start gap-2.5 text-[0.78rem] leading-relaxed">
                    <input
                      type="checkbox"
                      name="rulesAcknowledged"
                      required
                      className="mt-0.5 size-4 shrink-0 rounded border-input accent-[var(--primary)]"
                    />
                    <span>
                      I have read the usage rules and condition notes. I will record the initial
                      condition at check-in, return the resource on time and report damage or
                      missing accessories honestly.
                    </span>
                  </label>
                </div>
                <Alert tone="info">
                  Submitting does not grant access. The owner approves, rejects or waitlists every
                  request, and a written reason is stored for any non-approval.
                </Alert>
              </ActionForm>
            </div>
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24">
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="eyebrow">Requesting</p>
            <h2 className="mt-2 text-lg font-bold tracking-[-0.02em]">{resource.name}</h2>
            <p className="mt-1 text-[0.72rem] text-muted-foreground">
              {CATEGORY_LABELS[resource.category]} · {resource.location}
            </p>
            <dl className="mt-4 space-y-2.5 border-t border-border pt-4">
              <div className="flex items-start justify-between gap-3">
                <dt className="text-[0.72rem] text-muted-foreground">Owner</dt>
                <dd className="text-[0.76rem] font-semibold">{resource.owner.full_name}</dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-[0.72rem] text-muted-foreground">Maximum duration</dt>
                <dd className="text-[0.76rem] font-semibold">{resource.max_duration_hours} hours</dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-[0.72rem] text-muted-foreground">Fair-use cap</dt>
                <dd className="text-[0.76rem] font-semibold">
                  {resource.fair_use_limit} active booking{resource.fair_use_limit === 1 ? "" : "s"}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-[0.72rem] text-muted-foreground">Location</dt>
                <dd className="text-right text-[0.76rem] font-semibold">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3" /> {resource.location.split("·")[0].trim()}
                  </span>
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="flex items-center gap-1.5 text-[0.78rem] font-bold">
              <ShieldCheck className="size-3.5 text-primary" aria-hidden /> Requirements
            </p>
            <ul className="mt-3 space-y-2">
              {resource.requirements.length ? (
                resource.requirements.map((requirement) => (
                  <li key={requirement.id} className="flex items-start gap-2">
                    {requirement.is_required ? (
                      <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
                    ) : (
                      <Info className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                    )}
                    <div>
                      <p className="text-[0.76rem] font-semibold">{requirement.label}</p>
                      <p className="text-[0.66rem] text-muted-foreground">
                        {requirement.is_required ? "Required · verified" : "Advisory"}
                      </p>
                    </div>
                  </li>
                ))
              ) : (
                <li className="text-[0.76rem] text-muted-foreground">Active membership only.</li>
              )}
            </ul>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-[0.78rem] font-bold">Usage rules (excerpt)</p>
            <p className="mt-2 line-clamp-[8] whitespace-pre-line text-[0.74rem] leading-relaxed text-muted-foreground">
              {resource.usage_rules}
            </p>
            <Link
              href={`/resources/${resource.id}`}
              className="mt-3 inline-flex text-[0.72rem] font-bold text-primary hover:underline"
            >
              Read the full listing →
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
