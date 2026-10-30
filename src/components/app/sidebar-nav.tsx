"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Bell,
  Boxes,
  CalendarCheck,
  ClipboardList,
  Compass,
  LayoutDashboard,
  Settings2,
  ShieldCheck,
  Stethoscope,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavCounts {
  unread: number;
  review: number;
  custody: number;
  incidents: number;
}

interface NavPermissions {
  isStaff: boolean;
  isManager: boolean;
  displayName: string;
  organizationName: string;
  roleLabel: string;
}

interface Item {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

function itemsFor(permissions: NavPermissions, counts: NavCounts): { main: Item[]; manage: Item[]; admin: Item[] } {
  const main: Item[] = [
    { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
    { href: "/resources", label: "Discover", icon: Compass },
    { href: "/bookings", label: "My bookings", icon: CalendarCheck },
    { href: "/activity", label: "Activity", icon: Activity },
    { href: "/notifications", label: "Notifications", icon: Bell, badge: counts.unread },
  ];
  const manage: Item[] = permissions.isStaff
    ? [
        { href: "/owner", label: "Owner studio", icon: Boxes },
        { href: "/owner/resources", label: "Listings", icon: Settings2 },
        { href: "/owner/requests", label: "Requests", icon: ClipboardList, badge: counts.review },
        { href: "/owner/custody", label: "Custody", icon: ShieldCheck, badge: counts.custody },
        { href: "/owner/incidents", label: "Incidents", icon: Stethoscope, badge: counts.incidents },
      ]
    : [];
  const admin: Item[] = permissions.isManager
    ? [
        { href: "/admin", label: "Organization", icon: Users },
      ]
    : [];
  return { main, manage, admin };
}

function NavSection({
  label,
  items,
  pathname,
  onNavigate,
}: {
  label: string;
  items: Item[];
  pathname: string;
  onNavigate?: () => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="mb-5">
      <p className="mb-1.5 px-3 text-[0.6rem] font-bold uppercase tracking-[0.16em] text-muted-foreground/80">
        {label}
      </p>
      <ul className="space-y-0.5">
        {items.map((item) => {
          const active =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex items-center gap-2.5 rounded-lg px-3 py-2 text-[0.81rem] font-semibold transition-colors",
                  active
                    ? "bg-primary-soft text-primary"
                    : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                )}
              >
                <Icon className={cn("size-4", active ? "text-primary" : "text-muted-foreground")} />
                <span className="flex-1">{item.label}</span>
                {item.badge && item.badge > 0 ? (
                  <span
                    className={cn(
                      "min-w-5 rounded-full px-1.5 text-center text-[0.62rem] font-bold leading-5",
                      active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function SidebarNav({
  permissions,
  counts,
  onNavigate,
}: {
  permissions: NavPermissions;
  counts: NavCounts;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const { main, manage, admin } = itemsFor(permissions, counts);
  return (
    <nav aria-label="Workspace navigation" className="flex-1">
      <NavSection label="Workspace" items={main} pathname={pathname} onNavigate={onNavigate} />
      {manage.length ? (
        <NavSection
          label={permissions.roleLabel === "Resource owner" ? "Your studio" : "Operations"}
          items={manage}
          pathname={pathname}
          onNavigate={onNavigate}
        />
      ) : null}
      {admin.length ? (
        <NavSection label="Organization" items={admin} pathname={pathname} onNavigate={onNavigate} />
      ) : null}
    </nav>
  );
}
