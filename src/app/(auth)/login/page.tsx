import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, KeyRound, ShieldCheck } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { loginAction } from "@/lib/actions/auth";
import { ActionForm } from "@/components/forms/action-form";
import { DemoAccountPicker } from "@/components/forms/demo-account-picker";
import { Field, Input } from "@/components/ui/fields";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; registered?: string }>;
}) {
  const user = await getSessionUser();
  if (user) redirect("/dashboard");
  const params = await searchParams;
  const next = params.next?.startsWith("/") ? params.next : "/dashboard";

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-10 lg:grid-cols-[0.9fr_1fr] lg:items-center">
      <div className="hidden lg:block">
        <Badge tone="primary" dot>
          Trusted campus sharing
        </Badge>
        <h1 className="display-title mt-6 text-[3rem]">
          Pick up the thread.
          <br />
          <em>Return it safely.</em>
        </h1>
        <p className="mt-5 max-w-md text-[0.9rem] leading-[1.8] text-ink-soft">
          Sign in to request eligible equipment, track custody, submit condition reports and
          review incoming requests as a resource owner.
        </p>
        <ol className="mt-8 space-y-4 border-l border-border pl-5">
          {[
            ["Eligibility is checked before submission", "No surprise rejections for missing training."],
            ["A person reviews every request", "Decisions and reasons are recorded."],
            ["Custody is evidenced at both ends", "Initial and final condition reports are immutable."],
          ].map(([title, detail], index) => (
            <li key={String(title)} className="relative">
              <span className="absolute -left-[27px] top-0.5 flex size-3.5 items-center justify-center rounded-full border border-primary/30 bg-primary-soft font-mono text-[0.45rem] font-bold text-primary">
                {index + 1}
              </span>
              <p className="text-[0.84rem] font-bold">{title}</p>
              <p className="mt-0.5 text-[0.76rem] leading-relaxed text-muted-foreground">{detail}</p>
            </li>
          ))}
        </ol>
        <div className="mt-8 flex items-center gap-2 rounded-xl border border-border bg-card/70 p-3">
          <ShieldCheck className="size-4 shrink-0 text-primary" aria-hidden />
          <p className="text-[0.7rem] leading-relaxed text-muted-foreground">
            Demo accounts are isolated to the fictional Northstar workspace. No real institution
            data is present.
          </p>
        </div>
      </div>

      <div className="mx-auto w-full max-w-md rounded-2xl border border-border bg-card p-6 card-shadow sm:p-7">
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-xl border border-border bg-muted/50">
            <KeyRound className="size-4 text-primary" aria-hidden />
          </span>
          <div>
            <h2 className="text-lg font-bold tracking-[-0.02em]">Sign in to LabLoop</h2>
            <p className="text-[0.72rem] text-muted-foreground">Continue to your workspace</p>
          </div>
        </div>

        {params.registered ? (
          <p className="mt-4 rounded-xl border border-success/25 bg-success-soft px-3 py-2 text-[0.76rem] font-medium text-success">
            Account created. Sign in to continue.
          </p>
        ) : null}

        <div className="mt-5">
          <DemoAccountPicker />
        </div>

        <div className="my-5 flex items-center gap-3">
          <span className="h-px flex-1 bg-border" />
          <span className="text-[0.64rem] font-bold uppercase tracking-[0.12em] text-muted-foreground">
            or enter details
          </span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <ActionForm action={loginAction} submitLabel="Sign in" pendingLabel="Signing in…" className="space-y-4">
          <input type="hidden" name="next" value={next} />
          <Field label="Email address" htmlFor="email">
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@northstar.demo"
            />
          </Field>
          <Field label="Password" htmlFor="password">
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="Your password"
            />
          </Field>
          <button type="submit" hidden aria-hidden tabIndex={-1} />
        </ActionForm>

        <p className="mt-5 text-center text-[0.78rem] text-muted-foreground">
          New to the demo?{" "}
          <Link href="/signup" className="font-bold text-primary hover:underline">
            Create a member account
          </Link>
        </p>
        <p className="mt-3 text-center text-[0.68rem] leading-relaxed text-muted-foreground">
          Public demo password:{" "}
          <span className="font-mono font-semibold select-all">LabLoop!2026</span>
          <br />
          Sign in as different roles to see both sides of the loop.
        </p>
      </div>

      <div className="lg:hidden">
        <Link
          href="/resources"
          className="inline-flex items-center gap-1.5 text-[0.78rem] font-semibold text-primary"
        >
          Browse resources without signing in <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </div>
  );
}
