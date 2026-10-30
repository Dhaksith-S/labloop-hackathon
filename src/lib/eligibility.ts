import type {
  AvailabilityRow,
  BlackoutRow,
  BookingRow,
  QualificationRow,
  RequirementRow,
} from "./db-types";
import type { BookingStatus } from "./domain";
import { CUSTODY_STATUSES } from "./domain";
import {
  formatDuration,
  formatTimeRange,
  fromDateTimeLocalValue,
  istMinuteOfDay,
  istWeekday,
  istDateKey,
} from "./time";

export type EligibilityCheckStatus = "pass" | "fail" | "warning" | "info";

export interface EligibilityCheck {
  id: string;
  label: string;
  status: EligibilityCheckStatus;
  detail: string;
}

export interface EligibilityResource {
  id: string;
  name: string;
  status: "active" | "paused" | "archived";
  maxDurationHours: number;
  fairUseLimit: number;
  requirements: Pick<RequirementRow, "kind" | "label" | "description" | "is_required">[];
  availability: Pick<AvailabilityRow, "weekday" | "start_minute" | "end_minute">[];
  blackouts: Pick<BlackoutRow, "starts_at" | "ends_at" | "reason">[];
}

export interface EligibilityBorrower {
  userId: string;
  membershipStatus: "active" | "suspended" | "none";
  qualifications: Pick<QualificationRow, "name" | "status" | "expires_at">[];
}

export interface EligibilityBooking {
  id: string;
  borrowerId: string;
  startsAt: string;
  endsAt: string;
  status: BookingStatus;
}

export interface EligibilityInput {
  resource: EligibilityResource;
  borrower: EligibilityBorrower;
  requestedStartsAt: string;
  requestedEndsAt: string;
  now: string;
  resourceBookings: EligibilityBooking[];
  borrowerBookings: EligibilityBooking[];
  excludeBookingId?: string;
  mode?: "request" | "approval";
}

export interface EligibilityResult {
  eligible: boolean;
  checks: EligibilityCheck[];
  blockingReasons: string[];
  summary: string;
  durationLabel: string;
}

const ACTIVE_REQUEST_STATUSES: BookingStatus[] = ["pending", "waitlisted", "approved"];
const BLOCKING_RESOURCE_STATUSES: BookingStatus[] = [
  "approved",
  "checked_in",
  "return_submitted",
];

function overlaps(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return aStart < bEnd && aEnd > bStart;
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export function qualificationIsVerified(
  qualification: Pick<QualificationRow, "status" | "expires_at">,
  now: string,
): boolean {
  if (qualification.status !== "verified") return false;
  if (qualification.expires_at && qualification.expires_at < now) return false;
  return true;
}

/**
 * Deterministic requirement standing used on resource detail pages and by the
 * full eligibility engine. No AI, no inferred verification.
 */
export function evaluateRequirementStanding(
  resource: EligibilityResource,
  borrower: EligibilityBorrower,
  now: string,
): EligibilityCheck[] {
  const checks: EligibilityCheck[] = [];

  checks.push({
    id: "membership",
    label: "Active institution membership",
    status: borrower.membershipStatus === "active" ? "pass" : "fail",
    detail:
      borrower.membershipStatus === "active"
        ? "Your Northstar membership is active."
        : borrower.membershipStatus === "suspended"
          ? "Your membership is suspended. Contact the lab manager."
          : "You need an active institution membership before requesting access.",
  });

  for (const requirement of resource.requirements) {
    if (requirement.kind === "membership") continue;
    const verified = borrower.qualifications.find(
      (qualification) =>
        normalize(qualification.name) === normalize(requirement.label) &&
        qualificationIsVerified(qualification, now),
    );
    const pending = borrower.qualifications.find(
      (qualification) =>
        normalize(qualification.name) === normalize(requirement.label) &&
        qualification.status === "pending",
    );
    const status: EligibilityCheckStatus = verified
      ? "pass"
      : requirement.is_required
        ? "fail"
        : "warning";
    checks.push({
      id: `requirement-${requirement.label}`,
      label: requirement.label,
      status,
      detail: verified
        ? "Verified by an authorized reviewer."
        : pending
          ? "A qualification is on file but is still pending human verification."
          : requirement.is_required
            ? "Required verification is missing. Request it from your lab manager."
            : "Optional credential not on file — the owner may still review your request.",
    });
  }

  return checks;
}

/**
 * Evaluate a concrete requested interval. This is intentionally deterministic
 * and explainable; every blocking reason is surfaced to the borrower and owner.
 */
export function evaluateEligibility(input: EligibilityInput): EligibilityResult {
  const {
    resource,
    borrower,
    requestedStartsAt,
    requestedEndsAt,
    now,
    resourceBookings,
    borrowerBookings,
    excludeBookingId,
    mode = "request",
  } = input;

  const checks: EligibilityCheck[] = [];
  const startMs = new Date(requestedStartsAt).getTime();
  const endMs = new Date(requestedEndsAt).getTime();
  const validWindow = Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs;
  const durationHours = validWindow ? (endMs - startMs) / 3_600_000 : 0;

  checks.push({
    id: "resource-status",
    label: "Resource is accepting requests",
    status: resource.status === "active" ? "pass" : "fail",
    detail:
      resource.status === "active"
        ? "Listing is active."
        : `This resource is currently ${resource.status}.`,
  });

  checks.push(...evaluateRequirementStanding(resource, borrower, now));

  checks.push({
    id: "time-validity",
    label: "Valid time window",
    status: validWindow ? "pass" : "fail",
    detail: validWindow
      ? `${formatTimeRange(requestedStartsAt, requestedEndsAt)} (${formatDuration(requestedStartsAt, requestedEndsAt)})`
      : "Choose an end time after the start time.",
  });

  if (validWindow) {
    const startsInFuture =
      mode === "request" ? startMs > new Date(now).getTime() : endMs > new Date(now).getTime();
    checks.push({
      id: "future-window",
      label: mode === "request" ? "Start time is in the future" : "Window has not already ended",
      status: startsInFuture ? "pass" : "fail",
      detail:
        mode === "request"
          ? startsInFuture
            ? "Request is for an upcoming slot."
            : "Requests must start in the future."
          : startsInFuture
            ? "Slot is still actionable."
            : "This slot has already ended.",
    });

    const withinDurationLimit = durationHours <= resource.maxDurationHours + 0.001;
    checks.push({
      id: "max-duration",
      label: `Within ${resource.maxDurationHours}-hour usage limit`,
      status: withinDurationLimit ? "pass" : "fail",
      detail: withinDurationLimit
        ? `Requested ${formatDuration(requestedStartsAt, requestedEndsAt)}.`
        : `This resource may be reserved for at most ${resource.maxDurationHours} hours per booking.`,
    });

    const withinAvailability = (() => {
      if (resource.availability.length === 0) {
        return {
          ok: false,
          detail: "The owner has not published any bookable hours yet.",
        };
      }
      const hasWindow = (weekday: number, startMinute: number, endMinute: number) =>
        resource.availability.some(
          (candidate) =>
            candidate.weekday === weekday &&
            candidate.start_minute <= startMinute &&
            candidate.end_minute >= endMinute,
        );

      const startWeekday = istWeekday(requestedStartsAt);
      const startMinute = istMinuteOfDay(requestedStartsAt);
      const endWeekday = istWeekday(requestedEndsAt);
      const endMinute = istMinuteOfDay(requestedEndsAt);
      const startKey = istDateKey(requestedStartsAt);
      const endKey = istDateKey(requestedEndsAt);

      const covered =
        startKey === endKey
          ? hasWindow(startWeekday, startMinute, endMinute)
          : (() => {
              // A maximum 24-hour reservation can cross at most one midnight.
              const daySpan =
                (new Date(`${endKey}T00:00:00Z`).getTime() -
                  new Date(`${startKey}T00:00:00Z`).getTime()) /
                86_400_000;
              if (daySpan > 1) return false;
              const firstDay = hasWindow(startWeekday, startMinute, 1440);
              const finalDay =
                endMinute === 0 ? true : hasWindow(endWeekday, 0, endMinute);
              return firstDay && finalDay;
            })();

      return covered
        ? { ok: true, detail: "Requested time falls inside published lab hours." }
        : {
            ok: false,
            detail:
              "Requested time falls outside the owner's weekly availability windows.",
          };
    })();
    checks.push({
      id: "availability",
      label: "Inside published lab hours",
      status: withinAvailability.ok ? "pass" : "fail",
      detail: withinAvailability.detail,
    });

    const blackout = resource.blackouts.find((entry) =>
      overlaps(requestedStartsAt, requestedEndsAt, entry.starts_at, entry.ends_at),
    );
    checks.push({
      id: "blackout",
      label: "No maintenance blackout",
      status: blackout ? "fail" : "pass",
      detail: blackout
        ? `Blocked by blackout: ${blackout.reason} (${formatTimeRange(blackout.starts_at, blackout.ends_at)}).`
        : "No blackout overlaps this slot.",
    });

    const conflict = resourceBookings.find(
      (booking) =>
        booking.id !== excludeBookingId &&
        BLOCKING_RESOURCE_STATUSES.includes(booking.status) &&
        overlaps(requestedStartsAt, requestedEndsAt, booking.startsAt, booking.endsAt),
    );
    checks.push({
      id: "resource-conflict",
      label: "No double booking",
      status: conflict ? "fail" : "pass",
      detail: conflict
        ? `An approved or in-use reservation already occupies this time (${formatTimeRange(conflict.startsAt, conflict.endsAt)}).`
        : "No approved reservation overlaps this slot.",
    });

    const borrowerConflict = borrowerBookings.find(
      (booking) =>
        booking.id !== excludeBookingId &&
        BLOCKING_RESOURCE_STATUSES.includes(booking.status) &&
        overlaps(requestedStartsAt, requestedEndsAt, booking.startsAt, booking.endsAt),
    );
    checks.push({
      id: "borrower-conflict",
      label: "No overlap with your other bookings",
      status: borrowerConflict ? "fail" : "pass",
      detail: borrowerConflict
        ? `You already hold an overlapping reservation (${formatTimeRange(borrowerConflict.startsAt, borrowerConflict.endsAt)}).`
        : "You have no overlapping approved reservations.",
    });

    const otherRequest = borrowerBookings.find(
      (booking) =>
        booking.id !== excludeBookingId &&
        ["pending", "waitlisted"].includes(booking.status) &&
        overlaps(requestedStartsAt, requestedEndsAt, booking.startsAt, booking.endsAt),
    );
    if (otherRequest) {
      checks.push({
        id: "borrower-open-request",
        label: "Overlapping open request",
        status: "warning",
        detail:
          "You already have an open request for this time. Submitting another is allowed but may be declined as a duplicate.",
      });
    }

    const competitors = resourceBookings.filter(
      (booking) =>
        booking.id !== excludeBookingId &&
        ["pending", "waitlisted"].includes(booking.status) &&
        overlaps(requestedStartsAt, requestedEndsAt, booking.startsAt, booking.endsAt),
    );
    checks.push({
      id: "competing-requests",
      label: "Competing requests",
      status: competitors.length > 0 ? "warning" : "pass",
      detail:
        competitors.length > 0
          ? `${competitors.length} other open request${competitors.length === 1 ? "" : "s"} overlap this slot. The owner reviews competing demand transparently.`
          : "No other open requests overlap this slot.",
    });
  }

  const activeForResource = resourceBookings.filter(
    (booking) =>
      booking.id !== excludeBookingId &&
      booking.borrowerId === borrower.userId &&
      ACTIVE_REQUEST_STATUSES.includes(booking.status) &&
      new Date(booking.endsAt).getTime() > new Date(now).getTime(),
  ).length;
  checks.push({
    id: "fair-use-limit",
    label: `Fair-use limit (${resource.fairUseLimit} active per member)`,
    status: activeForResource >= resource.fairUseLimit ? "fail" : "pass",
    detail:
      activeForResource >= resource.fairUseLimit
        ? `You already have ${activeForResource} active request${activeForResource === 1 ? "" : "s"} or bookings for this resource. Finish or cancel one before requesting again.`
        : `You hold ${activeForResource} of ${resource.fairUseLimit} allowed active requests/bookings for this resource.`,
  });

  const blockingReasons = checks
    .filter((check) => check.status === "fail")
    .map((check) => check.detail);
  const eligible = blockingReasons.length === 0;
  const warnings = checks.filter((check) => check.status === "warning").length;

  return {
    eligible,
    checks,
    blockingReasons,
    durationLabel: validWindow
      ? formatDuration(requestedStartsAt, requestedEndsAt)
      : "Invalid duration",
    summary: eligible
      ? warnings > 0
        ? `Meets all required rules with ${warnings} advisory note${warnings === 1 ? "" : "s"}. Human owner review is still required.`
        : "Meets all required rules. Human owner review is still required."
      : `${blockingReasons.length} requirement${blockingReasons.length === 1 ? "" : "s"} must be resolved before this request can proceed.`,
  };
}

export function getWaitlistPosition(
  resourceBookings: Array<Pick<BookingRow, "id" | "status" | "created_at">>,
  bookingId: string,
): { position: number; total: number; aheadOf: number } {
  const queue = resourceBookings
    .filter((booking) => booking.status === "waitlisted")
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const index = queue.findIndex((booking) => booking.id === bookingId);
  return {
    position: index >= 0 ? index + 1 : 0,
    total: queue.length,
    aheadOf: index >= 0 ? index : 0,
  };
}

export function bookingBlocksCustody(status: BookingStatus): boolean {
  return CUSTODY_STATUSES.includes(status);
}

export function defaultRequestWindow(now: string, hours = 2): {
  startsAt: string;
  endsAt: string;
} {
  const start = new Date(Math.ceil((new Date(now).getTime() + 15 * 60_000) / (15 * 60_000)) * 15 * 60_000);
  return {
    startsAt: start.toISOString(),
    endsAt: new Date(start.getTime() + hours * 3_600_000).toISOString(),
  };
}

export { fromDateTimeLocalValue };
