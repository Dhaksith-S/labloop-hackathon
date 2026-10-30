import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Info,
  MapPin,
  ShieldCheck,
  Sparkles,
  UserRound,
  XCircle,
} from "lucide-react";
import { getDb } from "@/lib/db";
import { getResourceById } from "@/lib/resources";
import { getBorrowerEligibilityContext } from "@/lib/bookings";
import { evaluateRequirementStanding } from "@/lib/eligibility";
import { getSessionUser } from "@/lib/auth";
import { CATEGORY_LABELS } from "@/lib/domain";
import { groupAvailability } from "@/lib/availability";
import { formatDateTimeRange, nowIso } from "@/lib/time";
import { Badge } from "@/components/ui/badge";
import { Button, buttonStyles } from "@/components/ui/button";
import { ResourceArt } from "@/components/resources/resource-art";
import { DetailRow } from "@/components/ui/page";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const resource = getResourceById(getDb(), id);
  if (!resource) return { title: "Resource not found" };
  return {
    title: resource.name,
    description: resource.description.slice(0, 155),
  };
}

export default async function ResourceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getDb();
  const resource = getResourceById(db, id);
  if (!resource || resource.status === "archived") notFound();

  const user = await getSessionUser();
  const membership = user
    ? user.memberships.find((entry) => entry.organizationId === resource.organization_id)
    : null;
  const standing =
    user && membership
      ? evaluateRequirementStanding(
          {
            id: resource.id,
            name: resource.name,
            status: resource.status,
            maxDurationHours: resource.max_duration_hours,
            fairUseLimit: resource.fair_use_limit,
            requirements: resource.requirements,
            availability: resource.availability,
            blackouts: resource.blackouts,
          },
          getBorrowerEligibilityContext(db, user.id, resource.organization_id),
          nowIso(),
        )
      : [];
  const requiredCount = resource.requirements.filter((requirement) => requirement.is_required === 1).length;
  const failing = standing.filter((check) => check.status === "fail");
  const groups = groupAvailability(resource.availability);
  const upcoming = db
    .prepare(
      `SELECT starts_at, ends_at, status FROM bookings
       WHERE resource_id = ? AND status IN ('approved','checked_in','return_submitted')
         AND ends_at > ?
       ORDER BY starts_at ASC LIMIT 6`,
    )
    .all(resource.id, nowIso()) as Array<{
    starts_at: string;
    ends_at: string;
    status: string;
  }>;

  return (
    <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12">
      <Link
        href="/resources"
        className="inline-flex items-center gap-1.5 text-[0.78rem] font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> All resources
      </Link>

      <div className="mt-5 grid gap-8 lg:grid-cols-[1fr_380px] lg:items-start">
        <div>
          <div className="overflow-hidden rounded-2xl border border-border">
            <ResourceArt category={resource.category} className="h-52 sm:h-64" />
          </div>

          <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="specimen-code">{CATEGORY_LABELS[resource.category]}</p>
              <h1 className="mt-2 text-[2rem] font-bold leading-tight tracking-[-0.035em] sm:text-[2.5rem]">
                {resource.name}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[0.8rem] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="size-3.5" /> {resource.location}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock3 className="size-3.5" /> Max {resource.max_duration_hours} hours per booking
                </span>
              </div>
            </div>
            {resource.status === "active" ? (
              <Badge tone="success" dot>
                Accepting requests
              </Badge>
            ) : (
              <Badge tone="warning" dot>
                Paused by owner
              </Badge>
            )}
          </div>

          <p className="mt-5 text-[0.95rem] leading-[1.8] text-ink-soft">{resource.description}</p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <section className="rounded-2xl border border-border bg-card p-5">
              <p className="eyebrow">Current condition</p>
              <p className="mt-2.5 text-[0.84rem] leading-relaxed text-ink-soft">
                {resource.condition_summary}
              </p>
            </section>
            <section className="rounded-2xl border border-border bg-card p-5">
              <p className="eyebrow">Owned & stewarded by</p>
              <div className="mt-3 flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-full border border-border bg-muted">
                  <UserRound className="size-4 text-muted-foreground" />
                </span>
                <div>
                  <p className="text-[0.84rem] font-bold">{resource.owner.full_name}</p>
                  <p className="text-[0.72rem] text-muted-foreground">
                    {resource.owner.headline ?? resource.organization.name}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-[0.7rem] leading-relaxed text-muted-foreground">
                {resource.organization.name} · verification required before first use.
              </p>
            </section>
          </div>

          <section className="mt-8" aria-labelledby="rules-heading">
            <h2 id="rules-heading" className="text-lg font-bold tracking-[-0.02em]">
              Usage rules
            </h2>
            <div className="mt-3 rounded-2xl border border-border bg-card p-5">
              <p className="whitespace-pre-line text-[0.86rem] leading-[1.85] text-ink-soft">
                {resource.usage_rules}
              </p>
            </div>
          </section>

          <section className="mt-8" aria-labelledby="availability-heading">
            <h2 id="availability-heading" className="text-lg font-bold tracking-[-0.02em]">
              Weekly availability
            </h2>
            <p className="mt-1 text-[0.8rem] text-muted-foreground">
              Times shown in Asia/Kolkata ({resource.organization.name} local time).
            </p>
            <div className="mt-3 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
              {groups.length ? (
                groups.map((group) => (
                  <div
                    key={`${group.days}-${group.start}-${group.end}`}
                    className="flex items-center justify-between gap-4 px-5 py-3.5"
                  >
                    <span className="text-[0.84rem] font-semibold">{group.days}</span>
                    <span className="font-mono text-[0.76rem] text-muted-foreground">
                      {group.start === "24 hours" ? "Open 24 hours" : `${group.start} – ${group.end}`}
                    </span>
                  </div>
                ))
              ) : (
                <p className="px-5 py-4 text-sm text-muted-foreground">
                  The owner has not published bookable hours yet.
                </p>
              )}
              {resource.blackouts.length > 0 ? (
                <div className="bg-warning-soft/50 px-5 py-4">
                  <p className="text-[0.72rem] font-bold uppercase tracking-[0.08em] text-warning">
                    Upcoming blackouts
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {resource.blackouts.map((blackout) => (
                      <li key={blackout.id} className="text-[0.78rem] text-warning">
                        {formatDateTimeRange(blackout.starts_at, blackout.ends_at)} — {blackout.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </section>

          <section className="mt-8" aria-labelledby="access-heading">
            <h2 id="access-heading" className="text-lg font-bold tracking-[-0.02em]">
              Access requirements
            </h2>
            {resource.eligibility_note ? (
              <p className="mt-1 text-[0.8rem] text-muted-foreground">{resource.eligibility_note}</p>
            ) : null}
            <div className="mt-3 space-y-2">
              {resource.requirements.length > 0 ? (
                resource.requirements.map((requirement) => (
                  <div
                    key={requirement.id}
                    className="flex items-start justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3.5"
                  >
                    <div>
                      <p className="text-[0.84rem] font-bold">{requirement.label}</p>
                      {requirement.description ? (
                        <p className="mt-0.5 text-[0.76rem] leading-relaxed text-muted-foreground">
                          {requirement.description}
                        </p>
                      ) : null}
                    </div>
                    <Badge tone={requirement.is_required ? "warning" : "outline"}>
                      {requirement.is_required ? "Required" : "Advisory"}
                    </Badge>
                  </div>
                ))
              ) : (
                <p className="rounded-xl border border-border bg-card px-4 py-3.5 text-sm text-muted-foreground">
                  No extra credentials. Active membership is enough.
                </p>
              )}
            </div>
          </section>

          {upcoming.length > 0 ? (
            <section className="mt-8" aria-labelledby="reserved-heading">
              <h2 id="reserved-heading" className="text-lg font-bold tracking-[-0.02em]">
                Already reserved
              </h2>
              <p className="mt-1 text-[0.8rem] text-muted-foreground">
                These windows are held by approved custody. Competing requests can still be
                submitted and transparently waitlisted.
              </p>
              <ul className="mt-3 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
                {upcoming.map((booking, index) => (
                  <li key={index} className="flex items-center justify-between gap-4 px-5 py-3">
                    <span className="text-[0.8rem] font-medium">
                      {formatDateTimeRange(booking.starts_at, booking.ends_at)}
                    </span>
                    <Badge tone={booking.status === "approved" ? "primary" : "info"}>
                      {booking.status === "approved" ? "Approved" : "In custody"}
                    </Badge>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <aside className="lg:sticky lg:top-24">
          <div className="rounded-2xl border border-border bg-card p-5 card-shadow">
            <p className="eyebrow">Your eligibility</p>
            {!user ? (
              <>
                <p className="mt-3 text-[0.86rem] leading-relaxed text-ink-soft">
                  Sign in to see which requirements you already meet and whether you can request
                  this resource.
                </p>
                <Link
                  href={`/login?next=${encodeURIComponent(`/resources/${resource.id}`)}`}
                  className={buttonStyles({ className: "mt-4 w-full" })}
                >
                  Sign in to check eligibility
                </Link>
              </>
            ) : !membership ? (
              <div className="mt-3 rounded-xl border border-warning/25 bg-warning-soft p-3 text-[0.8rem] leading-relaxed text-warning">
                Your account is not an active member of {resource.organization.name}. Ask a lab
                manager for an invitation.
              </div>
            ) : (
              <>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-2xl font-bold tracking-[-0.04em]">
                    {standing.filter((check) => check.status !== "fail" && check.status !== "warning").length}
                    <span className="text-sm font-semibold text-muted-foreground">
                      /{standing.length} checks
                    </span>
                  </span>
                  {failing.length === 0 ? (
                    <Badge tone="success" dot>
                      Meets rules
                    </Badge>
                  ) : (
                    <Badge tone="danger" dot>
                      {failing.length} missing
                    </Badge>
                  )}
                </div>
                <ul className="mt-4 space-y-2.5">
                  {standing.map((check) => (
                    <li key={check.id} className="flex items-start gap-2">
                      {check.status === "fail" ? (
                        <XCircle className="mt-0.5 size-3.5 shrink-0 text-destructive" aria-hidden />
                      ) : check.status === "warning" ? (
                        <Info className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden />
                      ) : (
                        <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-success" aria-hidden />
                      )}
                      <div>
                        <p className="text-[0.78rem] font-semibold leading-snug">{check.label}</p>
                        <p className="mt-0.5 text-[0.7rem] leading-relaxed text-muted-foreground">
                          {check.detail}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
                {requiredCount > 0 ? (
                  <p className="mt-4 border-t border-border pt-3 text-[0.7rem] text-muted-foreground">
                    Requirement standing is evaluated against verified records only.
                  </p>
                ) : null}
              </>
            )}

            <div className="mt-5 border-t border-border pt-4">
              {resource.status === "active" ? (
                user && membership ? (
                  <Link href={`/resources/${resource.id}/request`} className={buttonStyles({ className: "w-full" })}>
                    Request a slot <ArrowRight className="size-4" />
                  </Link>
                ) : (
                  <Link
                    href={`/login?next=${encodeURIComponent(`/resources/${resource.id}/request`)}`}
                    className={buttonStyles({ className: "w-full" })}
                  >
                    Sign in to request
                  </Link>
                )
              ) : (
                <Button disabled className="w-full">
                  Paused — requests closed
                </Button>
              )}
              <p className="mt-2.5 text-center text-[0.66rem] leading-relaxed text-muted-foreground">
                Human owner review · fair-use limits apply
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-border bg-card/60 p-4">
            <p className="flex items-center gap-1.5 text-[0.74rem] font-bold">
              <ShieldCheck className="size-3.5 text-primary" aria-hidden /> Fair-use cap
            </p>
            <p className="mt-1 text-[0.72rem] leading-relaxed text-muted-foreground">
              You may hold up to {resource.fair_use_limit} active request
              {resource.fair_use_limit === 1 ? "" : "s"} or booking
              {resource.fair_use_limit === 1 ? "" : "s"} for this resource at once.
            </p>
            <dl className="mt-3 space-y-1.5">
              <DetailRow label="Duration" className="grid-cols-[90px_1fr] py-0.5">
                Up to {resource.max_duration_hours} hours
              </DetailRow>
              <DetailRow label="Hours" className="grid-cols-[90px_1fr] py-0.5">
                {groups[0]?.days ?? "—"}
              </DetailRow>
              <DetailRow label="Owner" className="grid-cols-[90px_1fr] py-0.5">
                {resource.owner.full_name}
              </DetailRow>
            </dl>
          </div>

          <div className="mt-4 rounded-2xl border border-dashed border-border p-4">
            <p className="flex items-center gap-1.5 text-[0.72rem] font-bold text-muted-foreground">
              <Sparkles className="size-3.5" aria-hidden /> What happens next
            </p>
            <p className="mt-1.5 text-[0.7rem] leading-relaxed text-muted-foreground">
              Your request enters the owner&apos;s review queue. You will see the decision, the
              written reason and your position if waitlisted.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
