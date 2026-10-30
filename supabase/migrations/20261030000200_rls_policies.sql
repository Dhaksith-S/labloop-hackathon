-- ============================================================================
-- LabLoop — prepared Supabase Row Level Security policies
--
-- STATUS: PREPARED ONLY. This migration has NOT been applied to a Supabase
-- project and has NOT been executed or verified against PostgreSQL. No
-- Supabase project exists in this workspace. See supabase/README.md.
--
-- Access model:
--   * Anonymous visitors can read the active public catalog only.
--   * Authenticated participants can read their own bookings, custody
--     records, notifications and qualifications.
--   * Resource owners, managers and admins can read records for resources
--     inside their organization.
--   * ALL mutations run in trusted server code with the service role after
--     the same checks used by the runnable app. Authenticated clients are not
--     granted INSERT/UPDATE/DELETE on lifecycle tables, because PostgreSQL RLS
--     row predicates cannot enforce legal state transitions by themselves.
--   * The only client write allowed by this file is marking your own
--     notification as read.
--   * audit_events, booking_events and condition_reports are append-only.
--     Triggers enforce that even for the table owner and service_role.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- Helper functions (private schema; not exposed through the API)
-- ---------------------------------------------------------------------------

create or replace function private.is_active_member(target_org uuid, target_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = target_org
      and m.user_id = target_user
      and m.status = 'active'
  );
$$;

create or replace function private.is_org_staff(target_org uuid, target_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = target_org
      and m.user_id = target_user
      and m.status = 'active'
      and m.role in ('manager', 'admin')
  );
$$;

-- Resource owner, or a manager/admin of the resource's organization.
create or replace function private.can_manage_resource(target_resource uuid, target_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select exists (
    select 1
    from public.resources r
    where r.id = target_resource
      and (
        r.owner_id = target_user
        or exists (
          select 1
          from public.organization_members m
          where m.organization_id = r.organization_id
            and m.user_id = target_user
            and m.status = 'active'
            and m.role in ('manager', 'admin')
        )
      )
  );
$$;

create or replace function private.can_view_booking(target_booking uuid, target_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select exists (
    select 1
    from public.bookings b
    join public.resources r on r.id = b.resource_id
    where b.id = target_booking
      and (
        b.borrower_id = target_user
        or r.owner_id = target_user
        or exists (
          select 1
          from public.organization_members m
          where m.organization_id = b.organization_id
            and m.user_id = target_user
            and m.status = 'active'
            and m.role in ('manager', 'admin')
        )
      )
  );
$$;

revoke all on function private.is_active_member(uuid, uuid) from public;
revoke all on function private.is_org_staff(uuid, uuid) from public;
revoke all on function private.can_manage_resource(uuid, uuid) from public;
revoke all on function private.can_view_booking(uuid, uuid) from public;

grant usage on schema private to authenticated;
grant execute on function private.is_active_member(uuid, uuid) to authenticated;
grant execute on function private.is_org_staff(uuid, uuid) to authenticated;
grant execute on function private.can_manage_resource(uuid, uuid) to authenticated;
grant execute on function private.can_view_booking(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Enable RLS
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.resources enable row level security;
alter table public.resource_requirements enable row level security;
alter table public.user_qualifications enable row level security;
alter table public.availability_windows enable row level security;
alter table public.resource_blackouts enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_events enable row level security;
alter table public.condition_reports enable row level security;
alter table public.incidents enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_events enable row level security;

-- ---------------------------------------------------------------------------
-- Base grants. RLS filters rows; these only grant table privileges.
-- Mutations (other than notification read state) are deliberately absent.
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon, authenticated;

grant select on public.organizations, public.resources, public.resource_requirements,
  public.availability_windows, public.resource_blackouts
  to anon, authenticated;

grant select on public.profiles, public.organization_members,
  public.user_qualifications, public.bookings, public.booking_events,
  public.condition_reports, public.incidents, public.notifications,
  public.audit_events
  to authenticated;

grant update (read_at) on public.notifications to authenticated;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

create policy profiles_select_self on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

-- Staff can see members of their organization (review screens).
create policy profiles_select_org_staff on public.profiles
  for select to authenticated
  using (
    exists (
      select 1
      from public.organization_members m
      where m.user_id = public.profiles.id
        and private.is_org_staff(m.organization_id)
    )
  );

-- The catalog shows the listing owner's display name and headline.
create policy profiles_select_public_owner on public.profiles
  for select to anon, authenticated
  using (
    exists (
      select 1
      from public.resources r
      where r.owner_id = public.profiles.id
        and r.status = 'active'
    )
  );

-- ---------------------------------------------------------------------------
-- Organizations and public catalog
-- ---------------------------------------------------------------------------

create policy organizations_select_member on public.organizations
  for select to authenticated
  using (private.is_active_member(id));

-- Public catalog pages display the institution behind an active listing.
create policy organizations_select_public on public.organizations
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.resources r
      where r.organization_id = public.organizations.id
        and r.status = 'active'
    )
  );

-- Marketing catalog: active listings only.
create policy resources_select_public on public.resources
  for select to anon, authenticated
  using (status = 'active');

-- Members can also see paused/archived listings in their own organization.
create policy resources_select_staff on public.resources
  for select to authenticated
  using (private.is_active_member(organization_id));

create policy requirements_select_public on public.resource_requirements
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.resources r
      where r.id = resource_requirements.resource_id
        and r.status = 'active'
    )
  );

create policy requirements_select_staff on public.resource_requirements
  for select to authenticated
  using (private.can_manage_resource(resource_id));

create policy availability_select_public on public.availability_windows
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.resources r
      where r.id = availability_windows.resource_id
        and r.status = 'active'
    )
  );

create policy availability_select_staff on public.availability_windows
  for select to authenticated
  using (private.can_manage_resource(resource_id));

create policy blackouts_select_public on public.resource_blackouts
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.resources r
      where r.id = resource_blackouts.resource_id
        and r.status = 'active'
    )
  );

create policy blackouts_select_staff on public.resource_blackouts
  for select to authenticated
  using (private.can_manage_resource(resource_id));

-- ---------------------------------------------------------------------------
-- Memberships and qualifications
-- ---------------------------------------------------------------------------

create policy memberships_select_self on public.organization_members
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy memberships_select_org_staff on public.organization_members
  for select to authenticated
  using (private.is_org_staff(organization_id));

create policy qualifications_select_self on public.user_qualifications
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy qualifications_select_org_staff on public.user_qualifications
  for select to authenticated
  using (private.is_org_staff(organization_id));

-- ---------------------------------------------------------------------------
-- Bookings and custody records (read-only to clients)
-- ---------------------------------------------------------------------------

create policy bookings_select_participant on public.bookings
  for select to authenticated
  using (private.can_view_booking(id));

create policy booking_events_select_participant on public.booking_events
  for select to authenticated
  using (private.can_view_booking(booking_id));

create policy conditions_select_participant on public.condition_reports
  for select to authenticated
  using (private.can_view_booking(booking_id));

-- ---------------------------------------------------------------------------
-- Incidents
-- ---------------------------------------------------------------------------

create policy incidents_select_reporter on public.incidents
  for select to authenticated
  using (reporter_id = (select auth.uid()));

create policy incidents_select_staff on public.incidents
  for select to authenticated
  using (private.can_manage_resource(resource_id));

-- ---------------------------------------------------------------------------
-- Notifications and audit
-- ---------------------------------------------------------------------------

create policy notifications_select_self on public.notifications
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Column grant above limits this to `read_at`. No insert/delete grant exists.
create policy notifications_update_self on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy audit_select_org_staff on public.audit_events
  for select to authenticated
  using (private.is_org_staff(organization_id));

commit;
