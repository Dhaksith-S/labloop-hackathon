import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, Clock3, GraduationCap, IdCard, ShieldCheck, UserRound } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { listUserQualifications } from "@/lib/qualifications";
import { listBookingsForBorrower } from "@/lib/bookings";
import { ROLE_LABELS } from "@/lib/domain";
import { formatDate, formatRelative } from "@/lib/time";
import { PageHeader } from "@/components/ui/page";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";

export const metadata: Metadata = { title: "Profile & credentials" };

const QUALIFICATION_TONES = {
  verified: "success",
  pending: "warning",
  expired: "danger",
  revoked: "neutral",
} as const;

export default async function ProfilePage() {
  const user = await requireUser("/profile");
  const membership = user.memberships[0];
  const db = getDb();
  const qualifications = membership
    ? listUserQualifications(db, user.id, membership.organizationId)
    : [];
  const verified = qualifications.filter((qualification) => qualification.status === "verified");
  const pending = qualifications.filter((qualification) => qualification.status === "pending");
  const bookings = listBookingsForBorrower(db, user.id);
  const completed = bookings.filter((booking) => booking.status === "completed");
  const isManager = Boolean(
    membership && ["owner", "manager", "admin"].includes(membership.role),
  );

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Your account"
        title="Profile & credentials"
        description="Your membership role, verified training and booking history. Credentials are verified by a human reviewer; you cannot self-certify."
        actions={
          isManager ? (
            <Link href="/admin" className={buttonStyles({ variant: "outline" })}>
              Organization console
            </Link>
          ) : undefined
        }
      />

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <div className="space-y-5">
          <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
            <div className="flex items-center gap-4">
              <Avatar name={user.fullName} color={user.avatarColor} size="lg" />
              <div className="min-w-0">
                <h2 className="truncate text-lg font-bold tracking-[-0.02em]">{user.fullName}</h2>
                <p className="truncate text-[0.78rem] text-muted-foreground">{user.email}</p>
                {user.headline ? (
                  <p className="mt-0.5 text-[0.74rem] text-muted-foreground">{user.headline}</p>
                ) : null}
              </div>
            </div>
            <dl className="mt-5 space-y-3 border-t border-border pt-4">
              <div className="flex items-start justify-between gap-3">
                <dt className="flex items-center gap-1.5 text-[0.74rem] text-muted-foreground">
                  <IdCard className="size-3.5" aria-hidden /> Organization
                </dt>
                <dd className="text-right text-[0.78rem] font-semibold">
                  {membership?.organizationName ?? "No membership"}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="flex items-center gap-1.5 text-[0.74rem] text-muted-foreground">
                  <ShieldCheck className="size-3.5" aria-hidden /> Role
                </dt>
                <dd className="text-right">
                  <Badge tone={membership?.role === "student" ? "outline" : "primary"}>
                    {membership ? ROLE_LABELS[membership.role] : "None"}
                  </Badge>
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="flex items-center gap-1.5 text-[0.74rem] text-muted-foreground">
                  <Clock3 className="size-3.5" aria-hidden /> Timezone
                </dt>
                <dd className="text-right text-[0.78rem] font-semibold">
                  {membership?.timezone ?? "—"}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="flex items-center gap-1.5 text-[0.74rem] text-muted-foreground">
                  <GraduationCap className="size-3.5" aria-hidden /> Completed bookings
                </dt>
                <dd className="text-right text-[0.78rem] font-semibold">{completed.length}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-2xl border border-border bg-card p-5">
            <p className="eyebrow">What a verified credential means</p>
            <p className="mt-2 text-[0.78rem] leading-relaxed text-muted-foreground">
              A qualification satisfies a resource requirement only when an authorized manager or
              administrator has verified it and it has not expired. The eligibility engine matches
              the requirement label to the credential name exactly.
            </p>
            {!isManager ? (
              <div className="mt-3 rounded-xl border border-dashed border-border p-3 text-[0.72rem] leading-relaxed text-muted-foreground">
                Need a training record verified? Ask a lab manager in person. This demo does not
                include an email workflow, so verification happens through the organization console.
              </div>
            ) : null}
          </section>
        </div>

        <div className="space-y-5">
          <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-2">
              <BadgeCheck className="size-4 text-primary" aria-hidden />
              <h2 className="text-[0.98rem] font-bold">Credentials on file</h2>
              <Badge tone="outline" className="ml-auto">
                {qualifications.length}
              </Badge>
            </div>
            {qualifications.length === 0 ? (
              <p className="mt-3 rounded-xl border border-dashed border-border bg-muted/25 px-4 py-6 text-center text-[0.78rem] text-muted-foreground">
                No credential records yet. Requirements that need verified training will remain
                blocked until a manager records and verifies them.
              </p>
            ) : (
              <ul className="mt-4 space-y-2">
                {qualifications.map((qualification) => (
                  <li key={qualification.id} className="rounded-xl border border-border bg-muted/20 p-3.5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-[0.82rem] font-bold">{qualification.name}</p>
                        <p className="mt-0.5 text-[0.68rem] text-muted-foreground capitalize">
                          {qualification.kind.replaceAll("_", " ")}
                        </p>
                      </div>
                      <Badge tone={QUALIFICATION_TONES[qualification.status]} dot>
                        {qualification.status}
                      </Badge>
                    </div>
                    {qualification.notes ? (
                      <p className="mt-2 text-[0.72rem] leading-relaxed text-muted-foreground">
                        {qualification.notes}
                      </p>
                    ) : null}
                    <p className="mt-1.5 text-[0.64rem] text-muted-foreground">
                      Added {formatRelative(qualification.created_at)}
                      {qualification.verified_at
                        ? ` · verified ${formatDate(qualification.verified_at)}`
                        : ""}
                      {qualification.expires_at
                        ? ` · expires ${formatDate(qualification.expires_at)}`
                        : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-2">
              <UserRound className="size-4 text-primary" aria-hidden />
              <h2 className="text-[0.95rem] font-bold">Borrower record</h2>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              {[
                ["Active", bookings.filter((booking) => ["pending", "waitlisted", "approved"].includes(booking.status)).length],
                ["In custody", bookings.filter((booking) => ["checked_in", "return_submitted"].includes(booking.status)).length],
                ["Completed", completed.length],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-lg border border-border bg-muted/25 px-2 py-3">
                  <p className="text-xl font-bold tracking-[-0.03em]">{value}</p>
                  <p className="mt-0.5 text-[0.64rem] text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[0.7rem] leading-relaxed text-muted-foreground">
              Verified: {verified.length} · Pending: {pending.length}. A pending credential is not
              accepted by the eligibility engine, even if the training has already taken place.
            </p>
            <Link href="/bookings" className={buttonStyles({ variant: "outline", size: "sm", className: "mt-3 w-full" })}>
              Open my bookings
            </Link>
          </section>
        </div>
      </div>

      <Alert tone="info" title="Demo privacy note">
        This account exists only in the local demonstration database. The email address is fictional
        and no password-reset, email or identity-provider integration is connected.
      </Alert>
    </div>
  );
}
