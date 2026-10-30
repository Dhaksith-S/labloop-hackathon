"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { reviewQualification } from "@/lib/qualifications";
import {
  actionError,
  fieldErrorsFromZod,
  readString,
  type ActionResult,
} from "@/lib/action-results";

const uuid = z.uuid("Invalid identifier.");

const reviewSchema = z.object({
  organizationId: uuid,
  qualificationId: uuid,
  status: z.enum(["verified", "pending", "expired", "revoked"]),
  notes: z.string().trim().max(800).optional(),
  expiresAt: z.string().trim().max(30).optional(),
});

export async function reviewQualificationAction(
  _previous: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser("/admin");
  const parsed = reviewSchema.safeParse({
    organizationId: readString(formData, "organizationId"),
    qualificationId: readString(formData, "qualificationId"),
    status: readString(formData, "status"),
    notes: readString(formData, "notes") || undefined,
    expiresAt: readString(formData, "expiresAt") || undefined,
  });
  if (!parsed.success) return { fieldErrors: fieldErrorsFromZod(parsed.error) };

  try {
    reviewQualification(getDb(), user, parsed.data.organizationId, parsed.data.qualificationId, {
      status: parsed.data.status,
      notes: parsed.data.notes ?? "",
      expiresAt: parsed.data.expiresAt,
    });
    revalidatePath("/admin");
    revalidatePath("/dashboard");
    revalidatePath("/profile");
    return {
      ok: true,
      success: "Qualification review recorded. The member has been notified.",
    };
  } catch (error) {
    return actionError(error);
  }
}
