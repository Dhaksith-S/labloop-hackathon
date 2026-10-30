import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Boxes,
  CalendarPlus,
  ClipboardList,
  PackageCheck,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import {
  listCustodyQueue,
  listReviewQueue,
} from "@/lib/bookings";
import { listIncidentsForManager } from "@/lib/incidents";
import { getResourcesForManager } from "@/lib/resources";
import { getManagedActivity } from "@/lib/activity";
import { formatRelative } from "@/lib/time";
import { PageHeader, StatCard } from "@/components/ui/page";
import { BookingListItemCard } from "@/components/bookings/booking-list-item";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { ROLE_LABELS } from "@/lib/domain";

export const metadata: Metadata = { title: "Owner studio" };

export default async function OwnerDashboardPage() {
  const user = await requireUser("/owner");
  const db = getDb();
  const membership = user.memberships.find(
    (entry) => entry.status === "active" && ["owner", "manager", "admin"].includes(entry.role),
  );
  if (!membership) redirect("/dashboard");

  const resources = getResourcesForManager(db, user, membership.organizationId);
  const review = listReviewQueue(db, user, membership.organizationId);
  const custody = listCustodyQueue(db, user, membership.organizationId);
  const incidents = listIncidentsForManager(db, user, membership.organizationId, "open");
  const activity = getManagedActivity(db, user, membership.organizationId, 8);
  const returnsToConfirm = custody.filter((booking) => booking.status === "return_submitted");
  const activeListings = resources.filter((resource) => resource.status === "active");
  const pausedListings = resources.filter((resource) => resource.status === "paused");

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow={`${ROLE_LABELS[membership.role]} · ${membership.organizationName}`}
        title="Owner studio"
        description="Review access requests, hold the custody line and keep the listings and their rules accurate. Every action here writes an audit record."
        actions={
          <>
            <Link href="/owner/resources/new" className={buttonStyles({ variant: "outline" })}>
              <CalendarPlus className="size-4" /> New listing
            </Link>
            <Link href="/owner/requests" className={buttonStyles()}>
              <ClipboardList className="size-4" /> Review queue
              {review.length ? (
                <span className="rounded-full bg-primary-foreground/20 px-1.5 text-[0.65rem] font-bold">
                  {review.length}
                </span>
              ) : null}
            </Link>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Awaiting decision"
          value={review.length}
          hint={review.length ? "Human review required" : "Queue is clear"}
          icon={<ClipboardList className="size-4" />}
          tone={review.length ? "warning" : "default"}
        />
        <StatCard
          label="Custody queue"
          value={custody.length}
          hint={`${returnsToConfirm.length} return${returnsToConfirm.length === 1 ? "" : "s"} to confirm`}
          icon={<PackageCheck className="size-4" />}
          tone={returnsToConfirm.length ? "primary" : "default"}
        />
        <StatCard
          label="Open incidents"
          value={incidents.length}
          hint={incidents.length ? "Review required — no auto penalty" : "Nothing open"}
          icon={<ShieldAlert className="size-4" />}
          tone={incidents.length ? "danger" : "default"}
        />
        <StatCard
          label="Listings"
          value={resources.length}
          hint={`${activeListings.length} active · ${pausedListings.length} paused`}
          icon={<Boxes className="size-4" />}
        />
      </div>

      {returnsToConfirm.length > 0 ? (
        <section className="rounded-2xl border border-primary/25 bg-primary p-5 text-primary-foreground">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 size-5 shrink-0" aria-hidden />
              <div>
                <h2 className="text-lg font-bold tracking-[-0.02em]">
                  {returnsToConfirm.length} return{returnsToConfirm.length === 1 ? "" : "s"} waiting for your confirmation
                </h2>
                <p className="mt-1 text-[0.8rem] opacity-80">
                  Inspect the resource, compare the final condition report, then close custody.
                </p>
              </div>
            </div>
            <Link
              href="/owner/custody"
              className={buttonStyles({
                variant: "secondary",
                className: "border-transparent bg-background text-foreground hover:bg-background/90",
              })}
            >
              Open custody queue <ArrowRight className="size-4" />
            </Link>
          </div>
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold tracking-[-0.02em]">Incoming requests</h2>
            <Link href="/owner/requests" className="text-[0.74rem] font-bold text-primary hover:underline">
              Open queue →
            </Link>
          </div>
          {review.length > 0 ? (
            <div className="mt-3 space-y-2">
              {review.slice(0, 4).map((booking) => (
                <BookingListItemCard key={booking.id} booking={booking} perspective="reviewer" />
              ))}
            </div>
          ) : (
            <EmptyState
              className="mt-3 py-9"
              icon={<ClipboardList className="size-5" />}
              title="No requests waiting"
              description="When a member requests one of your resources, it appears here with their eligibility report and any competing demand."
            />
          )}

          <div className="mt-7 flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold tracking-[-0.02em]">Recent audit activity</h2>
            <Link href="/activity" className="text-[0.74rem] font-bold text-primary hover:underline">
              Full log →
            </Link>
          </div>
          {activity.length > 0 ? (
            <ol className="mt-3 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
              {activity.map((item) => (
                <li key={item.id} className="flex items-start gap-3 px-4 py-3.5">
                  <span className="mt-1 size-2 shrink-0 rounded-full bg-primary/60" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-[0.78rem] font-semibold capitalize">{item.title}</p>
                      <span className="text-[0.64rem] text-muted-foreground">
                        {formatRelative(item.createdAt)}
                      </span>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-[0.7rem] text-muted-foreground">
                      {item.detail}
                    </p>
                    <p className="mt-0.5 text-[0.62rem] text-muted-foreground">
                      {item.actorName ? `By ${item.actorName}` : "System action"}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-3 rounded-xl border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-[0.78rem] text-muted-foreground">
              Audit events appear as soon as you create a listing or decide a request.
            </p>
          )}
        </section>

        <aside className="space-y-5">
          <section className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-[0.95rem] font-bold">Your listings</h2>
              <Link href="/owner/resources" className="text-[0.7rem] font-bold text-primary hover:underline">
                Manage
              </Link>
            </div>
            <ul className="mt-3 space-y-2.5">
              {resources.slice(0, 5).map((resource) => (
                <li key={resource.id}>
                  <Link
                    href={`/owner/resources/${resource.id}`}
                    className="flex items-start justify-between gap-2 rounded-lg p-1.5 transition-colors hover:bg-muted/50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[0.78rem] font-semibold">{resource.name}</p>
                      <p className="text-[0.66rem] text-muted-foreground">
                        {resource.requirements.length} requirement
                        {resource.requirements.length === 1 ? "" : "s"} · max{" "}
                        {resource.max_duration_hours}h
                      </p>
                    </div>
                    <Badge tone={resource.status === "active" ? "success" : resource.status === "paused" ? "warning" : "neutral"}>
                      {resource.status}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
            <Link href="/owner/resources/new" className={buttonStyles({ variant: "outline", size: "sm", className: "mt-4 w-full" })}>
              <CalendarPlus className="size-3.5" /> Add a resource
            </Link>
          </section>

          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="text-[0.95rem] font-bold">Open incidents</h2>
            {incidents.length > 0 ? (
              <ul className="mt-3 space-y-2.5">
                {incidents.slice(0, 3).map((incident) => (
                  <li key={incident.id} className="rounded-lg border border-border bg-muted/20 p-3">
                    <p className="text-[0.74rem] font-semibold">{incident.resource.name}</p>
                    <p className="mt-0.5 text-[0.68rem] text-muted-foreground">
                      {incident.type.replaceAll("_", " ")} · {incident.severity} · reported by{" "}
                      {incident.reporterName}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[0.78rem] text-muted-foreground">
                No open incidents. Reports never trigger automatic penalties.
              </p>
            )}
            <Link href="/owner/incidents" className={buttonStyles({ variant: "outline", size: "sm", className: "mt-4 w-full" })}>
              Incident desk
            </Link>
          </section>

          {membership.role !== "owner" ? (
            <section className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center gap-2">
                <Users className="size-4 text-primary" aria-hidden />
                <h2 className="text-[0.95rem] font-bold">Organization</h2>
              </div>
              <p className="mt-2 text-[0.76rem] leading-relaxed text-muted-foreground">
                As a {ROLE_LABELS[membership.role].toLowerCase()}, you can also review member
                credentials and see the organization-wide overview.
              </p>
              <Link href="/admin" className={buttonStyles({ variant: "outline", size: "sm", className: "mt-3 w-full" })}>
                Open overview
              </Link>
            </section>
          ) : null}

          <div className="rounded-2xl border border-dashed border-border p-4">
            <p className="flex items-center gap-1.5 text-[0.72rem] font-bold text-muted-foreground">
              <Sparkles className="size-3.5" aria-hidden /> Reviewer reminder
            </p>
            <p className="mt-1.5 text-[0.68rem] leading-relaxed text-muted-foreground">
              Declining or waitlisting requires a written reason. Approving re-checks eligibility and
              conflict safety. You can never review your own request.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
