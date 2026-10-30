"use client";

import { useState } from "react";
import { ChevronDown, UserCog, Users, Wrench } from "lucide-react";
import { DEMO_PASSWORD } from "@/lib/domain";
import { cn } from "@/lib/utils";

const accounts = [
  {
    email: "student@labloop.demo",
    label: "Student",
    name: "Arjun Mehta",
    icon: Users,
  },
  {
    email: "owner@labloop.demo",
    label: "Owner",
    name: "Maya Iyer",
    icon: Wrench,
  },
  {
    email: "manager@labloop.demo",
    label: "Manager",
    name: "Riya Sen",
    icon: UserCog,
  },
];

export function DemoAccountPicker() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  function fill(email: string) {
    const emailInput = document.getElementById("email") as HTMLInputElement | null;
    const passwordInput = document.getElementById("password") as HTMLInputElement | null;
    if (emailInput) {
      emailInput.value = email;
      emailInput.dispatchEvent(new Event("input", { bubbles: true }));
    }
    if (passwordInput) {
      passwordInput.value = DEMO_PASSWORD;
      passwordInput.dispatchEvent(new Event("input", { bubbles: true }));
    }
    setSelected(email);
    setOpen(false);
  }

  return (
    <div className="rounded-xl border border-primary/20 bg-primary-soft/60">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="demo-account-list"
        className="flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left"
      >
        <span className="text-[0.74rem] font-bold text-primary">
          {selected ? `Filled ${selected}` : "Use a demo account"}
        </span>
        <ChevronDown
          className={cn("size-3.5 text-primary transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>
      {open ? (
        <div id="demo-account-list" className="grid gap-1 border-t border-primary/15 p-2">
          {accounts.map((account) => (
            <button
              key={account.email}
              type="button"
              onClick={() => fill(account.email)}
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-card/70"
            >
              <account.icon className="size-3.5 text-primary" aria-hidden />
              <span className="flex-1">
                <span className="block text-[0.74rem] font-bold">{account.label}</span>
                <span className="block font-mono text-[0.64rem] text-muted-foreground">
                  {account.email}
                </span>
              </span>
              <span className="text-[0.64rem] text-muted-foreground">{account.name}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
