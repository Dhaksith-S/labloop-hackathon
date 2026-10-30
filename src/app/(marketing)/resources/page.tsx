import type { Metadata } from "next";
import Link from "next/link";
import { Compass, ShieldCheck } from "lucide-react";
import { getDb } from "@/lib/db";
import { searchPublicResources } from "@/lib/resources";
import {
  CATEGORY_LABELS,
  RESOURCE_CATEGORIES,
  type ResourceCategory,
} from "@/lib/domain";
import { getSessionUser } from "@/lib/auth";
import { ResourceCard } from "@/components/resources/resource-card";
import { ResourceSearchForm } from "@/components/resources/resource-search-form";
import { EmptyState } from "@/components/ui/feedback";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Resource catalog",
  description:
    "Discover underused equipment, workspaces and technical resources at the fictional Northstar Institute demo workspace.",
};

export default async function ResourcesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const params = await searchParams;
  const query = (params.q ?? "").trim();
  const rawCategory = params.category ?? "all";
  const category: ResourceCategory | "all" = RESOURCE_CATEGORIES.includes(
    rawCategory as ResourceCategory,
  )
    ? (rawCategory as ResourceCategory)
    : "all";

  const db = getDb();
  const [resources, user] = await Promise.all([
    Promise.resolve(searchPublicResources(db, { q: query, category })),
    getSessionUser(),
  ]);
  const allActive = searchPublicResources(db);
  const categoryCounts = new Map<string, number>();
  for (const resource of allActive) {
    categoryCounts.set(resource.category, (categoryCounts.get(resource.category) ?? 0) + 1);
  }

  return (
    <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow">Discovery</p>
          <h1 className="display-title mt-3 text-[2.6rem] sm:text-[3.4rem]">
            Underused, not <em>unavailable.</em>
          </h1>
          <p className="mt-3 max-w-2xl text-[0.94rem] leading-relaxed text-ink-soft">
            Browse the live catalog, read the access requirements and see the owner&apos;s rules
            before you request a slot. Listings are real database records.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge tone="success" dot>
            {allActive.length} active listing{allActive.length === 1 ? "" : "s"}
          </Badge>
          {user ? (
            <Link href="/dashboard" className={buttonStyles({ variant: "outline", size: "sm" })}>
              Go to dashboard
            </Link>
          ) : (
            <Link href="/login" className={buttonStyles({ variant: "outline", size: "sm" })}>
              Sign in to request
            </Link>
          )}
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-border bg-card p-4">
        <ResourceSearchForm query={query} category={category} />
        <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border pt-3">
          <Link
            href={`/resources${query ? `?q=${encodeURIComponent(query)}` : ""}`}
            className={`rounded-full border px-3 py-1 text-[0.7rem] font-semibold transition-colors ${
              category === "all"
                ? "border-primary/25 bg-primary-soft text-primary"
                : "border-border text-muted-foreground hover:bg-muted"
            }`}
          >
            All · {allActive.length}
          </Link>
          {RESOURCE_CATEGORIES.map((value) => {
            const count = categoryCounts.get(value) ?? 0;
            if (count === 0) return null;
            const href = `/resources?category=${value}${query ? `&q=${encodeURIComponent(query)}` : ""}`;
            return (
              <Link
                key={value}
                href={href}
                className={`rounded-full border px-3 py-1 text-[0.7rem] font-semibold transition-colors ${
                  category === value
                    ? "border-primary/25 bg-primary-soft text-primary"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                {CATEGORY_LABELS[value]} · {count}
              </Link>
            );
          })}
        </div>
      </div>

      <p className="mt-6 text-xs font-semibold text-muted-foreground">
        {resources.length} result{resources.length === 1 ? "" : "s"}
        {query ? ` for “${query}”` : ""}
        {category !== "all" ? ` in ${CATEGORY_LABELS[category]}` : ""}
      </p>

      {resources.length > 0 ? (
        <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {resources.map((resource, index) => (
            <ResourceCard key={resource.id} resource={resource} index={index} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Compass className="size-5" />}
          title="No resources match that search"
          description="Try a different category or a broader search term. New listings appear here as soon as an owner publishes them."
          action={
            <Link href="/resources" className={buttonStyles({ variant: "outline" })}>
              Clear filters
            </Link>
          }
        />
      )}

      <div className="mt-12 flex flex-col gap-3 rounded-2xl border border-border bg-card/60 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
          <div>
            <p className="text-sm font-bold">Every request is reviewed by a person.</p>
            <p className="mt-1 max-w-2xl text-[0.8rem] leading-relaxed text-muted-foreground">
              Passing the eligibility engine does not grant access. It only makes the request
              reviewable. The owner records the decision and reason.
            </p>
          </div>
        </div>
        <Link href="/how-it-works" className={buttonStyles({ variant: "ghost", size: "sm" })}>
          How it works →
        </Link>
      </div>
    </div>
  );
}
