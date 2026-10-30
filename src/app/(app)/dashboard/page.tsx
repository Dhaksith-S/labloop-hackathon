import Link from "next/link";
import {
  ArrowRight,
  BellRing,
  Boxes,
  CalendarClock,
  CalendarPlus,
  ClipboardList,
  Compass,
  PackageCheck,
  ShieldAlert,
  Sparkles,
  Stethoscope,
  TrendingUp,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import {
  listBookingsForBorrower,
  listCustodyQueue,
  listReviewQueue,
} from "@/lib/bookings";
import { searchPublicResources } from "@/lib/resources";
import { listNotifications } from "@/lib/notifications";
import { getPersonalActivity } from "@/lib/activity";
import {
  countOpenIncidents,
  countOrgBookings,
  countOrgResources,
} from "@/lib/stats";
import { formatDateTimeRange, formatRelative, nowIso } from "@/lib/time";
import { PageHeader, StatCard } from "@/components/ui/page";
import { BookingListItemCard } from "@/components/bookings/booking-list-item";
import { ResourceCard } from "@/components/resources/resource-card";
import { EmptyState } from "@/components/ui/feedback";
import { buttonStyles } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { ROLE_LABELS } from "@/lib/domain";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const user = await requireUser("/dashboard");
  const params = await searchParams;
  const db = getDb();
  const membership = user.memberships[0];
  const isStaff = Boolean(membership && ["owner", "manager", "admin"].includes(membership.role));
  const isManager = Boolean(membership && ["manager", "admin"].includes(membership.role));
  const bookings = listBookingsForBorrower(db, user.id);
  const activeBookings = bookings.filter((booking) =>
    ["pending", "waitlisted", "approved", "checked_in", "return_submitted"].includes(booking.status),
  );
  const inCustody = bookings.filter((booking) => booking.status === "checked_in");
  const awaitingReturn = bookings.filter((booking) => booking.status === "return_submitted");
  const waitlisted = bookings.filter((booking) => booking.status === "waitlisted");
  const notifications = listNotifications(db, user.id, 4);
  const unread = notifications.filter((notification) => !notification.read_at);
  const activity = getPersonalActivity(db, user.id, 5);
  const review = isStaff && membership ? listReviewQueue(db, user, membership.organizationId) : [];
  const custody = isStaff && membership ? listCustodyQueue(db, user, membership.organizationId) : [];
  const openIncidents =
    isStaff && membership ? countOpenIncidents(db, membership.organizationId) : 0;
  const resources = membership ? countOrgResources(db, membership.organizationId) : null;
  const statusCounts =
    isStaff && membership ? countOrgBookings(db, membership.organizationId) : null;
  const recommended = searchPublicResources(db)
    .filter(
      (resource) =>
        !activeBookings.some((booking) => booking.resource_id === resource.id) &&
        resource.status === "active",
    )
    .slice(0, 3);

  const nextActionable =
    inCustody[0] ??
    awaitingReturn[0] ??
    activeBookings.find((booking) => booking.status === "approved") ??
    activeBookings.find((booking) => booking.status === "pending") ??
    waitlisted[0];

  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      hour12: false,
    }).format(new Date()),
  );
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = user.fullName.split(" ")[0];

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow={`${ROLE_LABELS[membership?.role ?? "student"]} · ${formatDateTimeRange(nowIso(), nowIso()).split(" · ")[0]}`}
        title={`${greeting}, ${firstName}.`}
        description={
          params.welcome
            ? "Your account is ready. Browse the catalog, check your eligibility and send your first request."
            : "Here is the current state of your sharing loop — requests, custody and the records behind them."
        }
        actions={
          <>
            <Link href="/resources" className={buttonStyles({ variant: "outline" })}>
              <Compass className="size-4" /> Discover
            </Link>
            <Link href="/bookings" className={buttonStyles()}>
              <CalendarPlus className="size-4" /> My bookings
            </Link>
          </>
        }
      />

      {nextActionable ? (
        <section className="relative overflow-hidden rounded-2xl border border-primary/25 bg-primary p-5 text-primary-foreground sm:p-6">
          <div className="absolute -right-8 -top-10 size-48 rounded-full border border-primary-foreground/10" aria-hidden />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <p className="font-mono text-[0.6rem] uppercase tracking-[0.16em] opacity-65">
                Next action
              </p>
              <h2 className="mt-2 text-xl font-bold tracking-[-0.025em] sm:text-2xl">
                {nextActionable.status === "checked_in"
                  ? `${nextActionable.resource.name} is in your custody`
                  : nextActionable.status === "return_submitted"
                    ? `Waiting for ${nextActionable.resourceOwner.full_name.split(" ")[0]} to confirm your return`
                    : nextActionable.status === "approved"
                      ? `Your ${nextActionable.resource.name} slot is approved`
                      : nextActionable.status === "pending"
                        ? `Your request for ${nextActionable.resource.name} is with the owner`
                        : nextActionable.status === "waitlisted"
                          ? `You are on the waitlist for ${nextActionable.resource.name}`
                          : "Continue your loop"}
              </h2>
              <p className="mt-2 text-[0.82rem] leading-relaxed opacity-80">
                {formatDateTimeRange(nextActionable.starts_at, nextActionable.ends_at)}
                {nextActionable.status === "waitlisted" && nextActionable.waitlist
                  ? ` · Position ${nextActionable.waitlist.position} of ${nextActionable.waitlist.total}`
                  : ""}
                {nextActionable.status === "checked_in"
                  ? " · Submit the final condition when you hand it back."
                  : nextActionable.status === "approved"
                    ? " · Check-in opens 30 minutes before the start time."
                    : ""}
              </p>
            </div>
            <Link
              href={`/bookings/${nextActionable.id}`}
              className={buttonStyles({
                variant: "secondary",
                className: "shrink-0 border-transparent bg-background text-foreground hover:bg-background/90",
              })}
            >
              Open booking <ArrowRight className="size-4" />
            </Link>
          </div>
        </section>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Active requests"
          value={activeBookings.length}
          hint="Pending, waitlisted or approved"
          icon={<CalendarClock className="size-4" />}
        />
        <StatCard
          label="In your custody"
          value={inCustody.length}
          hint={inCustody.length ? "Return with a condition report" : "Nothing checked out"}
          icon={<PackageCheck className="size-4" />}
          tone={inCustody.length ? "primary" : "default"}
        />
        <StatCard
          label="Waitlisted"
          value={waitlisted.length}
          hint={waitlisted[0]?.waitlist ? `First position: ${waitlisted[0].waitlist.position}` : "No queued requests"}
          icon={<ClipboardList className="size-4" />}
        />
        <StatCard
          label="Unread notices"
          value={unread.length}
          hint={unread[0]?.title ?? "You are up to date"}
          icon={<BellRing className="size-4" />}
          tone={unread.length ? "warning" : "default"}
        />
      </div>

      {isStaff && membership ? (
        <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="eyebrow">Owner studio · {membership.organizationName}</p>
              <h2 className="mt-2 text-lg font-bold tracking-[-0.02em]">
                {review.length > 0
                  ? `${review.length} request${review.length === 1 ? "" : "s"} need a human decision`
                  : "No requests waiting for review"}
              </h2>
              <p className="mt-1 text-[0.8rem] text-muted-foreground">
                {custody.length} in the custody queue · {openIncidents} open incident
                {openIncidents === 1 ? "" : "s"} · {resources?.active ?? 0} active listing
                {(resources?.active ?? 0) === 1 ? "" : "s"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/owner/requests" className={buttonStyles({ size: "sm" })}>
                Review requests <ArrowRight className="size-3.5" />
              </Link>
              <Link href="/owner" className={buttonStyles({ variant: "outline", size: "sm" })}>
                Owner studio
              </Link>
            </div>
          </div>
          {review.length > 0 ? (
            <div className="mt-4 grid gap-2">
              {review.slice(0, 3).map((booking) => (
                <BookingListItemCard key={booking.id} booking={booking} perspective="reviewer" />
              ))}
            </div>
          ) : (
            <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-dashed border-border bg-muted/30 p-4">
              <Stethoscope className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              <p className="text-[0.78rem] leading-relaxed text-muted-foreground">
                The queue is clear. New requests appear here immediately after a member submits
                one. Every decision requires a written reason for rejection or waitlisting.
              </p>
            </div>
          )}
          {isManager && statusCounts ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge tone="outline">{statusCounts.pending ?? 0} pending</Badge>
              <Badge tone="outline">{statusCounts.approved ?? 0} approved</Badge>
              <Badge tone="outline">{statusCounts.checked_in ?? 0} in use</Badge>
              <Badge tone="outline">{statusCounts.completed ?? 0} completed</Badge>
              <Link href="/admin" className="text-[0.7rem] font-bold text-primary hover:underline">
                Organization overview →
              </Link>
            </div>
          ) : null}
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
        <section>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold tracking-[-0.02em]">Your active loop</h2>
            <Link href="/bookings" className="text-[0.74rem] font-bold text-primary hover:underline">
              All bookings →
            </Link>
          </div>
          {activeBookings.length > 0 ? (
            <div className="mt-3 space-y-2">
              {activeBookings.slice(0, 5).map((booking) => (
                <BookingListItemCard key={booking.id} booking={booking} />
              ))}
            </div>
          ) : (
            <EmptyState
              className="mt-3 py-10"
              icon={<Compass className="size-5" />}
              title="No active bookings yet"
              description="Find an eligible resource and send a request. The owner will review it and give a written decision."
              action={
                <Link href="/resources" className={buttonStyles()}>
                  Browse resources <ArrowRight className="size-4" />
                </Link>
              }
            />
          )}

          <div className="mt-7 flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold tracking-[-0.02em]">Recent activity</h2>
            <Link href="/activity" className="text-[0.74rem] font-bold text-primary hover:underline">
              Full history →
            </Link>
          </div>
          {activity.length > 0 ? (
            <ol className="mt-3 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
              {activity.map((item) => (
                <li key={item.id} className="flex items-start gap-3 px-4 py-3.5">
                  <span className="mt-1 size-2 shrink-0 rounded-full bg-primary/60" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-[0.78rem] font-semibold leading-snug">{item.title}</p>
                    <p className="mt-0.5 line-clamp-1 text-[0.7rem] text-muted-foreground">
                      {item.detail}
                    </p>
                  </div>
                  <span className="shrink-0 text-[0.65rem] text-muted-foreground">
                    {formatRelative(item.createdAt)}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-3 rounded-xl border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-[0.78rem] text-muted-foreground">
              Your audit trail begins with your first request.
            </p>
          )}
        </section>

        <aside className="space-y-6">
          <section className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-[0.95rem] font-bold">Notifications</h2>
              <Link href="/notifications" className="text-[0.7rem] font-bold text-primary hover:underline">
                View all
              </Link>
            </div>
            {notifications.length > 0 ? (
              <ul className="mt-3 space-y-3">
                {notifications.map((notification) => (
                  <li key={notification.id} className="flex items-start gap-2.5">
                    <span
                      className={`mt-1 size-1.5 shrink-0 rounded-full ${
                        notification.read_at ? "bg-border" : "bg-primary"
                      }`}
                      aria-hidden
                    />
                    <div className="min-w-0">
                      <p className="text-[0.76rem] font-semibold leading-snug">
                        {notification.title}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-[0.7rem] leading-relaxed text-muted-foreground">
                        {notification.body}
                      </p>
                      <p className="mt-0.5 text-[0.62rem] text-muted-foreground">
                        {formatRelative(notification.created_at)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-[0.78rem] text-muted-foreground">
                No notifications yet. Decisions, waitlist changes and custody updates appear here.
              </p>
            )}
          </section>

          <section className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" aria-hidden />
              <h2 className="text-[0.95rem] font-bold">Who you are in this loop</h2>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <Avatar name={user.fullName} color={user.avatarColor} size="lg" />
              <div>
                <p className="text-sm font-bold">{user.fullName}</p>
                <p className="text-[0.72rem] text-muted-foreground">
                  {membership ? ROLE_LABELS[membership.role] : "No role"}
                  {membership?.title ? ` · ${membership.title}` : ""}
                </p>
              </div>
            </div>
            <Link href="/profile" className={buttonStyles({ variant: "outline", size: "sm", className: "mt-4 w-full" })}>
              Credentials & profile
            </Link>
            {membership ? (
              <p className="mt-3 text-[0.68rem] leading-relaxed text-muted-foreground">
                Verified credentials determine which resources you can request. A manager reviews
                pending training records.
              </p>
            ) : null}
          </section>

          {isStaff ? (
            <section className="rounded-2xl border border-border bg-card p-5">
              <h2 className="text-[0.95rem] font-bold">Operational snapshot</h2>
              <dl className="mt-3 space-y-2.5">
                {[
                  [Boxes, "Active listings", resources?.active ?? 0],
                  [ClipboardList, "Awaiting review", review.length],
                  [PackageCheck, "Custody queue", custody.length],
                  [ShieldAlert, "Open incidents", openIncidents],
                ].map(([Icon, label, value]) => {
                  const Component = Icon as typeof Boxes;
                  return (
                    <div key={String(label)} className="flex items-center justify-between gap-3">
                      <dt className="flex items-center gap-2 text-[0.76rem] text-muted-foreground">
                        <Component className="size-3.5" aria-hidden /> {String(label)}
                      </dt>
                      <dd className="text-[0.8rem] font-bold number-tabular">{String(value)}</dd>
                    </div>
                  );
                })}
              </dl>
              <Link href="/owner" className={buttonStyles({ variant: "outline", size: "sm", className: "mt-4 w-full" })}>
                Open owner studio
              </Link>
            </section>
          ) : null}
        </aside>
      </div>

      <section>
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Suggested next</p>
            <h2 className="mt-1.5 text-lg font-bold tracking-[-0.02em]">
              Resources you have not tried yet
            </h2>
          </div>
          <Link href="/resources" className={buttonStyles({ variant: "ghost", size: "sm" })}>
            Full catalog <ArrowRight className="size-3.5" />
          </Link>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {recommended.map((resource, index) => (
            <ResourceCard key={resource.id} resource={resource} index={index} />
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="size-4 text-primary" aria-hidden />
            <p className="text-[0.82rem] font-bold">Why this matters</p>
          </div>
          <Badge tone="outline">Fictional demo institution</Badge>
        </div>
        <p className="mt-2 max-w-4xl text-[0.8rem] leading-relaxed text-muted-foreground">
          Institutions already own the tools. LabLoop reduces idle capacity by making access
          legible: what exists, who may use it, when it is free and what condition it came back in.
          The demo data lives in a persistent SQLite database — refresh the page and every record
          remains.
        </p>
      </section>
    </div>
  );
}
