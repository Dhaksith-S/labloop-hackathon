import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Boxes, CalendarClock, ShieldCheck } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createResourceAction } from "@/lib/actions/resources";
import { CATEGORY_LABELS, RESOURCE_CATEGORIES } from "@/lib/domain";
import { ActionForm } from "@/components/forms/action-form";
import { Field, Input, Select, Textarea } from "@/components/ui/fields";
import { Alert } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page";
import { buttonStyles } from "@/components/ui/button";
import { WEEKDAY_LONG_LABELS } from "@/lib/time";

export const metadata: Metadata = { title: "New listing" };

export default async function NewOwnerResourcePage() {
  const user = await requireUser("/owner/resources/new");
  const membership = user.memberships.find(
    (entry) => entry.status === "active" && ["owner", "manager", "admin"].includes(entry.role),
  );
  if (!membership) redirect("/dashboard");

  return (
    <div className="space-y-6">
      <Link
        href="/owner/resources"
        className="inline-flex items-center gap-1.5 text-[0.78rem] font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Listings
      </Link>

      <PageHeader
        eyebrow={`${membership.organizationName} · new listing`}
        title="Publish a resource"
        description="List something the institution already owns and is willing to share. You can refine requirements, availability and blackout windows after the first save."
        actions={
          <Link href="/resources" className={buttonStyles({ variant: "outline" })}>
            Preview catalog
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_330px] lg:items-start">
        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
          <ActionForm
            action={createResourceAction}
            submitLabel="Publish listing"
            pendingLabel="Publishing…"
            submitSize="lg"
            className="space-y-6"
          >
            <input type="hidden" name="organizationId" value={membership.organizationId} />

            <section className="space-y-4">
              <div className="flex items-center gap-2 border-b border-border pb-2">
                <Boxes className="size-4 text-primary" aria-hidden />
                <h2 className="text-[0.92rem] font-bold">1. What is it?</h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-[1.4fr_1fr]">
                <Field label="Resource name" htmlFor="name">
                  <Input
                    id="name"
                    name="name"
                    required
                    minLength={3}
                    maxLength={100}
                    placeholder="e.g. Formlabs Form 3 resin printer"
                  />
                </Field>
                <Field label="Category" htmlFor="category">
                  <Select id="category" name="category" defaultValue="3d-printing" required>
                    {RESOURCE_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {CATEGORY_LABELS[category]}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <Field label="Description" htmlFor="description" hint="What it does, who it is for and what makes it useful.">
                <Textarea
                  id="description"
                  name="description"
                  required
                  minLength={20}
                  maxLength={2000}
                  placeholder="Describe the capability, model, accessories and any setup constraints."
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Location" htmlFor="location" hint="Building, room and bay.">
                  <Input
                    id="location"
                    name="location"
                    required
                    maxLength={140}
                    placeholder="Maker Wing · Room C-104 · Bay 2"
                  />
                </Field>
                <Field label="Current condition" htmlFor="conditionSummary">
                  <Input
                    id="conditionSummary"
                    name="conditionSummary"
                    required
                    minLength={5}
                    maxLength={600}
                    placeholder="Working, recently serviced, minor cosmetic wear"
                  />
                </Field>
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex items-center gap-2 border-b border-border pb-2">
                <ShieldCheck className="size-4 text-primary" aria-hidden />
                <h2 className="text-[0.92rem] font-bold">2. Access requirements & rules</h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Maximum hours per booking" htmlFor="maxDurationHours">
                  <Input
                    id="maxDurationHours"
                    name="maxDurationHours"
                    type="number"
                    min={1}
                    max={24}
                    defaultValue={2}
                    required
                  />
                </Field>
                <Field label="Fair-use cap" htmlFor="fairUseLimit" hint="Active requests a member may hold at once.">
                  <Input
                    id="fairUseLimit"
                    name="fairUseLimit"
                    type="number"
                    min={1}
                    max={10}
                    defaultValue={2}
                    required
                  />
                </Field>
              </div>
              <Field label="Usage rules" htmlFor="usageRules" hint="One rule per line. Members must acknowledge these before requesting.">
                <Textarea
                  id="usageRules"
                  name="usageRules"
                  required
                  minLength={10}
                  maxLength={2000}
                  className="min-h-32"
                  placeholder={"Safety glasses required.\nReport any nozzle damage before the next booking.\nLeave the bay clean and the filament spool sealed."}
                />
              </Field>
              <Field
                label="Eligibility note"
                htmlFor="eligibilityNote"
                optional
                hint="Shown above the requirement list on the public page."
              >
                <Input
                  id="eligibilityNote"
                  name="eligibilityNote"
                  maxLength={600}
                  placeholder="Training is verified in person at the Maker Wing front desk."
                />
              </Field>
              <div className="rounded-xl border border-dashed border-border bg-muted/25 p-4">
                <p className="text-[0.78rem] font-bold">Optional first requirement</p>
                <p className="mt-1 text-[0.7rem] leading-relaxed text-muted-foreground">
                  A qualification requirement is satisfied only by a verified credential whose name
                  matches exactly. You can add more requirements after saving.
                </p>
                <div className="mt-3 grid gap-3">
                  <div className="grid gap-3 sm:grid-cols-[1fr_150px]">
                    <Field label="Requirement label" htmlFor="requirementLabel" optional>
                      <Input
                        id="requirementLabel"
                        name="requirementLabel"
                        maxLength={100}
                        placeholder="e.g. Bambu X1 operator training"
                      />
                    </Field>
                    <Field label="Kind" htmlFor="requirementKind" optional>
                      <Select id="requirementKind" name="requirementKind" defaultValue="qualification">
                        <option value="qualification">Qualification</option>
                        <option value="training">Training record</option>
                        <option value="membership">Membership</option>
                      </Select>
                    </Field>
                  </div>
                  <Field label="Requirement description" htmlFor="requirementDescription" optional>
                    <Input
                      id="requirementDescription"
                      name="requirementDescription"
                      maxLength={500}
                      placeholder="What the member must demonstrate before verification."
                    />
                  </Field>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex items-center gap-2 border-b border-border pb-2">
                <CalendarClock className="size-4 text-primary" aria-hidden />
                <h2 className="text-[0.92rem] font-bold">3. Weekly availability</h2>
              </div>
              <fieldset>
                <legend className="text-[0.78rem] font-semibold">Available days</legend>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {WEEKDAY_LONG_LABELS.map((label, weekday) => (
                    <label
                      key={label}
                      className="flex items-center gap-2 rounded-lg border border-border bg-background/60 px-2.5 py-2 text-[0.76rem] font-medium"
                    >
                      <input
                        type="checkbox"
                        name="weekdays"
                        value={weekday}
                        defaultChecked={weekday >= 1 && weekday <= 5}
                        className="size-3.5 accent-[var(--primary)]"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Opens" htmlFor="openTime">
                  <Input id="openTime" name="openTime" type="time" defaultValue="09:00" required />
                </Field>
                <Field label="Closes" htmlFor="closeTime">
                  <Input id="closeTime" name="closeTime" type="time" defaultValue="17:00" required />
                </Field>
              </div>
            </section>

            <Alert tone="info">
              Publishing makes the listing visible in the catalog immediately. Members can request
              access, but every request still requires your written decision.
            </Alert>
          </ActionForm>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24">
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="eyebrow">What happens next</p>
            <ol className="mt-3 space-y-3">
              {[
                ["Listing goes live", "It appears in the public catalog with your name as owner."],
                ["Add requirements", "Match labels to verified qualifications held by members."],
                ["Set blackouts", "Block maintenance windows without pausing the listing."],
                ["Review requests", "Approve, decline or waitlist with a written reason."],
              ].map(([title, body], index) => (
                <li key={String(title)} className="flex gap-2.5">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-primary/25 bg-primary-soft font-mono text-[0.55rem] font-bold text-primary">
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-[0.76rem] font-bold">{title}</p>
                    <p className="mt-0.5 text-[0.68rem] leading-relaxed text-muted-foreground">
                      {body}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-[0.78rem] font-bold">Verification is not self-declared</p>
            <p className="mt-1.5 text-[0.7rem] leading-relaxed text-muted-foreground">
              Members cannot mark themselves trained. A manager or administrator verifies each
              credential in the organization console before it satisfies a requirement.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
