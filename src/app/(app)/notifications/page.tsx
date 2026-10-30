import type { Metadata } from "next";
import Link from "next/link";
import { Bell, BellRing, CheckCheck, Inbox } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { listNotifications } from "@/lib/notifications";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/lib/actions/bookings";
import { formatDateTime, formatRelative } from "@/lib/time";
import { PageHeader } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InlineAction } from "@/components/forms/action-form";
import { EmptyState } from "@/components/ui/feedback";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const user = await requireUser("/notifications");
  const notifications = listNotifications(getDb(), user.id, 80);
  const unread = notifications.filter((notification) => !notification.read_at);

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Your inbox"
        title="Notifications"
        description="Decisions, waitlist changes, custody reminders, incident outcomes and credential reviews. Each notice corresponds to a persistent record."
        actions={
          unread.length > 0 ? (
            <form action={markAllNotificationsReadAction}>
              <Button type="submit" variant="outline">
                <CheckCheck className="size-4" /> Mark all read
              </Button>
            </form>
          ) : undefined
        }
      />

      <div className="flex flex-wrap gap-2">
        <Badge tone={unread.length ? "primary" : "outline"} dot={unread.length > 0}>
          {unread.length} unread
        </Badge>
        <Badge tone="outline">{notifications.length} retained</Badge>
      </div>

      {notifications.length === 0 ? (
        <EmptyState
          icon={<Inbox className="size-5" />}
          title="Nothing in your inbox"
          description="When an owner decides your request, a waitlist position changes, or a reviewer records an incident outcome, the notice appears here."
          action={
            <Link href="/resources" className="text-[0.8rem] font-bold text-primary hover:underline">
              Find a resource →
            </Link>
          }
        />
      ) : (
        <ol className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {notifications.map((notification) => (
            <li
              key={notification.id}
              className={
                notification.read_at
                  ? "px-4 py-3.5 sm:px-5"
                  : "border-l-2 border-l-primary bg-primary-soft/20 px-4 py-3.5 sm:px-5"
              }
            >
              <div className="flex items-start gap-3">
                <span
                  className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border ${
                    notification.read_at
                      ? "border-border bg-muted/30 text-muted-foreground"
                      : "border-primary/25 bg-primary-soft text-primary"
                  }`}
                >
                  {notification.read_at ? (
                    <Bell className="size-3.5" aria-hidden />
                  ) : (
                    <BellRing className="size-3.5" aria-hidden />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <p className="text-[0.84rem] font-bold">{notification.title}</p>
                    <time
                      dateTime={notification.created_at}
                      className="text-[0.64rem] text-muted-foreground"
                      title={formatDateTime(notification.created_at)}
                    >
                      {formatRelative(notification.created_at)}
                    </time>
                  </div>
                  <p className="mt-1 text-[0.78rem] leading-relaxed text-muted-foreground">
                    {notification.body}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    {notification.href ? (
                      <Link
                        href={notification.href}
                        className="text-[0.72rem] font-bold text-primary hover:underline"
                      >
                        Open record →
                      </Link>
                    ) : null}
                    {!notification.read_at ? (
                      <InlineAction
                        action={markNotificationReadAction}
                        fields={{ notificationId: notification.id }}
                        label="Mark read"
                        pendingLabel="Saving…"
                        variant="ghost"
                        className="text-muted-foreground"
                      />
                    ) : (
                      <span className="text-[0.64rem] text-muted-foreground">
                        Read {formatRelative(notification.read_at)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}

      <p className="text-[0.7rem] leading-relaxed text-muted-foreground">
        Notifications are delivered in-app only. No email or SMS is sent in this demonstration. A
        notice never grants access by itself — any change in access is recorded separately as a
        booking decision.
      </p>
    </div>
  );
}
