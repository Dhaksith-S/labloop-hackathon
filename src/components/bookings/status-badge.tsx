import type { BookingStatus } from "@/lib/domain";
import { BOOKING_STATUS_LABELS } from "@/lib/domain";
import { cn } from "@/lib/utils";

const styles: Record<BookingStatus, string> = {
  pending: "border-warning/25 bg-warning-soft text-warning",
  waitlisted: "border-info/25 bg-info-soft text-info",
  approved: "border-primary/25 bg-primary-soft text-primary",
  rejected: "border-destructive/25 bg-destructive/8 text-destructive",
  cancelled: "border-border bg-muted text-muted-foreground",
  checked_in: "border-accent/30 bg-accent/12 text-accent-foreground dark:text-accent",
  return_submitted: "border-info/25 bg-info-soft text-info",
  completed: "border-success/25 bg-success-soft text-success",
};

export function BookingStatusBadge({
  status,
  overdue = false,
  className,
}: {
  status: BookingStatus;
  overdue?: boolean;
  className?: string;
}) {
  if (overdue) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border border-destructive/25 bg-destructive/8 px-2.5 py-1 text-[0.7rem] font-bold text-destructive",
          className,
        )}
      >
        <span className="size-1.5 rounded-full bg-current pulse-dot" aria-hidden />
        Overdue · {BOOKING_STATUS_LABELS[status]}
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.7rem] font-bold",
        styles[status],
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {BOOKING_STATUS_LABELS[status]}
    </span>
  );
}
