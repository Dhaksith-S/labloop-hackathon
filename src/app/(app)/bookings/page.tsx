import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarPlus, Compass, History } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { listBookingsForBorrower } from "@/lib/bookings";
import { PageHeader } from "@/components/ui/page";
import { BookingListItemCard } from "@/components/bookings/booking-list-item";
import { EmptyState } from "@/components/ui/feedback";
import { buttonStyles } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "My bookings" };

const ACTIVE = ["checked_in", "return_submitted", "approved", "pending", "waitlisted"];

export default async function BookingsPage() {
  const user = await requireUser("/bookings");
  const bookings = listBookingsForBorrower(getDb(), user.id);
  const active = bookings.filter((booking) => ACTIVE.includes(booking.status));
  const past = bookings.filter((booking) => !ACTIVE.includes(booking.status));
  const awaitingCustody = active.filter((booking) =>
    ["checked_in", "return_submitted"].includes(booking.status),
  );

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Borrower workspace"
        title="My bookings"
        description="Every request, decision and custody change in one place. Open a booking to check in, return the resource, report an incident or read the full timeline."
        actions={
          <Link href="/resources" className={buttonStyles()}>
            <Compass className="size-4" /> New request
          </Link>
        }
      />

      <div className="flex flex-wrap gap-2">
        <Badge tone="outline">{active.length} active</Badge>
        <Badge tone={awaitingCustody.length ? "primary" : "outline"} dot={awaitingCustody.length > 0}>
          {awaitingCustody.length} in custody
        </Badge>
        <Badge tone="outline">{past.length} archived</Badge>
      </div>

      <section>
        <h2 className="text-lg font-bold tracking-[-0.02em]">Active loop</h2>
        {active.length > 0 ? (
          <div className="mt-3 space-y-2">
            {active.map((booking) => (
              <BookingListItemCard key={booking.id} booking={booking} />
            ))}
          </div>
        ) : (
          <EmptyState
            className="mt-3"
            icon={<CalendarPlus className="size-5" />}
            title="No active bookings"
            description="Send a request for a resource you are qualified to use. The owner reviews it and records a written decision."
            action={
              <Link href="/resources" className={buttonStyles()}>
                Browse the catalog <ArrowRight className="size-4" />
              </Link>
            }
          />
        )}
      </section>

      <section>
        <h2 className="flex items-center gap-2 text-lg font-bold tracking-[-0.02em]">
          <History className="size-4 text-muted-foreground" aria-hidden /> History
        </h2>
        {past.length > 0 ? (
          <div className="mt-3 space-y-2">
            {past.map((booking) => (
              <BookingListItemCard key={booking.id} booking={booking} />
            ))}
          </div>
        ) : (
          <p className="mt-3 rounded-xl border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-[0.78rem] text-muted-foreground">
            Completed, rejected and cancelled bookings will appear here with their full audit
            history.
          </p>
        )}
      </section>
    </div>
  );
}
