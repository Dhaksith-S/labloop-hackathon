import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { GraduationCap, ShieldCheck } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { signupAction } from "@/lib/actions/auth";
import { ActionForm } from "@/components/forms/action-form";
import { Field, Input } from "@/components/ui/fields";
import { Alert } from "@/components/ui/feedback";

export const metadata: Metadata = { title: "Create an account" };

export default async function SignupPage() {
  const user = await getSessionUser();
  if (user) redirect("/dashboard");

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-10 lg:grid-cols-[0.85fr_1fr] lg:items-center">
      <div className="hidden lg:block">
        <span className="flex size-11 items-center justify-center rounded-2xl border border-border bg-card">
          <GraduationCap className="size-5 text-primary" aria-hidden />
        </span>
        <h1 className="display-title mt-6 text-[3rem]">
          Join the loop.
          <br />
          <em>Borrow better.</em>
        </h1>
        <p className="mt-5 max-w-md text-[0.9rem] leading-[1.8] text-ink-soft">
          A new account joins the fictional Northstar Institute as a student member. You can browse
          immediately, but access to restricted equipment still requires verified training.
        </p>
        <div className="mt-8 space-y-3">
          {[
            "Request resources you are qualified for",
            "Track every decision and custody change",
            "Report incidents without automatic penalties",
          ].map((item) => (
            <div key={item} className="flex items-center gap-2 text-[0.82rem] font-medium">
              <ShieldCheck className="size-4 shrink-0 text-success" aria-hidden />
              {item}
            </div>
          ))}
        </div>
        <Alert tone="info" className="mt-8">
          This is a hackathon demonstration. Accounts are stored in the local demo database and
          are not connected to any real identity provider.
        </Alert>
      </div>

      <div className="mx-auto w-full max-w-md rounded-2xl border border-border bg-card p-6 card-shadow sm:p-7">
        <h2 className="text-lg font-bold tracking-[-0.02em]">Create a member account</h2>
        <p className="mt-1 text-[0.78rem] text-muted-foreground">
          Joins: Northstar Institute of Applied Technology
        </p>
        <div className="mt-5">
          <ActionForm
            action={signupAction}
            submitLabel="Create account"
            pendingLabel="Creating account…"
            className="space-y-4"
          >
            <Field label="Full name" htmlFor="fullName">
              <Input
                id="fullName"
                name="fullName"
                autoComplete="name"
                required
                minLength={2}
                maxLength={80}
                placeholder="Your name"
              />
            </Field>
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
            <Field
              label="Password"
              htmlFor="password"
              hint="At least 10 characters, including a letter and a number."
            >
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={10}
                placeholder="Choose a strong password"
              />
            </Field>
            <Field label="Headline" htmlFor="headline" optional hint="Shown to reviewers.">
              <Input
                id="headline"
                name="headline"
                maxLength={120}
                placeholder="e.g. Robotics capstone student"
              />
            </Field>
            <p className="text-[0.68rem] leading-relaxed text-muted-foreground">
              By creating an account you agree to follow the lab usage rules shown on each
              resource. New accounts hold no verified credentials.
            </p>
          </ActionForm>
        </div>
        <p className="mt-5 text-center text-[0.78rem] text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-bold text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
