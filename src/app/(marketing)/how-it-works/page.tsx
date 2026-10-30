import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Fingerprint,
  History,
  ListChecks,
  PackageCheck,
  Scale,
  ShieldAlert,
  UserCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/page";
import { DEMO_PASSWORD } from "@/lib/domain";

export const metadata: Metadata = {
  title: "How LabLoop works",
  description:
    "The complete LabLoop resource-sharing lifecycle: verified listing, eligibility-aware request, human review, custody, condition reports, incidents and audit history.",
};

const stages = [
  {
    number: "01",
    icon: BadgeCheck,
    title: "A verified owner publishes the resource",
    body: "The owner records category, location, description, weekly availability, maximum booking duration, fair-use limit, usage rules, current condition and explicit access requirements. Ownership is tied to a real organization membership, never to a free-text field.",
    outputs: ["Listing record", "Availability windows", "Requirement records", "Audit event"],
  },
  {
    number: "02",
    icon: Fingerprint,
    title: "The member sees their true standing",
    body: "Resource pages show every requirement with a pass, fail or advisory state. Training is only satisfied by a qualification an authorized reviewer has verified. Self-declared training never satisfies a gate.",
    outputs: ["Requirement standing", "Rules acknowledgement", "Transparent availability"],
  },
  {
    number: "03",
    icon: ListChecks,
    title: "The request is checked deterministically",
    body: "Before any row is written, LabLoop evaluates active membership, verified credentials, future start time, duration cap, published lab hours, blackouts, approved reservations, the borrower's other bookings and the per-resource fair-use cap. Every failure is returned with a human-readable explanation.",
    outputs: ["Eligibility report", "Blocking reasons", "Fair-use position"],
  },
  {
    number: "04",
    icon: Scale,
    title: "The owner decides — in writing",
    body: "The reviewer sees the requester, purpose, eligibility report, competing requests and the borrower's fair-use position. Approval, rejection and waitlisting each store the authorized actor, timestamp and reason. A borrower can never approve their own request.",
    outputs: ["Decision record", "Written reason", "Notification", "Audit event"],
  },
  {
    number: "05",
    icon: PackageCheck,
    title: "Custody changes hands twice",
    body: "Check-in is only possible inside the booking window and records the initial condition, accessory status and rules acknowledgement. Return records the final condition from the borrower. The owner then confirms the hand-back before the booking can complete.",
    outputs: ["Initial condition report", "Final condition report", "Custody timeline"],
  },
  {
    number: "06",
    icon: ShieldAlert,
    title: "Incidents stay human",
    body: "Damage, missing accessories, late returns and access conflicts can be reported by participants. A report never applies an automatic penalty. A reviewer moves it through open, reviewing and resolved or dismissed, with a written outcome.",
    outputs: ["Incident record", "Reviewer decision", "Member notification"],
  },
  {
    number: "07",
    icon: History,
    title: "The record is append-only",
    body: "Booking timelines and organization audit events are protected by database triggers that reject updates and deletes from the application path. Both sides of a transaction can read the history they are entitled to see.",
    outputs: ["Immutable booking events", "Organization audit log", "Exportable history"],
  },
];

const fairnessRules = [
  {
    title: "Per-resource reservation cap",
    body: "A member may hold at most the resource's configured number of active (pending, waitlisted or approved) future requests. The default demo cap is two; the high-demand camera and robot cell use one.",
  },
  {
    title: "Duration cap",
    body: "Every resource defines a maximum booking length between one and twenty-four hours. Requests longer than the cap fail before they reach the owner.",
  },
  {
    title: "No duplicate custody",
    body: "Approved, checked-in and return-pending bookings are treated as custody-bearing. Overlap is rejected by a SQLite trigger inside the same transaction as the approval, not only by a UI check.",
  },
  {
    title: "Waitlist is a queue, not an approval",
    body: "Waitlisted requests are ordered by submission time. When an approved booking is cancelled, the earliest waitlisted request that still passes eligibility returns to owner review. It is never auto-approved.",
  },
  {
    title: "Owner exceptions are visible",
    body: "An owner can decline or waitlist any request with a written reason. The reason is stored, shown to the borrower and appended to the audit log. There is no hidden override.",
  },
  {
    title: "No opaque scoring",
    body: "LabLoop does not rank people with a proprietary score. The only ordering is the honest one: eligibility gates, explicit caps and first-come waitlist order.",
  },
];

export default function HowItWorksPage() {
  return (
    <>
      <section className="border-b border-border">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
          <Badge tone="primary" dot>
            Product walkthrough
          </Badge>
          <h1 className="display-title mt-6 max-w-3xl text-[2.9rem] sm:text-[4rem]">
            Sharing is easy. <em>Trust is the hard part.</em>
          </h1>
          <p className="mt-5 max-w-2xl text-[1rem] leading-[1.8] text-ink-soft">
            LabLoop is built around a complete custody loop. Every stage below writes a real
            record, enforces a real permission and leaves evidence a lab manager can defend.
          </p>
          <div className="mt-7 flex flex-wrap gap-2">
            <Link href="/resources" className={buttonStyles()}>
              Browse resources <ArrowRight className="size-4" />
            </Link>
            <Link href="#demo" className={buttonStyles({ variant: "outline" })}>
              Judge walkthrough
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
        <div className="space-y-5">
          {stages.map((stage) => (
            <article
              key={stage.number}
              className="grid gap-5 rounded-2xl border border-border bg-card p-5 sm:p-7 lg:grid-cols-[72px_1fr_260px]"
            >
              <div>
                <span className="font-mono text-[0.7rem] font-bold tracking-[0.14em] text-primary">
                  {stage.number}
                </span>
                <span className="mt-3 flex size-11 items-center justify-center rounded-xl border border-border bg-muted/40">
                  <stage.icon className="size-5 text-primary" aria-hidden />
                </span>
              </div>
              <div>
                <h2 className="text-lg font-bold tracking-[-0.02em]">{stage.title}</h2>
                <p className="mt-2 max-w-2xl text-[0.88rem] leading-[1.8] text-muted-foreground">
                  {stage.body}
                </p>
              </div>
              <div className="rounded-xl border border-dashed border-border bg-muted/30 p-4">
                <p className="specimen-code">Records produced</p>
                <ul className="mt-2.5 space-y-1.5">
                  {stage.outputs.map((output) => (
                    <li key={output} className="flex items-start gap-1.5 text-[0.74rem] font-medium">
                      <CheckCircle2 className="mt-0.5 size-3 shrink-0 text-success" aria-hidden />
                      {output}
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="fairness" className="scroll-mt-20 border-y border-border bg-card/40">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
          <SectionHeading
            eyebrow="Fair access policy"
            title="Six transparent rules. No hidden ranking."
            description="The demo policy is deliberately simple, documented and enforceable. Owners can tighten limits per resource; the engine applies the same rules to everyone."
          />
          <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {fairnessRules.map((rule, index) => (
              <div key={rule.title} className="rounded-2xl border border-border bg-card p-5">
                <span className="specimen-code">Rule {String(index + 1).padStart(2, "0")}</span>
                <h3 className="mt-2 text-[0.95rem] font-bold">{rule.title}</h3>
                <p className="mt-2 text-[0.8rem] leading-relaxed text-muted-foreground">{rule.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 rounded-2xl border border-info/20 bg-info-soft p-5 text-info">
            <p className="flex items-center gap-2 text-sm font-bold">
              <Scale className="size-4" aria-hidden /> Waitlist example
            </p>
            <p className="mt-2 max-w-3xl text-[0.84rem] leading-relaxed">
              Priya requests the Bambu printer for the same window already approved for Dev. The
              owner waitlists Priya with the conflicting window named in the reason. If Dev
              cancels, the system re-checks Priya&apos;s eligibility — membership, training, hours,
              conflicts, fair-use — and only then returns her request to the owner&apos;s queue. The
              borrower receives a notification; approval is still a human decision.
            </p>
          </div>
        </div>
      </section>

      <section id="safeguards" className="scroll-mt-20 mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
        <SectionHeading
          eyebrow="Security & accountability"
          title="The boring guarantees that make sharing safe."
        />
        <div className="mt-9 grid gap-4 md:grid-cols-3">
          {[
            {
              icon: UserCheck,
              title: "Role-aware by default",
              body: "Students, owners, managers and administrators each get a different permission surface. Authorization is re-derived on the server for every mutation.",
            },
            {
              icon: CalendarClock,
              title: "Conflict handling is atomic",
              body: "An approval transaction checks overlap and writes the status under an immediate lock. A database trigger provides a second, independent guard.",
            },
            {
              icon: ClipboardCheck,
              title: "Human review is recorded",
              body: "Decisions, incident outcomes and qualification verification all require an authorized actor and a human-written explanation.",
            },
          ].map((item) => (
            <div key={item.title} className="rounded-2xl border border-border bg-card p-5">
              <item.icon className="size-5 text-primary" aria-hidden />
              <h3 className="mt-3 text-sm font-bold">{item.title}</h3>
              <p className="mt-1.5 text-[0.8rem] leading-relaxed text-muted-foreground">{item.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-8 rounded-2xl border border-border bg-card p-5">
          <p className="text-sm font-bold">What is intentionally not automated</p>
          <p className="mt-2 max-w-4xl text-[0.84rem] leading-relaxed text-muted-foreground">
            LabLoop does not automatically penalise members from an incident report, does not
            automatically approve waitlisted requests, does not infer training from a self-declared
            profile field, and does not use an AI model to make access, safety or disciplinary
            decisions. Any future AI capability must remain advisory and human-reviewable.
          </p>
        </div>
      </section>

      <section id="demo" className="scroll-mt-20 border-t border-border bg-primary text-primary-foreground">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] opacity-70">
            Demo credentials
          </p>
          <h2 className="display-title mt-4 text-[2.4rem] sm:text-[3.2rem]">
            Run the full loop yourself.
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-[1.8] opacity-80">
            All accounts below belong to the fictional Northstar Institute of Applied Technology.
            Use the same password for each; the role determines what you can do. Demo accounts have
            no administrative reach outside the demo organization.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              ["Student", "Arjun Mehta", "student@labloop.demo", "Request, check in, return, report"],
              ["Resource owner", "Maya Iyer", "owner@labloop.demo", "Review, approve, custody, incidents"],
              ["Lab manager", "Riya Sen", "manager@labloop.demo", "Organization overview, credentials"],
            ].map(([role, name, email, scope]) => (
              <div
                key={email}
                className="rounded-2xl border border-primary-foreground/20 bg-black/10 p-5"
              >
                <p className="text-[0.6rem] uppercase tracking-[0.16em] opacity-60">{role}</p>
                <p className="mt-1.5 text-sm font-bold">{name}</p>
                <p className="mt-0.5 font-mono text-[0.72rem] opacity-85 select-all">{email}</p>
                <p className="mt-3 border-t border-primary-foreground/15 pt-3 text-[0.72rem] opacity-70">
                  {scope}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-4">
            <span className="rounded-lg border border-primary-foreground/25 bg-black/10 px-3 py-2 font-mono text-sm font-bold select-all">
              {DEMO_PASSWORD}
            </span>
            <Link
              href="/login"
              className={buttonStyles({
                variant: "secondary",
                className: "border-transparent bg-background text-foreground hover:bg-background/90",
              })}
            >
              Sign in <ArrowRight className="size-4" />
            </Link>
          </div>
          <p className="mt-5 max-w-2xl text-[0.72rem] leading-relaxed opacity-60">
            The seed script is idempotent: it only creates data when the database has no profiles.
            A judge can submit a brand-new request without destroying the prepared examples.
          </p>
        </div>
      </section>
    </>
  );
}
