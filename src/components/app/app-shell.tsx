import Link from "next/link";
import { Bell, LogOut } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button, buttonStyles } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Logo } from "@/components/brand/logo";
import { SidebarNav } from "@/components/app/sidebar-nav";
import { MobileAppMenu } from "@/components/app/mobile-app-menu";
import { getSessionUser } from "@/lib/auth";
import { logoutAction } from "@/lib/actions/auth";
import { getDb } from "@/lib/db";
import type { SessionUser } from "@/lib/db-types";
import { getUnreadNotificationCount } from "@/lib/notifications";
import { ROLE_LABELS } from "@/lib/domain";
import { redirect } from "next/navigation";

function managerCounts(db: ReturnType<typeof getDb>, user: SessionUser, organizationId: string) {
  const membership = user.memberships.find((m) => m.organizationId === organizationId);
  const isOwner = membership?.role === "owner";
  const scope = isOwner
    ? "JOIN resources r ON r.id = b.resource_id WHERE r.owner_id = ?"
    : "JOIN resources r ON r.id = b.resource_id WHERE r.organization_id = ?";
  const scopeParam = isOwner ? user.id : organizationId;
  const review = (
    db
      .prepare(
        `SELECT COUNT(*) AS count FROM bookings b ${scope} AND b.status IN ('pending','waitlisted')`,
      )
      .get(scopeParam) as { count: number }
  ).count;
  const custody = (
    db
      .prepare(
        `SELECT COUNT(*) AS count FROM bookings b ${scope} AND b.status IN ('approved','checked_in','return_submitted')`,
      )
      .get(scopeParam) as { count: number }
  ).count;
  const incidents = (
    db
      .prepare(
        `SELECT COUNT(*) AS count FROM incidents i
         JOIN resources r ON r.id = i.resource_id
         ${isOwner ? "WHERE r.owner_id = ?" : "WHERE r.organization_id = ?"}
           AND i.status IN ('open','reviewing')`,
      )
      .get(scopeParam) as { count: number }
  ).count;
  return { review, custody, incidents };
}

export async function AppShell({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const membership = user.memberships[0];
  if (!membership) {
    return (
      <div className="mx-auto max-w-lg px-6 py-24">
        <Logo />
        <h1 className="mt-8 text-2xl font-bold">No institution membership</h1>
        <p className="mt-2 text-muted-foreground">
          Your account is not attached to an organization yet. Ask a lab manager to invite you,
          or create a new demonstration account.
        </p>
        <form action={logoutAction} className="mt-6">
          <Button type="submit" variant="outline">Sign out</Button>
        </form>
      </div>
    );
  }
  const db = getDb();
  const isManager = ["manager", "admin"].includes(membership.role);
  const isStaff = ["owner", "manager", "admin"].includes(membership.role);
  const counts = {
    unread: getUnreadNotificationCount(db, user.id),
    ...(isStaff
      ? managerCounts(db, user, membership.organizationId)
      : { review: 0, custody: 0, incidents: 0 }),
  };
  const roleLabel = ROLE_LABELS[membership.role];
  const permissions = {
    isStaff,
    isManager,
    displayName: user.fullName,
    organizationName: membership.organizationName,
    roleLabel,
  };

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[264px] flex-col border-r border-border bg-card/55 lg:flex">
        <div className="border-b border-border/70 px-5 py-5">
          <Link href="/dashboard" aria-label="LabLoop dashboard">
            <Logo />
          </Link>
        </div>
        <div className="mx-4 mt-4 rounded-xl border border-border bg-background/70 px-3 py-2.5">
          <p className="text-[0.58rem] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Institution
          </p>
          <p className="mt-0.5 truncate text-[0.78rem] font-bold">{membership.organizationName}</p>
          <p className="text-[0.68rem] text-muted-foreground">{membership.timezone}</p>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-5">
          <SidebarNav permissions={permissions} counts={counts} />
        </div>
        <div className="border-t border-border p-3">
          <div className="rounded-xl border border-border bg-background/60 p-3">
            <p className="text-[0.58rem] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Demonstration data
            </p>
            <p className="mt-1 text-[0.7rem] leading-relaxed text-muted-foreground">
              Northstar Institute is fictional. All booking records are real rows in the local
              database.
            </p>
            <Link
              href="/how-it-works#demo"
              className="mt-2 inline-block text-[0.7rem] font-bold text-primary hover:underline"
            >
              Judge walkthrough →
            </Link>
          </div>
          <div className="mt-3 flex items-center gap-2.5 rounded-xl px-2 py-2">
            <Avatar name={user.fullName} color={user.avatarColor} />
            <div className="min-w-0 flex-1">
              <Link href="/profile" className="block truncate text-[0.78rem] font-bold hover:underline">
                {user.fullName}
              </Link>
              <p className="truncate text-[0.65rem] text-muted-foreground">{roleLabel}</p>
            </div>
            <form action={logoutAction}>
              <button
                type="submit"
                className={buttonStyles({ variant: "ghost", size: "icon", className: "size-8" })}
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut className="size-3.5" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      <div className="lg:pl-[264px]">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-border/80 bg-background/85 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <MobileAppMenu permissions={permissions} counts={counts} />
            <Link href="/dashboard" className="lg:hidden" aria-label="LabLoop dashboard">
              <Logo compact />
            </Link>
            <div className="hidden min-w-0 lg:block">
              <p className="truncate text-[0.72rem] font-semibold text-muted-foreground">
                {membership.organizationName}
                <span className="mx-1.5 text-border">/</span>
                Workspace
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Link
              href="/notifications"
              className={buttonStyles({ variant: "ghost", size: "icon", className: "size-9 relative" })}
              aria-label={`Notifications${counts.unread ? `, ${counts.unread} unread` : ""}`}
            >
              <Bell className="size-4" />
              {counts.unread > 0 ? (
                <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[0.55rem] font-bold text-destructive-foreground">
                  {counts.unread > 9 ? "9+" : counts.unread}
                </span>
              ) : null}
            </Link>
            <ThemeToggle />
            <Link href="/profile" className="ml-1 hidden items-center gap-2 sm:flex">
              <Avatar name={user.fullName} color={user.avatarColor} size="sm" />
              <span className="max-w-28 truncate text-xs font-semibold">{user.fullName}</span>
            </Link>
          </div>
        </header>
        <main id="main" className="mx-auto w-full max-w-[1220px] px-4 py-6 sm:px-6 lg:px-8 lg:py-9">
          {children}
        </main>
      </div>
    </div>
  );
}
