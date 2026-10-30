import { cn } from "@/lib/utils";

export function Logo({
  className,
  showWordmark = true,
  compact = false,
}: {
  className?: string;
  showWordmark?: boolean;
  compact?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span
        className={cn(
          "relative inline-flex items-center justify-center overflow-hidden rounded-xl border border-primary/25 bg-primary text-primary-foreground",
          compact ? "size-8" : "size-9",
        )}
        aria-hidden
      >
        <svg viewBox="0 0 32 32" className={compact ? "size-5" : "size-[22px]"} fill="none">
          <path
            d="M8 21.5V12.5A4.5 4.5 0 0 1 12.5 8h2A4.5 4.5 0 0 1 19 12.5v1A4.5 4.5 0 0 1 14.5 18H12"
            stroke="currentColor"
            strokeWidth="2.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="22.5" cy="21.5" r="3.2" fill="var(--accent)" />
        </svg>
      </span>
      {showWordmark ? (
        <span className="flex flex-col leading-none">
          <span className="text-[1.02rem] font-extrabold tracking-[-0.035em]">LabLoop</span>
          {!compact ? (
            <span className="specimen-code mt-1 text-[0.52rem]">Share · Verify · Return</span>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}
