import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  Eye,
  Fingerprint,
  History,
  KeyRound,
  ListChecks,
  PackageCheck,
  Scale,
  ShieldCheck,
} from "lucide-react";
import { getDb } from "@/lib/db";
import { searchPublicResources } from "@/lib/resources";
import { DEMO_PASSWORD } from "@/lib/domain";
import { buttonStyles } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ResourceCard } from "@/components/resources/resource-card";
import { SectionHeading } from "@/components/ui/page";

export const metadata: Metadata = {
  title: "LabLoop — Unlock resources. Accelerate innovation.",
  description:
    "A trusted campus resource-sharing platform for underused equipment, workspaces and technical resources. Eligibility-aware requests, human review, custody tracking and an append-only audit trail.",
};

const lifecycle = [
  {
    step: "01",
    title: "Publish a verified listing",
    body: "An owner or lab manager publishes location, hours, usage rules, condition notes and the exact credentials a member must hold.",
    icon: BadgeCheck,
  },
  {
    step: "02",
    title: "Discover with context",
    body: "Members search by category, read every rule, and see which requirements they already satisfy before requesting a slot.",
    icon: Eye,
  },
  {
    step: "03",
    title: "Request with eligibility checks",
    body: "A deterministic engine checks membership, verified training, lab hours, duration limits, fairness caps and schedule conflicts.",
    icon: ListChecks,
  },
  {
    step: "04",
    title: "Human review, not autopilot",
    body: "The owner approves, declines or waitlists with a written reason. Competing requests are surfaced, never silently double-booked.",
    icon: Scale,
  },
  {
    step: "05",
    title: "Custody with evidence",
    body: "Check-in records the initial condition and rule acknowledgement. Return records the final condition. The owner confirms the hand-back.",
    icon: PackageCheck,
  },
  {
    step: "06",
    title: "A history that holds up",
    body: "Every request, decision, custody change and incident resolution is appended to an immutable timeline and organization audit log.",
    icon: History,
  },
];

const safeguards = [
  {
    icon: Fingerprint,
    title: "Verified, not self-declared",
    body: "Training and lab badges are verified by an authorized reviewer. A self-claimed credential never satisfies a requirement.",
  },
  {
    icon: KeyRound,
    title: "Server-enforced authorization",
    body: "Role checks run on every mutation. A borrower cannot approve their own request or edit another member's records.",
  },
  {
    icon: CalendarClock,
    title: "Atomic conflict prevention",
    body: "Overlapping approved custody is rejected by a database trigger as well as the scheduler, so two people can never hold one machine.",
  },
  {
    icon: ShieldCheck,
    title: "Human oversight by design",
    body: "Incident reports never trigger automatic penalties. A reviewer records the outcome in writing, and the member is notified.",
  },
];

export default function LandingPage() {
  const db = getDb();
  const featured = searchPublicResources(db).slice(0, 3);

  return (
    <>
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 grid-paper opacity-70" aria-hidden />
        <div className="absolute -right-32 top-10 size-[420px] rounded-full border border-primary/10" aria-hidden />
        <div className="absolute -right-20 top-24 size-[300px] rounded-full border border-primary/10" aria-hidden />
        <div className="relative mx-auto grid max-w-7xl gap-14 px-5 pb-20 pt-16 sm:px-8 sm:pt-20 lg:grid-cols-[1.08fr_0.92fr] lg:items-center lg:pb-24">
          <div className="animate-rise">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="primary" dot>
                Campus resource sharing
              </Badge>
              <span className="specimen-code">Northstar Institute · demo workspace</span>
            </div>
            <h1 className="display-title mt-7 max-w-[13ch] text-[3.1rem] sm:text-[4.4rem] lg:text-[5rem]">
              The equipment is already here.
              <br />
              <em className="text-primary">Put it to work.</em>
            </h1>
            <p className="mt-6 max-w-xl text-[1.02rem] leading-[1.75] text-ink-soft">
              LabLoop turns underused printers, instruments, cameras and workspaces into a
              trusted shared resource — with verified eligibility, human-reviewed access,
              custody records and an audit trail that survives the semester.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/resources" className={buttonStyles({ size: "lg" })}>
                Explore the catalog <ArrowRight className="size-4" />
              </Link>
              <Link
                href="/how-it-works"
                className={buttonStyles({ variant: "outline", size: "lg" })}
              >
                See the full lifecycle
              </Link>
            </div>
            <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4 border-t border-border pt-6">
              <div>
                <dt className="specimen-code">Listings</dt>
                <dd className="mt-1 text-2xl font-bold tracking-[-0.03em]">
                  {featured.length > 0 ? searchPublicResources(db).length : 0}
                </dd>
              </div>
              <div>
                <dt className="specimen-code">Verification</dt>
                <dd className="mt-1 text-sm font-bold leading-snug">Human-reviewed</dd>
              </div>
              <div>
                <dt className="specimen-code">Audit trail</dt>
                <dd className="mt-1 text-sm font-bold leading-snug">Append-only</dd>
              </div>
            </dl>
          </div>

          <div className="relative animate-rise animate-rise-delay-2">
            <div className="absolute -left-4 top-8 hidden rounded-xl border border-border bg-card px-3 py-2 shadow-lg sm:block">
              <p className="specimen-code">Custody</p>
              <p className="mt-0.5 text-xs font-bold">Checked in · 10:14</p>
            </div>
            <div className="rounded-3xl border border-border bg-card p-3 card-shadow">
              <div className="flex items-center justify-between border-b border-border px-2 pb-3 pt-1">
                <span className="specimen-code">Resource passport</span>
                <span className="specimen-code">NST-ADD-01</span>
              </div>
              <div className="rounded-2xl bg-gradient-to-br from-[#dcefe6] to-[#f1f7f2] p-5 dark:from-[#143129] dark:to-[#0f1b17]">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="specimen-code text-primary">3D printing</p>
                    <h2 className="mt-1.5 text-xl font-bold tracking-[-0.025em]">
                      Bambu Lab X1 Carbon
                    </h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Maker Wing · Room C-104 · Bay 2
                    </p>
                  </div>
                  <span className="flex size-11 items-center justify-center rounded-xl border border-primary/20 bg-card/70">
                    <BadgeCheck className="size-5 text-primary" />
                  </span>
                </div>
                <div className="mt-6 grid grid-cols-3 gap-2 text-center">
                  {["Owner verified", "Training held", "Slot clear"].map((label) => (
                    <div
                      key={label}
                      className="rounded-lg border border-primary/15 bg-card/60 px-1 py-2 text-[0.62rem] font-bold text-primary"
                    >
                      {label}
                    </div>
                  ))}
                </div>
              </div>
              <ol className="space-y-0 pt-4">
                {[
                  ["Request submitted", "Eligibility: 9 checks passed", true],
                  ["Owner approved", "Maya Iyer · written reason recorded", true],
                  ["Checked in", "Initial condition: good · rules acknowledged", true],
                  ["Return pending", "Final condition recorded by borrower", false],
                ].map(([title, detail, done], index) => (
                  <li key={String(title)} className="relative flex gap-3 px-2 pb-3.5 last:pb-1">
                    {index < 3 ? (
                      <span
                        className="absolute left-[15px] top-5 h-full w-px bg-border"
                        aria-hidden
                      />
                    ) : null}
                    <span
                      className={`relative z-10 mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border text-[0.6rem] font-bold ${
                        done
                          ? "border-success/30 bg-success-soft text-success"
                          : "border-border bg-muted text-muted-foreground"
                      }`}
                    >
                      {done ? "✓" : index + 1}
                    </span>
                    <div>
                      <p className="text-[0.78rem] font-bold leading-tight">{title}</p>
                      <p className="mt-0.5 text-[0.68rem] text-muted-foreground">{detail}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
            <div className="absolute -bottom-5 -right-2 hidden rounded-xl border border-border bg-card px-3 py-2 shadow-lg sm:block">
              <p className="specimen-code">Audit event</p>
              <p className="mt-0.5 text-xs font-bold">Appended · immutable</p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-card/40">
        <div className="mx-auto grid max-w-7xl grid-cols-2 divide-x divide-border px-5 sm:px-8 md:grid-cols-4">
          {[
            [Fingerprint, "Verified owners"],
            [Scale, "Fair-use limits"],
            [PackageCheck, "Two-way custody"],
            [History, "Append-only audit"],
          ].map(([Icon, label]) => {
            const Component = Icon as typeof Fingerprint;
            return (
              <div key={String(label)} className="flex items-center gap-2.5 px-3 py-5 first:pl-0">
                <Component className="size-4 shrink-0 text-primary" aria-hidden />
                <span className="text-[0.74rem] font-bold sm:text-[0.8rem]">{String(label)}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24">
        <SectionHeading
          eyebrow="The loop"
          title="A full sharing lifecycle — not a booking form with a calendar."
          description="Each step produces a persistent record. Judges can run the entire loop from listing to confirmed return, then inspect the timeline from both sides."
        />
        <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {lifecycle.map((item) => (
            <article key={item.step} className="bg-card p-6">
              <div className="flex items-center justify-between">
                <span className="flex size-10 items-center justify-center rounded-xl border border-border bg-muted/40">
                  <item.icon className="size-[18px] text-primary" aria-hidden />
                </span>
                <span className="specimen-code">{item.step}</span>
              </div>
              <h3 className="mt-4 text-[0.98rem] font-bold tracking-[-0.015em]">{item.title}</h3>
              <p className="mt-2 text-[0.82rem] leading-relaxed text-muted-foreground">{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-card/40">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:py-24">
          <div>
            <p className="eyebrow">Trust architecture</p>
            <h2 className="display-title mt-4 text-[2.4rem] sm:text-[3rem]">
              Access decisions that can be <em>explained.</em>
            </h2>
            <p className="mt-5 max-w-md text-[0.92rem] leading-[1.8] text-ink-soft">
              Every gate is deterministic and every exception is human. LabLoop never hides an
              access decision behind an opaque score — the borrower sees exactly which requirement
              is missing, and the reviewer sees exactly why a slot conflicts.
            </p>
            <Link
              href="/how-it-works#fairness"
              className={buttonStyles({ variant: "outline", className: "mt-6" })}
            >
              Read the fairness policy <ArrowRight className="size-3.5" />
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {safeguards.map((item) => (
              <div key={item.title} className="rounded-2xl border border-border bg-card p-5">
                <item.icon className="size-5 text-primary" aria-hidden />
                <h3 className="mt-3 text-[0.9rem] font-bold">{item.title}</h3>
                <p className="mt-1.5 text-[0.78rem] leading-relaxed text-muted-foreground">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <SectionHeading
            eyebrow="Available now"
            title="Real listings from the demo workspace."
            description="These are live rows in the persistent database — not screenshots. Open one to read its rules and check your eligibility."
          />
          <Link href="/resources" className={buttonStyles({ variant: "outline" })}>
            View all resources <ArrowRight className="size-3.5" />
          </Link>
        </div>
        <div className="mt-9 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((resource, index) => (
            <ResourceCard key={resource.id} resource={resource} index={index} />
          ))}
        </div>
      </section>

      <section className="border-t border-border bg-primary text-primary-foreground">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] opacity-70">
              Judge walkthrough
            </p>
            <h2 className="display-title mt-4 text-[2.3rem] sm:text-[3.1rem]">
              Try the whole loop in under five minutes.
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-[1.8] opacity-80">
              Sign in as the demo student, request an eligible slot, then switch to the owner
              account to review, approve and confirm the return. No pre-filled success states —
              every screen reads from the database.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/login"
                className={buttonStyles({
                  variant: "secondary",
                  size: "lg",
                  className: "border-transparent bg-background text-foreground hover:bg-background/90",
                })}
              >
                Open the demo <ArrowRight className="size-4" />
              </Link>
              <Link
                href="/how-it-works#demo"
                className={buttonStyles({
                  variant: "ghost",
                  size: "lg",
                  className: "border border-primary-foreground/25 text-primary-foreground hover:bg-primary-foreground/10",
                })}
              >
                Demo credentials
              </Link>
            </div>
          </div>
          <div className="rounded-2xl border border-primary-foreground/20 bg-black/10 p-5 font-mono text-[0.72rem] leading-relaxed">
            <p className="text-[0.6rem] uppercase tracking-[0.16em] opacity-60">Demo accounts</p>
            <div className="mt-3 space-y-3">
              <div>
                <p className="font-bold">Student</p>
                <p className="opacity-80">student@labloop.demo</p>
              </div>
              <div>
                <p className="font-bold">Resource owner</p>
                <p className="opacity-80">owner@labloop.demo</p>
              </div>
              <div>
                <p className="font-bold">Lab manager</p>
                <p className="opacity-80">manager@labloop.demo</p>
              </div>
              <div className="border-t border-primary-foreground/15 pt-3">
                <p className="text-[0.6rem] uppercase tracking-[0.16em] opacity-60">
                  Shared password
                </p>
                <p className="mt-1 font-bold select-all">{DEMO_PASSWORD}</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
