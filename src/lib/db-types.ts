import type {
  BookingStatus,
  ConditionGrade,
  IncidentSeverity,
  IncidentType,
  ResourceCategory,
  Role,
} from "./domain";

export interface OrganizationRow {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  location: string;
  created_at: string;
}

export interface ProfileRow {
  id: string;
  email: string;
  full_name: string;
  password_hash: string;
  headline: string | null;
  avatar_color: string;
  created_at: string;
}

export interface MembershipRow {
  id: string;
  organization_id: string;
  user_id: string;
  role: Role;
  title: string | null;
  status: "active" | "suspended";
  created_at: string;
}

export interface ResourceRow {
  id: string;
  organization_id: string;
  owner_id: string;
  name: string;
  category: ResourceCategory;
  description: string;
  location: string;
  status: "active" | "paused" | "archived";
  max_duration_hours: number;
  fair_use_limit: number;
  usage_rules: string;
  condition_summary: string;
  eligibility_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface RequirementRow {
  id: string;
  resource_id: string;
  kind: "membership" | "qualification" | "training";
  label: string;
  description: string | null;
  is_required: 0 | 1;
  created_at: string;
}

export interface QualificationRow {
  id: string;
  user_id: string;
  organization_id: string;
  kind: "lab_badge" | "training_certificate" | "membership";
  name: string;
  status: "verified" | "pending" | "expired" | "revoked";
  verified_by: string | null;
  verified_at: string | null;
  expires_at: string | null;
  notes: string | null;
  created_at: string;
}

export interface AvailabilityRow {
  id: string;
  resource_id: string;
  weekday: number;
  start_minute: number;
  end_minute: number;
  created_at: string;
}

export interface BlackoutRow {
  id: string;
  resource_id: string;
  starts_at: string;
  ends_at: string;
  reason: string;
  created_at: string;
}

export interface BookingRow {
  id: string;
  resource_id: string;
  borrower_id: string;
  organization_id: string;
  starts_at: string;
  ends_at: string;
  purpose: string;
  notes: string | null;
  status: BookingStatus;
  decision_reason: string | null;
  decided_by: string | null;
  decided_at: string | null;
  cancelled_at: string | null;
  checked_in_at: string | null;
  return_submitted_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BookingEventRow {
  id: string;
  booking_id: string;
  actor_id: string | null;
  kind: string;
  summary: string;
  metadata_json: string | null;
  created_at: string;
}

export interface ConditionReportRow {
  id: string;
  booking_id: string;
  phase: "check_in" | "check_out";
  condition: ConditionGrade;
  accessories_ok: 0 | 1;
  notes: string | null;
  photo_url: string | null;
  submitted_by: string;
  created_at: string;
}

export interface IncidentRow {
  id: string;
  booking_id: string | null;
  resource_id: string;
  reporter_id: string;
  type: IncidentType;
  severity: IncidentSeverity;
  description: string;
  status: "open" | "reviewing" | "resolved" | "dismissed";
  resolution_notes: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface NotificationRow {
  id: string;
  user_id: string;
  kind: string;
  title: string;
  body: string;
  href: string | null;
  read_at: string | null;
  created_at: string;
}

export interface AuditEventRow {
  id: string;
  organization_id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  summary: string;
  metadata_json: string | null;
  created_at: string;
}

export interface SessionRow {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  created_at: string;
}

export interface MembershipContext {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  timezone: string;
  role: Role;
  title: string | null;
  status: "active" | "suspended";
}

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  headline: string | null;
  avatarColor: string;
  memberships: MembershipContext[];
}

export interface ResourceWithRelations extends ResourceRow {
  requirements: RequirementRow[];
  availability: AvailabilityRow[];
  blackouts: BlackoutRow[];
  owner: Pick<ProfileRow, "id" | "full_name" | "headline">;
  organization: Pick<OrganizationRow, "id" | "name" | "slug">;
}

export interface BookingWithContext extends BookingRow {
  resource: ResourceWithRelations;
  resourceOwner: Pick<ProfileRow, "id" | "full_name" | "email">;
  borrower: Pick<ProfileRow, "id" | "full_name" | "email" | "headline" | "avatar_color">;
}
