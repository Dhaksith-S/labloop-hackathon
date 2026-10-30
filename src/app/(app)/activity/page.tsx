import type { Metadata } from "next";
import Link from "next/link";
import { Activity, CalendarCheck, History, ShieldCheck, Stethoscope } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getManagedActivity, getPersonalActivity, type ActivityItem } from "@/lib/activity";
import { formatDateTime, formatRelative } from "@/lib/time";
import { PageHeader } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";

export const metadata: Metadata = { title: "Activity" };

const SOURCE_ICONS = {
  booking: CalendarCheck,
  incident: Stethoscope,
  audit: ShieldCheck,
};

const SOURCE_LABELS = {
  booking: "Booking",
  incident: "Incident",
  audit: "Audit",
};

function ActivityList({ items }: { items: ActivityItem[] }) {
  return (
    <ol className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
      {items.map((item) => {
        const Icon = SOURCE_ICONS[item.source];
        const content = (
          <>
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/30">
              <Icon className="size-3.5 text-muted-foreground" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="text-[0.8rem] font-bold capitalize">{item.title}</p>
                <time
                  dateTime={item.createdAt}
                  className="shrink-0 text-[0.64rem] text-muted-foreground"
                  title={formatDateTime(item.createdAt)}
                >
                  {formatRelative(item.createdAt)}
                </time>
              </div>
              <p className="mt-0.5 text-[0.74rem] leading-relaxed text-muted-foreground">
                {item.detail}
              </p>
              <p className="mt-0.5 text-[0.64rem] text-muted-foreground">
                {item.actorName ? `By ${item.actorName}` : "System action"} ·{" "}
                {SOURCE_LABELS[item.source]}
                {item.resourceName ? ` · ${item.resourceName}` : ""}
              </p>
            </div>
          </>
        );
        return (
          <li key={item.id}>
            {item.href ? (
              <Link
                href={item.href}
                className="flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-muted/30"
              >
                {content}
              </Link>
            ) : (
              <div className="flex items-start gap-3 px-4 py-3.5">{content}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>;
}) {
  const user = await requireUser("/activity");
  const params = await searchParams;
  const membership = user.memberships[0];
  const isStaff = Boolean(
    membership && ["owner", "manager", "admin"].includes(membership.role),
  );
  const scope = params.scope === "organization" && isStaff ? "organization" : "personal";
  const db = getDb();
  const personal = getPersonalActivity(db, user.id, 80);
  const organization =
    scope === "organization" && membership
      ? getManagedActivity(db, user, membership.organizationId, 120)
      : [];
  const items = scope === "organization" ? organization : personal;

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Audit trail"
        title="Activity"
        description="Append-only records of requests, decisions, custody changes, incidents and listing edits. Nothing here can be rewritten by the application."
        actions={
          isStaff ? (
            <Link href="/owner" className={buttonStyles({ variant: "outline" })}>
              Owner studio
            </Link>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/activity"
          className={buttonStyles({ variant: scope === "personal" ? "primary" : "outline", size: "sm" })}
        >
          My activity ({personal.length})
        </Link>
        {isStaff ? (
          <Link
            href="/activity?scope=organization"
            className={buttonStyles({
              variant: scope === "organization" ? "primary" : "outline",
              size: "sm",
            })}
          >
            Organization audit
          </Link>
        ) : null}
        <Badge tone="outline" className="ml-auto">
          <History className="size-3" aria-hidden /> Append-only
        </Badge>
      </div>

      {scope === "organization" ? (
        <div className="rounded-2xl border border-border bg-card p-4 text-[0.78rem] leading-relaxed text-muted-foreground">
          This view is scoped to the events you are entitled to see as a{" "}
          {membership?.role === "owner" ? "resource owner" : "manager"}. Database triggers reject
          updates and deletes on the audit table, so the list is a historical record rather than a
          mutable feed.
        </div>
      ) : null}

      {items.length > 0 ? (
        <ActivityList items={items} />
      ) : (
        <EmptyState
          icon={<Activity className="size-5" />}
          title={scope === "organization" ? "No organization events yet" : "No activity yet"}
          description={
            scope === "organization"
              ? "Creating a listing, deciding a request or reviewing a credential will append an audit event here."
              : "Your requests, decisions, custody changes and incident reports will appear here with timestamps and actors."
          }
          action={
            <Link href="/resources" className={buttonStyles({ variant: "outline" })}>
              Browse resources
            </Link>
          }
        />
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["Booking events", "Created inside the same transaction as each lifecycle change."],
          ["Audit events", "Organization-level record of access and listing changes."],
          ["Incident reports", "Human review, never an automated penalty."],
        ].map(([title, body]) => (
          <div key={String(title)} className="rounded-xl border border-border bg-card p-4">
            <p className="text-[0.76rem] font-bold">{title}</p>
            <p className="mt-1 text-[0.7rem] leading-relaxed text-muted-foreground">{body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
