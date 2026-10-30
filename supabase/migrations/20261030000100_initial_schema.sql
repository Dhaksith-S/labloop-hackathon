-- ============================================================================
-- LabLoop — prepared Supabase schema (PostgreSQL)
--
-- STATUS: PREPARED ONLY. This migration has NOT been applied to a Supabase
-- project and has NOT been executed or verified against PostgreSQL in this
-- workspace. No Supabase credentials or project exist. The runnable
-- application uses the SQLite schema in src/db/sqlite-schema.sql.
--
-- Before using this file:
--   1. Create a Supabase project and apply both migrations.
--   2. Replace the self-hosted session/auth layer in src/lib/auth.ts with
--      Supabase Auth, or keep all writes server-side with the service role.
--   3. Port the data-access layer away from better-sqlite3.
--   4. Run the RLS test matrix in docs/SECURITY.md with real anon,
--      authenticated student, owner, manager and service-role clients.
--
-- The schema intentionally mirrors the local relational model while using
-- PostgreSQL-native constraints (timestamptz, exclusion constraints, auth.users).
-- ============================================================================

begin;

create extension if not exists pgcrypto with schema extensions;
-- Required for the GiST equality operator on resource_id in the exclusion
-- constraint below.
create extension if not exists btree_gist with schema extensions;

create schema if not exists private;
revoke all on schema private from public;

-- ---------------------------------------------------------------------------
-- Identity and membership
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  full_name text not null check (char_length(full_name) between 2 and 120),
  headline text,
  avatar_color text not null default '#0b6b5f'
    check (avatar_color ~ '^#[0-9a-fA-F]{6}$'),
  created_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 160),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  timezone text not null default 'Asia/Kolkata',
  location text not null,
  created_at timestamptz not null default now()
);

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('student', 'owner', 'manager', 'admin')),
  title text,
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Listings and eligibility configuration
-- ---------------------------------------------------------------------------

create table public.resources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete restrict,
  name text not null check (char_length(name) between 3 and 120),
  category text not null check (category in (
    '3d-printing', 'electronics', 'imaging', 'robotics',
    'workspace', 'testing', 'fabrication'
  )),
  description text not null check (char_length(description) between 20 and 4000),
  location text not null,
  status text not null default 'active' check (status in ('active', 'paused', 'archived')),
  max_duration_hours integer not null default 4 check (max_duration_hours between 1 and 24),
  fair_use_limit integer not null default 2 check (fair_use_limit between 1 and 10),
  usage_rules text not null,
  condition_summary text not null,
  eligibility_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.resource_requirements (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.resources (id) on delete cascade,
  kind text not null check (kind in ('membership', 'qualification', 'training')),
  label text not null check (char_length(label) between 2 and 120),
  description text,
  is_required boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.user_qualifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  kind text not null check (kind in ('lab_badge', 'training_certificate', 'membership')),
  name text not null,
  status text not null default 'pending'
    check (status in ('verified', 'pending', 'expired', 'revoked')),
  verified_by uuid references public.profiles (id) on delete set null,
  verified_at timestamptz,
  expires_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  unique (user_id, organization_id, name),
  check (status <> 'verified' or verified_by is not null)
);

create table public.availability_windows (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.resources (id) on delete cascade,
  weekday integer not null check (weekday between 0 and 6),
  start_minute integer not null check (start_minute between 0 and 1439),
  end_minute integer not null check (end_minute between 1 and 1440),
  created_at timestamptz not null default now(),
  unique (resource_id, weekday, start_minute, end_minute),
  check (end_minute > start_minute)
);

create table public.resource_blackouts (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.resources (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text not null check (char_length(reason) between 5 and 300),
  created_at timestamptz not null default now(),
  check (starts_at < ends_at)
);

-- ---------------------------------------------------------------------------
-- Booking lifecycle
-- ---------------------------------------------------------------------------

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.resources (id) on delete restrict,
  borrower_id uuid not null references public.profiles (id) on delete restrict,
  organization_id uuid not null references public.organizations (id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  purpose text not null check (char_length(purpose) between 10 and 1000),
  notes text,
  status text not null default 'pending' check (status in (
    'pending', 'waitlisted', 'approved', 'rejected', 'cancelled',
    'checked_in', 'return_submitted', 'completed'
  )),
  decision_reason text,
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  cancelled_at timestamptz,
  checked_in_at timestamptz,
  return_submitted_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (starts_at < ends_at),
  -- Atomic concurrency guard. PostgreSQL evaluates this on insert and on any
  -- update that produces a custody-bearing status, so two concurrent approvals
  -- cannot double-book a single-capacity resource.
  constraint bookings_no_overlap exclude using gist (
    resource_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status in ('approved', 'checked_in', 'return_submitted'))
);

create table public.booking_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  kind text not null,
  summary text not null,
  metadata_json jsonb,
  created_at timestamptz not null default now()
);

create table public.condition_reports (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  phase text not null check (phase in ('check_in', 'check_out')),
  condition text not null check (condition in ('excellent', 'good', 'fair', 'poor', 'damaged')),
  accessories_ok boolean not null default true,
  notes text,
  photo_url text,
  submitted_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (booking_id, phase)
);

create table public.incidents (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings (id) on delete set null,
  resource_id uuid not null references public.resources (id) on delete cascade,
  reporter_id uuid not null references public.profiles (id) on delete restrict,
  type text not null check (type in (
    'damage', 'missing_accessory', 'late_return', 'access_conflict', 'other'
  )),
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high')),
  description text not null check (char_length(description) between 15 and 4000),
  status text not null default 'open'
    check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  resolution_notes text,
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null,
  href text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text not null check (entity_type in (
    'resource', 'booking', 'incident', 'qualification', 'membership', 'organization'
  )),
  entity_id uuid not null,
  summary text not null,
  metadata_json jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index idx_members_user on public.organization_members (user_id);
create index idx_members_org_role on public.organization_members (organization_id, role, status);
create index idx_resources_org on public.resources (organization_id, status);
create index idx_resources_owner on public.resources (owner_id);
create index idx_resources_category on public.resources (category);
create index idx_requirements_resource on public.resource_requirements (resource_id);
create index idx_qualifications_user on public.user_qualifications (user_id, organization_id, status);
create index idx_availability_resource on public.availability_windows (resource_id);
create index idx_blackouts_resource on public.resource_blackouts (resource_id, starts_at, ends_at);
create index idx_bookings_resource_status on public.bookings (resource_id, status, starts_at, ends_at);
create index idx_bookings_borrower on public.bookings (borrower_id, status, starts_at);
create index idx_booking_events_booking on public.booking_events (booking_id, created_at);
create index idx_conditions_booking on public.condition_reports (booking_id);
create index idx_incidents_resource on public.incidents (resource_id, status);
create index idx_incidents_booking on public.incidents (booking_id);
create index idx_notifications_user on public.notifications (user_id, read_at, created_at);
create index idx_audit_org on public.audit_events (organization_id, created_at);
create index idx_audit_actor on public.audit_events (actor_id, created_at);
create index idx_audit_entity on public.audit_events (entity_type, entity_id);

-- ---------------------------------------------------------------------------
-- Shared trigger functions
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger resources_set_updated_at
before update on public.resources
for each row execute function public.set_updated_at();

create trigger bookings_set_updated_at
before update on public.bookings
for each row execute function public.set_updated_at();

create trigger incidents_set_updated_at
before update on public.incidents
for each row execute function public.set_updated_at();

-- Append-only records. Triggers fire for every role, including the table
-- owner and service_role; RLS alone is not trusted to preserve history.
create or replace function public.reject_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception '% is append-only', tg_table_name
    using errcode = 'integrity_constraint_violation',
          hint = 'Insert a correcting record instead of rewriting history.';
end;
$$;

create trigger audit_events_append_only
before update or delete on public.audit_events
for each row execute function public.reject_append_only();

create trigger booking_events_append_only
before update or delete on public.booking_events
for each row execute function public.reject_append_only();

create trigger condition_reports_append_only
before update or delete on public.condition_reports
for each row execute function public.reject_append_only();

-- Create a profile whenever Supabase Auth creates a user.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  insert into public.profiles (id, email, full_name, headline)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1)),
    nullif(new.raw_user_meta_data ->> 'headline', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

commit;
