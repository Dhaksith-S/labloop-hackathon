"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import {
  addAvailabilityWindow,
  addBlackout,
  addRequirement,
  createResource,
  removeAvailabilityWindow,
  removeBlackout,
  removeRequirement,
  updateResource,
} from "@/lib/resources";
import { RESOURCE_CATEGORIES } from "@/lib/domain";
import { DomainError } from "@/lib/state-machine";
import { fromDateTimeLocalValue } from "@/lib/time";
import {
  actionError,
  fieldErrorsFromZod,
  readBoolean,
  readNumber,
  readString,
  type ActionResult,
} from "@/lib/action-results";

const uuid = z.uuid("Invalid identifier.");

function resolveStaffOrganization(
  user: Awaited<ReturnType<typeof requireUser>>,
  requestedOrganizationId: string,
): { organizationId: string } {
  const membership = user.memberships.find(
    (candidate) =>
      candidate.organizationId === requestedOrganizationId &&
      candidate.status === "active" &&
      ["owner", "manager", "admin"].includes(candidate.role),
  );
  if (!membership) {
    throw new DomainError(
      "FORBIDDEN",
      "You cannot create or manage listings for this organization.",
    );
  }
  return { organizationId: membership.organizationId };
}

function parseTimeToMinute(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

const resourceFieldsSchema = z.object({
  name: z.string().trim().min(3, "Name must be at least 3 characters.").max(100),
  category: z.enum(RESOURCE_CATEGORIES),
  description: z
    .string()
    .trim()
    .min(20, "Describe the resource in at least 20 characters.")
    .max(2000),
  location: z.string().trim().min(3, "Add a pickup location.").max(140),
  maxDurationHours: z.coerce.number().int().min(1).max(24),
  fairUseLimit: z.coerce.number().int().min(1).max(10),
  usageRules: z
    .string()
    .trim()
    .min(10, "Add usage rules members must follow.")
    .max(2000),
  conditionSummary: z
    .string()
    .trim()
    .min(5, "Describe the current condition.")
    .max(600),
  eligibilityNote: z.string().trim().max(600).optional(),
});

const createResourceSchema = resourceFieldsSchema.extend({
  organizationId: uuid,
  requirementLabel: z.string().trim().max(100).optional(),
  requirementKind: z.enum(["membership", "qualification", "training"]).optional(),
  requirementDescription: z.string().trim().max(500).optional(),
  weekdays: z
    .array(z.coerce.number().int().min(0).max(6))
    .min(1, "Choose at least one available day."),
  openTime: z.string().regex(/^\d{2}:\d{2}$/, "Choose an opening time."),
  closeTime: z.string().regex(/^\d{2}:\d{2}$/, "Choose a closing time."),
});

export async function createResourceAction(
  _previous: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser("/owner/resources/new");
  const weekdays = formData
    .getAll("weekdays")
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value));
  const parsed = createResourceSchema.safeParse({
    organizationId: readString(formData, "organizationId"),
    name: readString(formData, "name"),
    category: readString(formData, "category"),
    description: readString(formData, "description"),
    location: readString(formData, "location"),
    maxDurationHours: readNumber(formData, "maxDurationHours", 4),
    fairUseLimit: readNumber(formData, "fairUseLimit", 2),
    usageRules: readString(formData, "usageRules"),
    conditionSummary: readString(formData, "conditionSummary"),
    eligibilityNote: readString(formData, "eligibilityNote") || undefined,
    requirementLabel: readString(formData, "requirementLabel") || undefined,
    requirementKind: readString(formData, "requirementKind") || undefined,
    requirementDescription: readString(formData, "requirementDescription") || undefined,
    weekdays,
    openTime: readString(formData, "openTime"),
    closeTime: readString(formData, "closeTime"),
  });
  if (!parsed.success) return { fieldErrors: fieldErrorsFromZod(parsed.error) };

  const openMinute = parseTimeToMinute(parsed.data.openTime);
  const closeMinute = parseTimeToMinute(parsed.data.closeTime);
  if (openMinute === null || closeMinute === null || closeMinute <= openMinute) {
    return { fieldErrors: { closeTime: ["Closing time must be after opening time."] } };
  }

  let resourceId: string;
  try {
    const { organizationId } = resolveStaffOrganization(user, parsed.data.organizationId);
    const resource = createResource(getDb(), user, organizationId, {
      name: parsed.data.name,
      category: parsed.data.category,
      description: parsed.data.description,
      location: parsed.data.location,
      maxDurationHours: parsed.data.maxDurationHours,
      fairUseLimit: parsed.data.fairUseLimit,
      usageRules: parsed.data.usageRules,
      conditionSummary: parsed.data.conditionSummary,
      eligibilityNote: parsed.data.eligibilityNote,
      requirements: parsed.data.requirementLabel
        ? [
            {
              kind: parsed.data.requirementKind ?? "qualification",
              label: parsed.data.requirementLabel,
              description: parsed.data.requirementDescription,
              isRequired: true,
            },
          ]
        : [],
      availability: [
        {
          weekdays: parsed.data.weekdays,
          startMinute: openMinute,
          endMinute: closeMinute,
        },
      ],
    });
    resourceId = resource.id;
  } catch (error) {
    return actionError(error);
  }

  revalidatePath("/resources");
  revalidatePath("/owner/resources");
  revalidatePath("/owner");
  revalidatePath("/dashboard");
  redirect(`/owner/resources/${resourceId}?created=1`);
}

const updateResourceSchema = resourceFieldsSchema.extend({
  resourceId: uuid,
  status: z.enum(["active", "paused", "archived"]),
});

export async function updateResourceAction(
  _previous: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser("/owner/resources");
  const parsed = updateResourceSchema.safeParse({
    resourceId: readString(formData, "resourceId"),
    name: readString(formData, "name"),
    category: readString(formData, "category"),
    description: readString(formData, "description"),
    location: readString(formData, "location"),
    maxDurationHours: readNumber(formData, "maxDurationHours", 4),
    fairUseLimit: readNumber(formData, "fairUseLimit", 2),
    usageRules: readString(formData, "usageRules"),
    conditionSummary: readString(formData, "conditionSummary"),
    eligibilityNote: readString(formData, "eligibilityNote") || undefined,
    status: readString(formData, "status"),
  });
  if (!parsed.success) return { fieldErrors: fieldErrorsFromZod(parsed.error) };

  try {
    updateResource(getDb(), user, parsed.data.resourceId, {
      name: parsed.data.name,
      category: parsed.data.category,
      description: parsed.data.description,
      location: parsed.data.location,
      maxDurationHours: parsed.data.maxDurationHours,
      fairUseLimit: parsed.data.fairUseLimit,
      usageRules: parsed.data.usageRules,
      conditionSummary: parsed.data.conditionSummary,
      eligibilityNote: parsed.data.eligibilityNote,
      status: parsed.data.status,
    });
    revalidatePath("/owner/resources");
    revalidatePath(`/owner/resources/${parsed.data.resourceId}`);
    revalidatePath(`/resources/${parsed.data.resourceId}`);
    revalidatePath("/resources");
    return { ok: true, success: "Listing updated. Changes are visible immediately." };
  } catch (error) {
    return actionError(error);
  }
}

export async function addRequirementAction(
  _previous: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser("/owner/resources");
  const schema = z.object({
    resourceId: uuid,
    kind: z.enum(["membership", "qualification", "training"]),
    label: z.string().trim().min(3, "Enter a requirement label.").max(100),
    description: z.string().trim().max(500).optional(),
    isRequired: z.boolean(),
  });
  const parsed = schema.safeParse({
    resourceId: readString(formData, "resourceId"),
    kind: readString(formData, "kind"),
    label: readString(formData, "label"),
    description: readString(formData, "description") || undefined,
    isRequired: readBoolean(formData, "isRequired"),
  });
  if (!parsed.success) return { fieldErrors: fieldErrorsFromZod(parsed.error) };

  try {
    addRequirement(getDb(), user, parsed.data.resourceId, {
      kind: parsed.data.kind,
      label: parsed.data.label,
      description: parsed.data.description,
      isRequired: parsed.data.isRequired,
    });
    revalidatePath(`/owner/resources/${parsed.data.resourceId}`);
    revalidatePath(`/resources/${parsed.data.resourceId}`);
    return { ok: true, success: "Access requirement added." };
  } catch (error) {
    return actionError(error);
  }
}

export async function removeRequirementAction(
  _previous: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser("/owner/resources");
  const schema = z.object({ resourceId: uuid, requirementId: uuid });
  const parsed = schema.safeParse({
    resourceId: readString(formData, "resourceId"),
    requirementId: readString(formData, "requirementId"),
  });
  if (!parsed.success) return { fieldErrors: fieldErrorsFromZod(parsed.error) };
  try {
    removeRequirement(getDb(), user, parsed.data.resourceId, parsed.data.requirementId);
    revalidatePath(`/owner/resources/${parsed.data.resourceId}`);
    revalidatePath(`/resources/${parsed.data.resourceId}`);
    return { ok: true, success: "Requirement removed." };
  } catch (error) {
    return actionError(error);
  }
}

export async function addAvailabilityAction(
  _previous: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser("/owner/resources");
  const schema = z.object({
    resourceId: uuid,
    weekday: z.coerce.number().int().min(0).max(6),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
  });
  const parsed = schema.safeParse({
    resourceId: readString(formData, "resourceId"),
    weekday: readString(formData, "weekday"),
    startTime: readString(formData, "startTime"),
    endTime: readString(formData, "endTime"),
  });
  if (!parsed.success) return { fieldErrors: fieldErrorsFromZod(parsed.error) };
  const startMinute = parseTimeToMinute(parsed.data.startTime);
  const endMinute = parseTimeToMinute(parsed.data.endTime);
  if (startMinute === null || endMinute === null || endMinute <= startMinute) {
    return { fieldErrors: { endTime: ["Closing time must be after opening time."] } };
  }
  try {
    addAvailabilityWindow(getDb(), user, parsed.data.resourceId, {
      weekday: parsed.data.weekday,
      startMinute,
      endMinute,
    });
    revalidatePath(`/owner/resources/${parsed.data.resourceId}`);
    revalidatePath(`/resources/${parsed.data.resourceId}`);
    return { ok: true, success: "Weekly availability added." };
  } catch (error) {
    return actionError(error);
  }
}

export async function removeAvailabilityAction(
  _previous: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser("/owner/resources");
  const schema = z.object({ resourceId: uuid, windowId: uuid });
  const parsed = schema.safeParse({
    resourceId: readString(formData, "resourceId"),
    windowId: readString(formData, "windowId"),
  });
  if (!parsed.success) return { fieldErrors: fieldErrorsFromZod(parsed.error) };
  try {
    removeAvailabilityWindow(getDb(), user, parsed.data.resourceId, parsed.data.windowId);
    revalidatePath(`/owner/resources/${parsed.data.resourceId}`);
    revalidatePath(`/resources/${parsed.data.resourceId}`);
    return { ok: true, success: "Availability window removed." };
  } catch (error) {
    return actionError(error);
  }
}

export async function addBlackoutAction(
  _previous: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser("/owner/resources");
  const schema = z.object({
    resourceId: uuid,
    startsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/),
    endsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/),
    reason: z.string().trim().min(5, "Add a reason for the blackout.").max(300),
  });
  const parsed = schema.safeParse({
    resourceId: readString(formData, "resourceId"),
    startsAt: readString(formData, "startsAt"),
    endsAt: readString(formData, "endsAt"),
    reason: readString(formData, "reason"),
  });
  if (!parsed.success) return { fieldErrors: fieldErrorsFromZod(parsed.error) };
  try {
    addBlackout(getDb(), user, parsed.data.resourceId, {
      startsAt: fromDateTimeLocalValue(parsed.data.startsAt),
      endsAt: fromDateTimeLocalValue(parsed.data.endsAt),
      reason: parsed.data.reason,
    });
    revalidatePath(`/owner/resources/${parsed.data.resourceId}`);
    revalidatePath(`/resources/${parsed.data.resourceId}`);
    return { ok: true, success: "Maintenance blackout added." };
  } catch (error) {
    return actionError(error);
  }
}

export async function removeBlackoutAction(
  _previous: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser("/owner/resources");
  const schema = z.object({ resourceId: uuid, blackoutId: uuid });
  const parsed = schema.safeParse({
    resourceId: readString(formData, "resourceId"),
    blackoutId: readString(formData, "blackoutId"),
  });
  if (!parsed.success) return { fieldErrors: fieldErrorsFromZod(parsed.error) };
  try {
    removeBlackout(getDb(), user, parsed.data.resourceId, parsed.data.blackoutId);
    revalidatePath(`/owner/resources/${parsed.data.resourceId}`);
    revalidatePath(`/resources/${parsed.data.resourceId}`);
    return { ok: true, success: "Blackout removed." };
  } catch (error) {
    return actionError(error);
  }
}
