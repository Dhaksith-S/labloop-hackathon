import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, PackageCheck, RotateCcw, ShieldCheck } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { listCustodyQueue } from "@/lib/bookings";
import { PageHeader } from "@/components/ui/page";
import { BookingListItemCard } from "@/components/bookings/booking-list-item";
import { EmptyState, Alert } from "@/components/ui/feedback";
import { buttonStyles } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Custody queue" };

export default async function OwnerCustodyPage() {
  const user = await requireUser("/owner/custody");
  const membership = user.memberships.find(
    (entry) => entry.status === "active" && ["owner", "manager", "admin"].includes(entry.role),
  );
  if (!membership) redirect("/dashboard");
  const db = getDb();
  const queue = listCustodyQueue(db, user, membership.organizationId);
  const awaitingCheckIn = queue.filter((booking) => booking.status === "approved");
  const inUse = queue.filter((booking) => booking.status === "checked_in");
  const returns = queue.filter((booking) => booking.status === "return_submitted");

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow={`${membership.organizationName} · custody`}
        title="Custody queue"
        description="Track every resource that is reserved, in a borrower's hands or awaiting return confirmation. Custody closes only when an authorized reviewer confirms the hand-back."
        actions={
          <Link href="/owner/requests" className={buttonStyles({ variant: "outline" })}>
            Request queue <ArrowRight className="size-4" />
          </Link>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Awaiting check-in", value: awaitingCheckIn.length, icon: PackageCheck, note: "Approved, still with the lab" },
          { label: "In borrower custody", value: inUse.length, icon: ShieldCheck, note: "Checked in, not yet returned" },
          { label: "Returns to confirm", value: returns.length, icon: RotateCcw, note: "Final condition submitted" },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <p className="text-[0.7rem] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                {item.label}
              </p>
              <item.icon className="size-4 text-muted-foreground" aria-hidden />
            </div>
            <p className="mt-2 text-[2rem] font-bold leading-none tracking-[-0.04em]">{item.value}</p>
            <p className="mt-1 text-[0.7rem] text-muted-foreground">{item.note}</p>
          </div>
        ))}
      </div>

      {returns.length > 0 ? (
        <Alert tone="success" title={`${returns.length} return${returns.length === 1 ? "" : "s"} waiting for confirmation`}>
          Inspect the resource against the borrower&apos;s final condition report, then open the
          booking to confirm the hand-back. Confirmation completes the booking and closes custody.
        </Alert>
      ) : null}

      <section>
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold tracking-[-0.02em]">Returns to confirm</h2>
          <Badge tone={returns.length ? "success" : "outline"}>{returns.length}</Badge>
        </div>
        {returns.length > 0 ? (
          <div className="mt-3 space-y-2">
            {returns.map((booking) => (
              <BookingListItemCard key={booking.id} booking={booking} perspective="reviewer" />
            ))}
          </div>
        ) : (
          <p className="mt-3 rounded-xl border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-[0.78rem] text-muted-foreground">
            No pending returns. Borrowers submit the final condition before a return enters this queue.
          </p>
        )}
      </section>

      <section>
        <h2 className="text-lg font-bold tracking-[-0.02em]">In borrower custody</h2>
        {inUse.length > 0 ? (
          <div className="mt-3 space-y-2">
            {inUse.map((booking) => (
              <BookingListItemCard key={booking.id} booking={booking} perspective="reviewer" />
            ))}
          </div>
        ) : (
          <p className="mt-3 rounded-xl border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-[0.78rem] text-muted-foreground">
            Nothing is currently checked out.
          </p>
        )}
      </section>

      <section>
        <h2 className="text-lg font-bold tracking-[-0.02em]">Approved, awaiting check-in</h2>
        {awaitingCheckIn.length > 0 ? (
          <div className="mt-3 space-y-2">
            {awaitingCheckIn.map((booking) => (
              <BookingListItemCard key={booking.id} booking={booking} perspective="reviewer" />
            ))}
          </div>
        ) : (
          <EmptyState
            className="mt-3 py-9"
            icon={<PackageCheck className="size-5" />}
            title="No reservations waiting on check-in"
            description="Approved bookings appear here until the borrower checks in or the booking is cancelled."
          />
        )}
      </section>
    </div>
  );
}
