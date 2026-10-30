import Link from "next/link";
import { Search, SlidersHorizontal } from "lucide-react";
import { CATEGORY_LABELS, RESOURCE_CATEGORIES, type ResourceCategory } from "@/lib/domain";
import { buttonStyles } from "@/components/ui/button";

export function ResourceSearchForm({
  query,
  category,
  compact = false,
}: {
  query?: string;
  category?: ResourceCategory | "all";
  compact?: boolean;
}) {
  return (
    <form
      method="get"
      action="/resources"
      role="search"
      className="flex flex-col gap-2 sm:flex-row sm:items-center"
    >
      <div className="relative flex-1">
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <label htmlFor="resource-search" className="sr-only">
          Search resources
        </label>
        <input
          id="resource-search"
          type="search"
          name="q"
          defaultValue={query ?? ""}
          placeholder="Search printers, benches, cameras, test gear…"
          className="h-11 w-full rounded-xl border border-input bg-card pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25"
        />
      </div>
      <div className="relative">
        <SlidersHorizontal
          className="pointer-events-none absolute left-3.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <label htmlFor="resource-category" className="sr-only">
          Filter by category
        </label>
        <select
          id="resource-category"
          name="category"
          defaultValue={category ?? "all"}
          className="h-11 w-full appearance-none rounded-xl border border-input bg-card pl-9 pr-9 text-sm font-medium text-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25 sm:w-44"
        >
          <option value="all">All categories</option>
          {RESOURCE_CATEGORIES.map((value) => (
            <option key={value} value={value}>
              {CATEGORY_LABELS[value]}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" className={buttonStyles({ className: "h-11 shrink-0" })}>
        Search
      </button>
      {!compact ? (
        <Link
          href="/resources"
          className={buttonStyles({ variant: "ghost", className: "h-11 shrink-0" })}
        >
          Reset
        </Link>
      ) : null}
    </form>
  );
}
