import Link from "next/link";
import { ArrowUpRight, Clock3, MapPin } from "lucide-react";
import type { BookingListItem } from "@/lib/bookings";
import { CATEGORY_LABELS } from "@/lib/domain";
import { formatDateTimeRange } from "@/lib/time";
import { BookingStatusBadge } from "@/components/bookings/status-badge";
import { Badge } from "@/components/ui/badge";

export function BookingListItemCard({
  booking,
  perspective = "borrower",
}: {
  booking: BookingListItem;
  perspective?: "borrower" | "reviewer";
}) {
  const nextStep = (() => {
    switch (booking.status) {
      case "pending":
        return perspective === "borrower"
          ? "Waiting for owner review"
          : "Eligibility passed · decide";
      case "waitlisted":
        return booking.waitlist
          ? `Waitlist position ${booking.waitlist.position} of ${booking.waitlist.total}`
          : "Waitlisted for owner review";
      case "approved":
        return perspective === "borrower" ? "Check-in opens 30 min before start" : "Awaiting borrower check-in";
      case "checked_in":
        return perspective === "borrower" ? "In your custody · submit return" : "In borrower custody";
      case "return_submitted":
        return perspective === "borrower" ? "Awaiting owner confirmation" : "Confirm the hand-back";
      case "completed":
        return "Custody closed";
      case "rejected":
        return "Review the written reason";
      case "cancelled":
        return "Booking released";
      default:
        return "";
    }
  })();

  return (
    <Link
      href={`/bookings/${booking.id}`}
      className="group flex flex-col gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/30 hover:bg-muted/20 sm:flex-row sm:items-center"
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className="mt-0.5 flex size-10 shrink-0 flex-col items-center justify-center rounded-lg border border-border bg-muted/40">
          <span className="text-[0.55rem] font-bold uppercase text-muted-foreground">
            {CATEGORY_LABELS[booking.resource.category].slice(0, 3)}
          </span>
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-[0.9rem] font-bold tracking-[-0.01em]">
              {booking.resource.name}
            </p>
            {booking.isOverdue ? (
              <Badge tone="danger" dot>
                Overdue
              </Badge>
            ) : null}
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.72rem] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Clock3 className="size-3" /> {formatDateTimeRange(booking.starts_at, booking.ends_at)}
            </span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3" /> {booking.resource.location.split("·")[0].trim()}
            </span>
          </p>
          <p className="mt-1.5 text-[0.68rem] font-medium text-muted-foreground">
            {perspective === "borrower" ? (
              <>
                Owner: <span className="text-foreground">{booking.resourceOwner.full_name}</span>
                <span className="mx-1.5">·</span>
              </>
            ) : (
              <>
                Borrower: <span className="text-foreground">{booking.borrower.full_name}</span>
                <span className="mx-1.5">·</span>
              </>
            )}
            {nextStep}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end">
        <BookingStatusBadge status={booking.status} overdue={booking.isOverdue} />
        <ArrowUpRight className="hidden size-3.5 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 sm:block" />
      </div>
    </Link>
  );
}
