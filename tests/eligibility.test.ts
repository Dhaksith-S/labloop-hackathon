import { describe, expect, it } from "vitest";
import {
  evaluateEligibility,
  getWaitlistPosition,
  qualificationIsVerified,
  type EligibilityBorrower,
  type EligibilityInput,
  type EligibilityResource,
  type EligibilityResult,
} from "@/lib/eligibility";
import type { BookingRow } from "@/lib/db-types";
import type { BookingStatus } from "@/lib/domain";

/**
 * Fixed clock: Monday 1 June 2026, 09:30 Asia/Kolkata.
 * The base request is 10:00–11:00 IST, inside the base lab window 09:00–17:00.
 */
const NOW = "2026-06-01T04:00:00.000Z";
const STARTS = "2026-06-01T04:30:00.000Z";
const ENDS = "2026-06-01T05:30:00.000Z";

const baseResource: EligibilityResource = {
  id: "resource-1",
  name: "Test Bench",
  status: "active",
  maxDurationHours: 2,
  fairUseLimit: 2,
  requirements: [],
  availability: [{ weekday: 1, start_minute: 9 * 60, end_minute: 17 * 60 }],
  blackouts: [],
};

const baseBorrower: EligibilityBorrower = {
  userId: "user-1",
  membershipStatus: "active",
  qualifications: [],
};

function input(overrides: Partial<EligibilityInput> = {}): EligibilityInput {
  return {
    resource: baseResource,
    borrower: baseBorrower,
    requestedStartsAt: STARTS,
    requestedEndsAt: ENDS,
    now: NOW,
    resourceBookings: [],
    borrowerBookings: [],
    ...overrides,
  };
}

function check(result: EligibilityResult, id: string) {
  const found = result.checks.find((entry) => entry.id === id);
  if (!found) throw new Error(`Expected an eligibility check named ${id}`);
  return found;
}

function booking(
  id: string,
  status: BookingStatus,
  startsAt: string,
  endsAt: string,
  borrowerId = "other-user",
): EligibilityInput["resourceBookings"][number] {
  return { id, borrowerId, startsAt, endsAt, status };
}

describe("qualificationIsVerified", () => {
  it("accepts only verified, unexpired credentials", () => {
    expect(
      qualificationIsVerified({ status: "verified", expires_at: null }, NOW),
    ).toBe(true);
    expect(
      qualificationIsVerified({ status: "verified", expires_at: "2026-12-31T00:00:00.000Z" }, NOW),
    ).toBe(true);
    expect(
      qualificationIsVerified({ status: "verified", expires_at: "2026-05-31T23:59:59.000Z" }, NOW),
    ).toBe(false);
    expect(qualificationIsVerified({ status: "pending", expires_at: null }, NOW)).toBe(false);
    expect(qualificationIsVerified({ status: "expired", expires_at: null }, NOW)).toBe(false);
    expect(qualificationIsVerified({ status: "revoked", expires_at: null }, NOW)).toBe(false);
  });
});

describe("evaluateEligibility", () => {
  it("passes a clean request but always states that human review is required", () => {
    const result = evaluateEligibility(input());
    expect(result.eligible).toBe(true);
    expect(result.blockingReasons).toEqual([]);
    expect(result.summary).toMatch(/human owner review is still required/i);
    expect(check(result, "resource-status").status).toBe("pass");
    expect(check(result, "membership").status).toBe("pass");
    expect(check(result, "time-validity").status).toBe("pass");
    expect(check(result, "future-window").status).toBe("pass");
    expect(check(result, "max-duration").status).toBe("pass");
    expect(check(result, "availability").status).toBe("pass");
    expect(check(result, "blackout").status).toBe("pass");
    expect(check(result, "resource-conflict").status).toBe("pass");
    expect(check(result, "borrower-conflict").status).toBe("pass");
    expect(check(result, "fair-use-limit").status).toBe("pass");
  });

  it("blocks a suspended membership", () => {
    const result = evaluateEligibility(
      input({ borrower: { ...baseBorrower, membershipStatus: "suspended" } }),
    );
    expect(result.eligible).toBe(false);
    expect(check(result, "membership").status).toBe("fail");
    expect(result.blockingReasons.join(" ")).toMatch(/suspended/i);
  });

  it("blocks requests longer than the listing duration cap", () => {
    const result = evaluateEligibility(
      input({
        requestedStartsAt: "2026-06-01T04:30:00.000Z",
        requestedEndsAt: "2026-06-01T07:30:00.000Z",
      }),
    );
    expect(result.eligible).toBe(false);
    expect(check(result, "max-duration").status).toBe("fail");
  });

  it("blocks requests outside the published weekly availability", () => {
    const result = evaluateEligibility(
      input({
        requestedStartsAt: "2026-06-01T02:30:00.000Z",
        requestedEndsAt: "2026-06-01T03:30:00.000Z",
      }),
    );
    expect(result.eligible).toBe(false);
    expect(check(result, "availability").status).toBe("fail");
  });

  it("blocks requests that overlap a maintenance blackout", () => {
    const result = evaluateEligibility(
      input({
        resource: {
          ...baseResource,
          blackouts: [
            {
              starts_at: "2026-06-01T04:45:00.000Z",
              ends_at: "2026-06-01T05:15:00.000Z",
              reason: "Extraction service",
            },
          ],
        },
      }),
    );
    expect(result.eligible).toBe(false);
    expect(check(result, "blackout").status).toBe("fail");
    expect(check(result, "blackout").detail).toContain("Extraction service");
  });

  it("blocks a missing required qualification and names the requirement", () => {
    const featured = {
      ...baseResource,
      requirements: [
        {
          kind: "qualification" as const,
          label: "Laser Safety",
          description: "Induction",
          is_required: 1 as const,
        },
      ],
    };
    const result = evaluateEligibility(input({ resource: featured }));
    expect(result.eligible).toBe(false);
    expect(check(result, "requirement-Laser Safety").status).toBe("fail");
    expect(result.blockingReasons.join(" ")).toMatch(/missing/i);
  });

  it("does not accept a pending credential as proof", () => {
    const featured = {
      ...baseResource,
      requirements: [
        {
          kind: "qualification" as const,
          label: "Laser Safety",
          description: "Induction",
          is_required: 1 as const,
        },
      ],
    };
    const result = evaluateEligibility(
      input({
        resource: featured,
        borrower: {
          ...baseBorrower,
          qualifications: [{ name: "Laser Safety", status: "pending", expires_at: null }],
        },
      }),
    );
    expect(result.eligible).toBe(false);
    expect(check(result, "requirement-Laser Safety").detail).toMatch(/pending human verification/i);
  });

  it("does not accept an expired credential as proof", () => {
    const featured = {
      ...baseResource,
      requirements: [
        {
          kind: "qualification" as const,
          label: "Laser Safety",
          description: "Induction",
          is_required: 1 as const,
        },
      ],
    };
    const result = evaluateEligibility(
      input({
        resource: featured,
        borrower: {
          ...baseBorrower,
          qualifications: [
            { name: "Laser Safety", status: "verified", expires_at: "2026-05-01T00:00:00.000Z" },
          ],
        },
      }),
    );
    expect(result.eligible).toBe(false);
    expect(check(result, "requirement-Laser Safety").status).toBe("fail");
  });

  it("accepts a verified, unexpired credential with matching name", () => {
    const featured = {
      ...baseResource,
      requirements: [
        {
          kind: "qualification" as const,
          label: "Laser Safety",
          description: "Induction",
          is_required: 1 as const,
        },
      ],
    };
    const result = evaluateEligibility(
      input({
        resource: featured,
        borrower: {
          ...baseBorrower,
          qualifications: [
            { name: " laser safety ", status: "verified", expires_at: "2026-12-31T00:00:00.000Z" },
          ],
        },
      }),
    );
    expect(result.eligible).toBe(true);
    expect(check(result, "requirement-Laser Safety").status).toBe("pass");
  });

  it("treats a missing optional credential as an advisory warning, not a block", () => {
    const featured = {
      ...baseResource,
      requirements: [
        {
          kind: "training" as const,
          label: "Advanced Fixture Setup",
          description: "Helpful but not mandatory",
          is_required: 0 as const,
        },
      ],
    };
    const result = evaluateEligibility(input({ resource: featured }));
    expect(result.eligible).toBe(true);
    expect(check(result, "requirement-Advanced Fixture Setup").status).toBe("warning");
    expect(result.summary).toMatch(/advisory note/i);
  });

  it("blocks a request that overlaps an approved reservation", () => {
    const result = evaluateEligibility(
      input({
        resourceBookings: [
          booking("approved-1", "approved", "2026-06-01T05:00:00.000Z", "2026-06-01T06:00:00.000Z"),
        ],
      }),
    );
    expect(result.eligible).toBe(false);
    expect(check(result, "resource-conflict").status).toBe("fail");
  });

  it("warns about competing open requests without blocking submission", () => {
    const result = evaluateEligibility(
      input({
        resourceBookings: [
          booking("pending-1", "pending", STARTS, ENDS),
          booking("waitlist-1", "waitlisted", STARTS, ENDS),
        ],
      }),
    );
    expect(result.eligible).toBe(true);
    expect(check(result, "resource-conflict").status).toBe("pass");
    expect(check(result, "competing-requests").status).toBe("warning");
    expect(check(result, "competing-requests").detail).toContain("2 other open requests");
  });

  it("blocks a borrower who already holds an overlapping approved reservation", () => {
    const overlap = booking("mine-1", "approved", "2026-06-01T05:00:00.000Z", "2026-06-01T06:00:00.000Z", "user-1");
    const result = evaluateEligibility(
      input({ resourceBookings: [overlap], borrowerBookings: [overlap] }),
    );
    expect(result.eligible).toBe(false);
    expect(check(result, "borrower-conflict").status).toBe("fail");
  });

  it("enforces the per-resource fair-use cap for active requests", () => {
    const active = [
      booking("active-1", "approved", "2026-06-01T06:30:00.000Z", "2026-06-01T07:30:00.000Z", "user-1"),
      booking("active-2", "pending", "2026-06-01T08:00:00.000Z", "2026-06-01T09:00:00.000Z", "user-1"),
    ];
    const result = evaluateEligibility(
      input({ resourceBookings: active, borrowerBookings: active }),
    );
    expect(result.eligible).toBe(false);
    expect(check(result, "fair-use-limit").status).toBe("fail");
    expect(check(result, "fair-use-limit").detail).toContain("2 active");
  });

  it("ignores the booking being re-evaluated at approval time", () => {
    const own = booking("this-one", "pending", STARTS, ENDS, "user-1");
    const result = evaluateEligibility(
      input({
        resourceBookings: [own],
        borrowerBookings: [own],
        excludeBookingId: "this-one",
        mode: "approval",
      }),
    );
    expect(result.eligible).toBe(true);
    expect(check(result, "fair-use-limit").status).toBe("pass");
  });

  it("allows an approval re-check for a window that has already started but not ended", () => {
    const result = evaluateEligibility(
      input({
        requestedStartsAt: "2026-06-01T03:30:00.000Z",
        requestedEndsAt: "2026-06-01T04:45:00.000Z",
        now: "2026-06-01T04:00:00.000Z",
        mode: "approval",
      }),
    );
    expect(result.eligible).toBe(true);
    expect(check(result, "future-window").status).toBe("pass");
    expect(check(result, "max-duration").status).toBe("pass");
  });
});

describe("getWaitlistPosition", () => {
  const rows: Array<Pick<BookingRow, "id" | "status" | "created_at">> = [
    { id: "b2", status: "waitlisted", created_at: "2026-06-01T03:05:00.000Z" },
    { id: "b1", status: "waitlisted", created_at: "2026-06-01T03:00:00.000Z" },
    { id: "approved", status: "approved", created_at: "2026-06-01T02:55:00.000Z" },
    { id: "b3", status: "waitlisted", created_at: "2026-06-01T03:10:00.000Z" },
  ];

  it("orders by submission time and excludes non-waitlisted rows", () => {
    expect(getWaitlistPosition(rows, "b2")).toEqual({ position: 2, total: 3, aheadOf: 1 });
    expect(getWaitlistPosition(rows, "b3")).toEqual({ position: 3, total: 3, aheadOf: 2 });
  });

  it("returns zeroes for a booking that is not waitlisted", () => {
    expect(getWaitlistPosition(rows, "approved")).toEqual({ position: 0, total: 3, aheadOf: 0 });
  });
});
