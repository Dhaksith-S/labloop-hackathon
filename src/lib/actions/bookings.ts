"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  cancelBooking,
  checkInBooking,
  confirmReturn,
  createBookingRequest,
  decideBooking,
  submitReturn,
} from "@/lib/bookings";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { CONDITION_GRADES } from "@/lib/domain";
import { createIncident, reviewIncident } from "@/lib/incidents";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/notifications";
import { fromDateTimeLocalValue } from "@/lib/time";
import {
  actionError,
  fieldErrorsFromZod,
  readBoolean,
  readString,
  type ActionResult,
} from "@/lib/action-results";

const uuid = z.uuid("Invalid identifier.");
const localDateTime = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/, "Choose a valid date and time.");

const createBookingSchema = z.object({
  resourceId: uuid,
  startsAt: localDateTime,
  endsAt: localDateTime,
  purpose: z
    .string()
    .trim()
    .min(10, "Describe the purpose in at least 10 characters.")
    .max(300, "Keep the purpose under 300 characters."),
  notes: z.string().trim().max(1000, "Keep notes under 1000 characters.").optional(),
  rulesAcknowledged: z.literal("on", { message: "Acknowledge the usage rules." }),
});

export async function createBookingAction(
  _previous: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser("/dashboard");
  const parsed = createBookingSchema.safeParse({
    resourceId: readString(formData, "resourceId"),
    startsAt: readString(formData, "startsAt"),
    endsAt: readString(formData, "endsAt"),
    purpose: readString(formData, "purpose"),
    notes: readString(formData, "notes") || undefined,
    rulesAcknowledged: readBoolean(formData, "rulesAcknowledged") ? "on" : "",
  });
  if (!parsed.success) return { fieldErrors: fieldErrorsFromZod(parsed.error) };

  let startsAt: string;
  let endsAt: string;
  try {
    startsAt = fromDateTimeLocalValue(parsed.data.startsAt);
    endsAt = fromDateTimeLocalValue(parsed.data.endsAt);
  } catch {
    return { fieldErrors: { startsAt: ["Choose a valid date and time."] } };
  }

  let bookingId: string;
  try {
    const result = createBookingRequest(getDb(), user, {
      resourceId: parsed.data.resourceId,
      startsAt,
      endsAt,
      purpose: parsed.data.purpose,
      notes: parsed.data.notes,
    });
    bookingId = result.bookingId;
  } catch (error) {
    return actionError(error);
  }

  revalidatePath("/dashboard");
  revalidatePath("/bookings");
  revalidatePath(`/resources/${parsed.data.resourceId}`);
  revalidatePath("/owner/requests");
  redirect(`/bookings/${bookingId}?created=1`);
}

const decisionSchema = z.object({
  bookingId: uuid,
  decision: z.enum(["approve", "reject", "waitlist"]),
  reason: z.string().trim().max(600, "Keep the reason under 600 characters.").optional(),
});

export async function decideBookingAction(
  _previous: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser("/owner/requests");
  const parsed = decisionSchema.safeParse({
    bookingId: readString(formData, "bookingId"),
    decision: readString(formData, "decision"),
    reason: readString(formData, "reason") || undefined,
  });
  if (!parsed.success) return { fieldErrors: fieldErrorsFromZod(parsed.error) };

  try {
    const result = decideBooking(
      getDb(),
      user,
      parsed.data.bookingId,
      parsed.data.decision,
      parsed.data.reason ?? "",
    );
    revalidatePath("/owner");
    revalidatePath("/owner/requests");
    revalidatePath("/owner/custody");
    revalidatePath("/dashboard");
    revalidatePath("/bookings");
    revalidatePath(`/bookings/${parsed.data.bookingId}`);
    return {
      ok: true,
      success:
        result.status === "waitlisted"
          ? `Request waitlisted at position ${result.waitlist?.position ?? 1} of ${result.waitlist?.total ?? 1}. The borrower has been notified.`
          : `Request ${result.status === "approved" ? "approved" : "rejected"}. The decision and reason are in the audit trail.`,
    };
  } catch (error) {
    return actionError(error);
  }
}

export async function cancelBookingAction(
  _previous: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser("/bookings");
  const schema = z.object({
    bookingId: uuid,
    reason: z.string().trim().max(500).optional(),
  });
  const parsed = schema.safeParse({
    bookingId: readString(formData, "bookingId"),
    reason: readString(formData, "reason") || undefined,
  });
  if (!parsed.success) return { fieldErrors: fieldErrorsFromZod(parsed.error) };

  try {
    const result = cancelBooking(
      getDb(),
      user,
      parsed.data.bookingId,
      parsed.data.reason ?? "",
    );
    revalidatePath("/dashboard");
    revalidatePath("/bookings");
    revalidatePath("/owner");
    revalidatePath("/owner/requests");
    revalidatePath("/owner/custody");
    revalidatePath(`/bookings/${parsed.data.bookingId}`);
    return {
      ok: true,
      success: result.promotedBookingId
        ? "Booking cancelled. The first eligible waitlisted request has returned to owner review — it is not auto-approved."
        : "Booking cancelled. The cancellation is recorded in the timeline and audit trail.",
    };
  } catch (error) {
    return actionError(error);
  }
}

const conditionSchema = z.object({
  bookingId: uuid,
  condition: z.enum(CONDITION_GRADES),
  accessoriesOk: z.boolean(),
  notes: z.string().trim().max(1000).optional(),
});

export async function checkInAction(
  _previous: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser("/bookings");
  const parsed = conditionSchema.extend({
    rulesAcknowledged: z.literal("on", { message: "Acknowledge the usage rules." }),
  }).safeParse({
    bookingId: readString(formData, "bookingId"),
    condition: readString(formData, "condition"),
    accessoriesOk: readBoolean(formData, "accessoriesOk"),
    notes: readString(formData, "notes") || undefined,
    rulesAcknowledged: readBoolean(formData, "rulesAcknowledged") ? "on" : "",
  });
  if (!parsed.success) return { fieldErrors: fieldErrorsFromZod(parsed.error) };

  try {
    checkInBooking(getDb(), user, parsed.data.bookingId, {
      condition: parsed.data.condition,
      accessoriesOk: parsed.data.accessoriesOk,
      notes: parsed.data.notes,
      rulesAcknowledged: true,
    });
    revalidatePath("/dashboard");
    revalidatePath("/bookings");
    revalidatePath(`/bookings/${parsed.data.bookingId}`);
    revalidatePath("/owner/custody");
    return {
      ok: true,
      success: "Check-in recorded. Custody is now with you; the initial condition report is locked.",
    };
  } catch (error) {
    return actionError(error);
  }
}

export async function submitReturnAction(
  _previous: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser("/bookings");
  const parsed = conditionSchema.safeParse({
    bookingId: readString(formData, "bookingId"),
    condition: readString(formData, "condition"),
    accessoriesOk: readBoolean(formData, "accessoriesOk"),
    notes: readString(formData, "notes") || undefined,
  });
  if (!parsed.success) return { fieldErrors: fieldErrorsFromZod(parsed.error) };

  try {
    submitReturn(getDb(), user, parsed.data.bookingId, {
      condition: parsed.data.condition,
      accessoriesOk: parsed.data.accessoriesOk,
      notes: parsed.data.notes,
    });
    revalidatePath("/dashboard");
    revalidatePath("/bookings");
    revalidatePath(`/bookings/${parsed.data.bookingId}`);
    revalidatePath("/owner/custody");
    return {
      ok: true,
      success: "Return submitted with a final condition report. The owner must confirm the hand-back.",
    };
  } catch (error) {
    return actionError(error);
  }
}

export async function confirmReturnAction(
  _previous: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser("/owner/custody");
  const schema = z.object({
    bookingId: uuid,
    note: z.string().trim().max(600).optional(),
  });
  const parsed = schema.safeParse({
    bookingId: readString(formData, "bookingId"),
    note: readString(formData, "note") || undefined,
  });
  if (!parsed.success) return { fieldErrors: fieldErrorsFromZod(parsed.error) };

  try {
    confirmReturn(getDb(), user, parsed.data.bookingId, parsed.data.note ?? "");
    revalidatePath("/owner");
    revalidatePath("/owner/custody");
    revalidatePath("/dashboard");
    revalidatePath("/bookings");
    revalidatePath(`/bookings/${parsed.data.bookingId}`);
    return {
      ok: true,
      success: "Return confirmed. Custody is closed and the timeline is complete.",
    };
  } catch (error) {
    return actionError(error);
  }
}

const incidentSchema = z.object({
  resourceId: uuid,
  bookingId: z.union([uuid, z.literal("")]).optional(),
  type: z.enum(["damage", "missing_accessory", "late_return", "access_conflict", "other"]),
  severity: z.enum(["low", "medium", "high"]),
  description: z
    .string()
    .trim()
    .min(15, "Describe the incident in at least 15 characters.")
    .max(1500, "Keep the description under 1500 characters."),
});

export async function reportIncidentAction(
  _previous: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser("/bookings");
  const parsed = incidentSchema.safeParse({
    resourceId: readString(formData, "resourceId"),
    bookingId: readString(formData, "bookingId"),
    type: readString(formData, "type"),
    severity: readString(formData, "severity"),
    description: readString(formData, "description"),
  });
  if (!parsed.success) return { fieldErrors: fieldErrorsFromZod(parsed.error) };

  try {
    createIncident(getDb(), user, {
      resourceId: parsed.data.resourceId,
      bookingId: parsed.data.bookingId || null,
      type: parsed.data.type,
      severity: parsed.data.severity,
      description: parsed.data.description,
    });
    revalidatePath("/owner/incidents");
    revalidatePath("/activity");
    if (parsed.data.bookingId) revalidatePath(`/bookings/${parsed.data.bookingId}`);
    return {
      ok: true,
      success:
        "Incident recorded for human review. No penalty has been applied automatically.",
    };
  } catch (error) {
    return actionError(error);
  }
}

const reviewIncidentSchema = z.object({
  incidentId: uuid,
  status: z.enum(["open", "reviewing", "resolved", "dismissed"]),
  resolutionNotes: z.string().trim().max(1500).optional(),
});

export async function reviewIncidentAction(
  _previous: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser("/owner/incidents");
  const parsed = reviewIncidentSchema.safeParse({
    incidentId: readString(formData, "incidentId"),
    status: readString(formData, "status"),
    resolutionNotes: readString(formData, "resolutionNotes") || undefined,
  });
  if (!parsed.success) return { fieldErrors: fieldErrorsFromZod(parsed.error) };

  try {
    reviewIncident(getDb(), user, parsed.data.incidentId, {
      status: parsed.data.status,
      resolutionNotes: parsed.data.resolutionNotes ?? "",
    });
    revalidatePath("/owner/incidents");
    revalidatePath("/owner");
    revalidatePath("/activity");
    return { ok: true, success: "Incident review saved with your human-written note." };
  } catch (error) {
    return actionError(error);
  }
}

export async function markNotificationReadAction(
  _previous: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser("/notifications");
  const id = readString(formData, "notificationId");
  if (z.uuid().safeParse(id).success) {
    markNotificationRead(getDb(), user.id, id);
    revalidatePath("/notifications");
    revalidatePath("/dashboard");
  }
  return { ok: true };
}

export async function markAllNotificationsReadAction(): Promise<void> {
  const user = await requireUser("/notifications");
  markAllNotificationsRead(getDb(), user.id);
  revalidatePath("/notifications");
  revalidatePath("/dashboard");
  redirect("/notifications");
}
