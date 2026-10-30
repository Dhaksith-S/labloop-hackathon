import type { BookingStatus } from "./domain";
import { BOOKING_STATUS_LABELS } from "./domain";

export class DomainError extends Error {
  readonly code: string;
  readonly details?: string[];

  constructor(code: string, message: string, details?: string[]) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.details = details;
  }
}

/**
 * Explicit lifecycle. Overdue is a derived presentation state, not a booking
 * status, so it can never corrupt custody transitions.
 */
export const BOOKING_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  pending: ["approved", "rejected", "waitlisted", "cancelled"],
  waitlisted: ["pending", "approved", "rejected", "cancelled"],
  approved: ["checked_in", "cancelled"],
  checked_in: ["return_submitted"],
  return_submitted: ["completed"],
  rejected: [],
  cancelled: [],
  completed: [],
};

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return BOOKING_TRANSITIONS[from].includes(to);
}

export function assertTransition(from: BookingStatus, to: BookingStatus): void {
  if (!canTransition(from, to)) {
    throw new DomainError(
      "INVALID_TRANSITION",
      `A ${BOOKING_STATUS_LABELS[from].toLowerCase()} booking cannot move to ${BOOKING_STATUS_LABELS[to].toLowerCase()}.`,
    );
  }
}

const CHECK_IN_OPENS_MINUTES_BEFORE = 30;
const CHECK_IN_CLOSES_MINUTES_AFTER_START = 120;

export function checkInWindow(startsAt: string): { opensAt: string; closesAt: string } {
  const start = new Date(startsAt).getTime();
  return {
    opensAt: new Date(start - CHECK_IN_OPENS_MINUTES_BEFORE * 60_000).toISOString(),
    closesAt: new Date(start + CHECK_IN_CLOSES_MINUTES_AFTER_START * 60_000).toISOString(),
  };
}

export function checkInAvailability(
  booking: { status: BookingStatus; starts_at: string },
  now: string,
): { allowed: boolean; opensAt: string; closesAt: string; reason?: string } {
  const window = checkInWindow(booking.starts_at);
  if (booking.status !== "approved") {
    return {
      ...window,
      allowed: false,
      reason: "Only approved bookings can be checked in.",
    };
  }
  if (now < window.opensAt) {
    return {
      ...window,
      allowed: false,
      reason: "Check-in is not open yet.",
    };
  }
  if (now > window.closesAt) {
    return {
      ...window,
      allowed: false,
      reason: "The check-in window has closed. Contact the resource owner.",
    };
  }
  return { ...window, allowed: true };
}

export function isOverdue(
  booking: { status: BookingStatus; ends_at: string },
  now: string,
): boolean {
  return (
    (booking.status === "approved" || booking.status === "checked_in") &&
    booking.ends_at < now
  );
}

export function isActiveRequest(status: BookingStatus): boolean {
  return ["pending", "waitlisted", "approved"].includes(status);
}

export function isCustodyActive(status: BookingStatus): boolean {
  return ["checked_in", "return_submitted"].includes(status);
}

export function requiresDecisionReason(to: BookingStatus): boolean {
  return to === "rejected" || to === "waitlisted";
}
