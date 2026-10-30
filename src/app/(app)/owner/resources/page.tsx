import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Boxes,
  CalendarPlus,
  CirclePause,
  PencilLine,
  Settings2,
  Sparkles,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getResourcesForManager } from "@/lib/resources";
import { summarizeAvailability } from "@/lib/availability";
import { PageHeader, StatCard } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { ResourceArt } from "@/components/resources/resource-art";
import { CATEGORY_LABELS } from "@/lib/domain";
import { formatRelative } from "@/lib/time";

export const metadata: Metadata = { title: "Manage listings" };

export default async function OwnerResourcesPage() {
  const user = await requireUser("/owner/resources");
  const membership = user.memberships.find(
    (entry) => entry.status === "active" && ["owner", "manager", "admin"].includes(entry.role),
  );
  if (!membership) redirect("/dashboard");
  const db = getDb();
  const resources = getResourcesForManager(db, user, membership.organizationId);
  const active = resources.filter((resource) => resource.status === "active");
  const paused = resources.filter((resource) => resource.status === "paused");
  const archived = resources.filter((resource) => resource.status === "archived");

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow={`${membership.organizationName} · listings`}
        title="Listings & rules"
        description="Publish what the institution owns, who may use it and when. Every edit updates the public listing immediately and is written to the organization audit log."
        actions={
          <Link href="/owner/resources/new" className={buttonStyles()}>
            <CalendarPlus className="size-4" /> New listing
          </Link>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total listings"
          value={resources.length}
          hint="Owned or organization-wide"
          icon={<Boxes className="size-4" />}
        />
        <StatCard
          label="Active"
          value={active.length}
          hint="Visible in the public catalog"
          icon={<Sparkles className="size-4" />}
          tone="primary"
        />
        <StatCard
          label="Paused"
          value={paused.length}
          hint="Hidden from new requests"
          icon={<CirclePause className="size-4" />}
          tone={paused.length ? "warning" : "default"}
        />
        <StatCard
          label="Archived"
          value={archived.length}
          hint="Retained for custody history"
          icon={<Settings2 className="size-4" />}
        />
      </div>

      {resources.length === 0 ? (
        <EmptyState
          icon={<Boxes className="size-5" />}
          title="No listings yet"
          description={
            membership.role === "owner"
              ? "Create your first listing to make an underused resource discoverable. You can add requirements and availability in the next step."
              : "No resources exist in this organization yet. Create a listing to start the sharing loop."
          }
          action={
            <Link href="/owner/resources/new" className={buttonStyles()}>
              Create a listing <ArrowRight className="size-4" />
            </Link>
          }
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {resources.map((resource, index) => (
            <article
              key={resource.id}
              className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card"
            >
              <ResourceArt category={resource.category} index={index} compact />
              <div className="flex flex-1 flex-col p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="specimen-code">{CATEGORY_LABELS[resource.category]}</p>
                    <h2 className="mt-1.5 truncate text-[0.95rem] font-bold tracking-[-0.015em]">
                      {resource.name}
                    </h2>
                  </div>
                  <Badge
                    tone={
                      resource.status === "active"
                        ? "success"
                        : resource.status === "paused"
                          ? "warning"
                          : "neutral"
                    }
                  >
                    {resource.status}
                  </Badge>
                </div>
                <p className="mt-1.5 line-clamp-2 text-[0.76rem] leading-relaxed text-muted-foreground">
                  {resource.description}
                </p>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-[0.7rem]">
                  <div className="rounded-lg border border-border bg-muted/25 px-2.5 py-2">
                    <dt className="text-muted-foreground">Requirements</dt>
                    <dd className="mt-0.5 font-bold">{resource.requirements.length}</dd>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/25 px-2.5 py-2">
                    <dt className="text-muted-foreground">Fair-use cap</dt>
                    <dd className="mt-0.5 font-bold">{resource.fair_use_limit}</dd>
                  </div>
                </dl>
                <p className="mt-2 text-[0.68rem] text-muted-foreground">
                  {summarizeAvailability(resource.availability)} · max {resource.max_duration_hours}h
                </p>
                <p className="mt-auto pt-2 text-[0.64rem] text-muted-foreground">
                  Updated {formatRelative(resource.updated_at)}
                </p>
                <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
                  <Link
                    href={`/owner/resources/${resource.id}`}
                    className={buttonStyles({ variant: "outline", size: "sm" })}
                  >
                    <PencilLine className="size-3.5" /> Manage
                  </Link>
                  <Link
                    href={`/resources/${resource.id}`}
                    className={buttonStyles({ variant: "ghost", size: "sm" })}
                  >
                    Public page
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="text-[0.82rem] font-bold">A listing is more than a photo</p>
        <p className="mt-1.5 max-w-3xl text-[0.8rem] leading-relaxed text-muted-foreground">
          Access requirements, weekly availability, blackout periods, duration caps and fair-use
          limits are enforced by the eligibility engine on every request. Pausing a listing blocks
          new requests without invalidating existing custody. Archiving is blocked while approved or
          in-use bookings exist.
        </p>
      </div>
    </div>
  );
}
