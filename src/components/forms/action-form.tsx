"use client";

import { useActionState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Alert } from "@/components/ui/feedback";
import { buttonStyles } from "@/components/ui/button";
import type { ActionResult } from "@/lib/action-results";
import { cn } from "@/lib/utils";

export type FormAction = (
  state: ActionResult | undefined,
  formData: FormData,
) => Promise<ActionResult>;

export function SubmitButton({
  children,
  pendingLabel = "Saving…",
  variant = "primary",
  size = "md",
  className,
  name,
  value,
}: {
  children: ReactNode;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger" | "accent";
  size?: "sm" | "md" | "lg";
  className?: string;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name={name}
      value={value}
      className={buttonStyles({ variant, size, className })}
      disabled={pending}
    >
      {pending ? (
        <>
          <span
            className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
            aria-hidden
          />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}

function labelForKey(key: string): string {
  if (key === "form") return "Required checks";
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (letter) => letter.toUpperCase());
}

export function ActionForm({
  action,
  children,
  submitLabel,
  pendingLabel,
  submitVariant = "primary",
  submitSize = "md",
  className,
  footer,
  hideSubmit = false,
  id,
}: {
  action: FormAction;
  children: ReactNode;
  submitLabel: string;
  pendingLabel?: string;
  submitVariant?: "primary" | "secondary" | "outline" | "ghost" | "danger" | "accent";
  submitSize?: "sm" | "md" | "lg";
  className?: string;
  footer?: ReactNode;
  hideSubmit?: boolean;
  id?: string;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const fieldErrors = state?.fieldErrors
    ? Object.entries(state.fieldErrors).filter(([, messages]) => messages.length > 0)
    : [];

  return (
    <form id={id} action={formAction} className={cn("space-y-4", className)}>
      {state?.error ? (
        <Alert tone="error" title="Could not save">
          <p>{state.error}</p>
          {state.details && state.details.length > 0 ? (
            <ul className="mt-2 list-disc space-y-1 pl-4">
              {state.details.map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
          ) : null}
        </Alert>
      ) : null}
      {fieldErrors.length > 0 ? (
        <Alert tone="error" title="Please check the form">
          <ul className="space-y-1.5">
            {fieldErrors.map(([key, messages]) => (
              <li key={key}>
                <span className="font-semibold">{labelForKey(key)}:</span> {messages.join(" ")}
              </li>
            ))}
          </ul>
        </Alert>
      ) : null}
      {state?.success ? <Alert tone="success">{state.success}</Alert> : null}
      {children}
      {footer ??
        (hideSubmit ? null : (
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <SubmitButton
              variant={submitVariant}
              size={submitSize}
              pendingLabel={pendingLabel}
            >
              {submitLabel}
            </SubmitButton>
          </div>
        ))}
    </form>
  );
}

export function InlineAction({
  action,
  fields,
  label,
  pendingLabel = "Working…",
  confirmMessage,
  variant = "ghost",
  className,
  icon,
}: {
  action: FormAction;
  fields: Record<string, string>;
  label: string;
  pendingLabel?: string;
  confirmMessage?: string;
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger" | "accent";
  className?: string;
  icon?: ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form
      action={formAction}
      className="inline-flex items-center gap-2"
      onSubmit={(event) => {
        if (confirmMessage && !window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
    >
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <button
        type="submit"
        className={buttonStyles({ variant, size: "sm", className })}
        disabled={pending}
      >
        {icon}
        {pending ? pendingLabel : label}
      </button>
      {state?.error ? (
        <span role="alert" className="text-xs font-medium text-destructive">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}
