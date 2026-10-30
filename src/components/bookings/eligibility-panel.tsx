import { CheckCircle2, Info, ShieldAlert, XCircle } from "lucide-react";
import type { EligibilityResult } from "@/lib/eligibility";
import { cn } from "@/lib/utils";

export function EligibilityPanel({
  result,
  compact = false,
  className,
}: {
  result: EligibilityResult;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border border-border bg-card", className)}>
      <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <p className="text-[0.78rem] font-bold">Eligibility check</p>
          <p className="mt-0.5 text-[0.7rem] leading-relaxed text-muted-foreground">
            {result.summary}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full border px-2.5 py-1 text-[0.65rem] font-bold",
            result.eligible
              ? "border-success/25 bg-success-soft text-success"
              : "border-destructive/25 bg-destructive/8 text-destructive",
          )}
        >
          {result.eligible ? "Reviewable" : "Blocked"}
        </span>
      </div>
      <ul className={cn("divide-y divide-border", compact && "max-h-72 overflow-y-auto")}>
        {result.checks.map((check) => (
          <li key={check.id} className="flex items-start gap-2.5 px-4 py-2.5">
            {check.status === "fail" ? (
              <XCircle className="mt-0.5 size-3.5 shrink-0 text-destructive" aria-hidden />
            ) : check.status === "warning" ? (
              <Info className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden />
            ) : (
              <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-success" aria-hidden />
            )}
            <div className="min-w-0">
              <p className="text-[0.74rem] font-semibold leading-snug">{check.label}</p>
              <p className="mt-0.5 text-[0.68rem] leading-relaxed text-muted-foreground">
                {check.detail}
              </p>
            </div>
          </li>
        ))}
      </ul>
      {!result.eligible ? (
        <div className="m-3 flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-[0.7rem] leading-relaxed text-destructive">
          <ShieldAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          A request cannot be submitted until every blocking item is resolved. Requirements are
          verified by an authorized reviewer, not self-declared.
        </div>
      ) : null}
    </div>
  );
}
