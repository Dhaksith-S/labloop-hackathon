import type { z } from "zod";
import { DomainError } from "./state-machine";

export interface ActionResult {
  ok?: boolean;
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string[]>;
  details?: string[];
}

export function fieldErrorsFromZod(error: z.ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? String(issue.path[0]) : "form";
    fieldErrors[key] = [...(fieldErrors[key] ?? []), issue.message];
  }
  return fieldErrors;
}

export function actionError(error: unknown): ActionResult {
  if (error instanceof DomainError) {
    return {
      error: error.message,
      details: error.details,
      fieldErrors:
        error.code === "INELIGIBLE" || error.code === "NOT_ELIGIBLE"
          ? { form: error.details ?? [error.message] }
          : undefined,
    };
  }
  if (error instanceof Error && error.message.includes("BOOKING_CONFLICT")) {
    return {
      error:
        "That slot is already held by another approved booking. Waitlist this request or ask the borrower to choose another time.",
    };
  }
  if (error instanceof Error && error.message.includes("FORBIDDEN")) {
    return {
      error: "You do not have permission to perform that action.",
    };
  }
  console.error("[LabLoop action error]", error);
  return {
    error: "Something went wrong while saving. Please try again, or contact the lab manager.",
  };
}

export function readString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export function readBoolean(formData: FormData, key: string): boolean {
  const value = formData.get(key);
  return value === "on" || value === "true" || value === "1";
}

export function readNumber(formData: FormData, key: string, fallback = 0): number {
  const value = readString(formData, key);
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
