"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { SidebarNav } from "@/components/app/sidebar-nav";
import { Logo } from "@/components/brand/logo";
import { buttonStyles } from "@/components/ui/button";

export function MobileAppMenu({
  permissions,
  counts,
}: {
  permissions: {
    isStaff: boolean;
    isManager: boolean;
    displayName: string;
    organizationName: string;
    roleLabel: string;
  };
  counts: { unread: number; review: number; custody: number; incidents: number };
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={buttonStyles({ variant: "outline", size: "icon", className: "size-9" })}
        aria-label="Open workspace navigation"
        aria-expanded={open}
        aria-controls="mobile-app-nav"
      >
        <Menu className="size-4" />
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/35 backdrop-blur-[2px]"
            aria-label="Close workspace navigation"
            onClick={() => setOpen(false)}
          />
          <div
            id="mobile-app-nav"
            role="dialog"
            aria-modal="true"
            aria-label="Workspace navigation"
            className="absolute inset-y-0 left-0 flex w-[86%] max-w-[320px] flex-col border-r border-border bg-background p-4 shadow-2xl"
          >
            <div className="mb-5 flex items-center justify-between">
              <Link href="/dashboard" onClick={() => setOpen(false)} aria-label="LabLoop dashboard">
                <Logo compact />
              </Link>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className={buttonStyles({ variant: "ghost", size: "icon", className: "size-9" })}
                aria-label="Close workspace navigation"
              >
                <X className="size-4" />
              </button>
            </div>
            <p className="mb-4 rounded-xl border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{permissions.displayName}</span>
              <br />
              {permissions.roleLabel} · {permissions.organizationName}
            </p>
            <div className="flex-1 overflow-y-auto">
              <SidebarNav
                permissions={permissions}
                counts={counts}
                onNavigate={() => setOpen(false)}
              />
            </div>
            <Link
              href="/profile"
              onClick={() => setOpen(false)}
              className="mt-4 rounded-xl border border-border bg-card px-3 py-2 text-sm font-semibold hover:bg-muted"
            >
              Profile & credentials
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
