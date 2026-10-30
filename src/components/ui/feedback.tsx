import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type AlertTone = "error" | "success" | "info" | "warning";

const tones: Record<AlertTone, string> = {
  error: "border-destructive/25 bg-destructive/8 text-destructive",
  success: "border-success/25 bg-success-soft text-success",
  info: "border-info/25 bg-info-soft text-info",
  warning: "border-warning/25 bg-warning-soft text-warning",
};

export function Alert({
  tone = "info",
  title,
  children,
  className,
  ...props
}: ComponentProps<"div"> & { tone?: AlertTone; title?: string }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("rounded-xl border px-3.5 py-3 text-sm leading-relaxed", tones[tone], className)}
      {...props}
    >
      {title ? <p className="mb-1 font-bold">{title}</p> : null}
      {children}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-14 text-center",
        className,
      )}
    >
      {icon ? (
        <div className="mb-4 flex size-12 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground">
          {icon}
        </div>
      ) : null}
      <h3 className="text-base font-bold">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
