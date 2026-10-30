import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, ClipboardList, Info, ShieldCheck } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { listBookingsForManager, listReviewQueue } from "@/lib/bookings";
import { PageHeader } from "@/components/ui/page";
import { BookingListItemCard } from "@/components/bookings/booking-list-item";
import { EmptyState, Alert } from "@/components/ui/feedback";
import { buttonStyles } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatRelative } from "@/lib/time";

export const metadata: Metadata = { title: "Request queue" };

export default async function OwnerRequestsPage() {
  const user = await requireUser("/owner/requests");
  const membership = user.memberships.find(
    (entry) => entry.status === "active" && ["owner", "manager", "admin"].includes(entry.role),
  );
  if (!membership) redirect("/dashboard");
  const db = getDb();
  const queue = listReviewQueue(db, user, membership.organizationId);
  const pending = queue.filter((booking) => booking.status === "pending");
  const waitlisted = queue.filter((booking) => booking.status === "waitlisted");
  const recentDecisions = listBookingsForManager(db, user, membership.organizationId)
    .filter((booking) => ["approved", "rejected"].includes(booking.status))
    .slice(0, 5);

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow={`${membership.organizationName} · operations`}
        title="Request queue"
        description="Open a request to see the requester, purpose, eligibility report, schedule conflicts and fair-use position. Approval is always a human decision."
        actions={
          <Link href="/owner/custody" className={buttonStyles({ variant: "outline" })}>
            Custody queue <ArrowRight className="size-4" />
          </Link>
        }
      />

      <div className="flex flex-wrap gap-2">
        <Badge tone="warning" dot={pending.length > 0}>{pending.length} pending</Badge>
        <Badge tone="info" dot={waitlisted.length > 0}>{waitlisted.length} waitlisted</Badge>
        <Badge tone="outline">{recentDecisions.length} recent decisions</Badge>
      </div>

      <Alert tone="info">
        <span className="font-semibold">No one-click approvals from this list.</span> Open a request
        to review the full eligibility and conflict context before recording a decision. Rejection
        and waitlisting require a written reason.
      </Alert>

      <section>
        <h2 className="text-lg font-bold tracking-[-0.02em]">Awaiting review</h2>
        {pending.length > 0 ? (
          <div className="mt-3 space-y-2">
            {pending.map((booking) => (
              <BookingListItemCard key={booking.id} booking={booking} perspective="reviewer" />
            ))}
          </div>
        ) : (
          <EmptyState
            className="mt-3 py-9"
            icon={<ClipboardList className="size-5" />}
            title="No pending requests"
            description="New eligible requests appear here immediately after submission. You can also check the waitlist section below."
          />
        )}
      </section>

      <section>
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold tracking-[-0.02em]">Waitlisted</h2>
          <Badge tone="outline">Human review still required</Badge>
        </div>
        {waitlisted.length > 0 ? (
          <div className="mt-3 space-y-2">
            {waitlisted.map((booking) => (
              <BookingListItemCard key={booking.id} booking={booking} perspective="reviewer" />
            ))}
          </div>
        ) : (
          <p className="mt-3 rounded-xl border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-[0.78rem] text-muted-foreground">
            No waitlisted requests. A released approved slot can return the first eligible waitlisted
            request to this queue — it is never approved automatically.
          </p>
        )}
      </section>

      <section>
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold tracking-[-0.02em]">Recent decisions</h2>
          <Info className="size-3.5 text-muted-foreground" aria-hidden />
        </div>
        {recentDecisions.length > 0 ? (
          <div className="mt-3 space-y-2">
            {recentDecisions.map((booking) => (
              <div key={booking.id} className="rounded-xl border border-border bg-card p-4">
                <BookingListItemCard booking={booking} perspective="reviewer" />
                {booking.decision_reason ? (
                  <p className="mt-2 border-t border-border pt-2 text-[0.72rem] text-muted-foreground">
                    <span className="font-semibold text-foreground">Reason:</span>{" "}
                    {booking.decision_reason}
                    {booking.decided_at ? ` · ${formatRelative(booking.decided_at)}` : ""}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 rounded-xl border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-[0.78rem] text-muted-foreground">
            Decisions you record will appear here with their written reason.
          </p>
        )}
      </section>

      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="flex items-center gap-2 text-[0.8rem] font-bold">
          <ShieldCheck className="size-4 text-primary" aria-hidden /> Conflict and fairness policy
        </p>
        <p className="mt-2 max-w-4xl text-[0.78rem] leading-relaxed text-muted-foreground">
          Approval re-runs membership, verified training, duration, lab hours, blackout, resource
          conflict, borrower conflict and fair-use checks. An overlapping approved booking is
          rejected by both the scheduler and a database trigger. Waitlisted requests are ordered by
          submission time and return to review only when a slot is released.
        </p>
        <Link href="/how-it-works#fairness" className="mt-2 inline-flex text-[0.74rem] font-bold text-primary hover:underline">
          Read the full policy →
        </Link>
      </div>
    </div>
  );
}
