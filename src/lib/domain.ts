export const ROLES = ["student", "owner", "manager", "admin"] as const;
export type Role = (typeof ROLES)[number];

export const BOOKING_STATUSES = [
  "pending",
  "waitlisted",
  "approved",
  "rejected",
  "cancelled",
  "checked_in",
  "return_submitted",
  "completed",
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const CUSTODY_STATUSES: BookingStatus[] = [
  "approved",
  "checked_in",
  "return_submitted",
];

export const RESOURCE_CATEGORIES = [
  "3d-printing",
  "electronics",
  "imaging",
  "robotics",
  "workspace",
  "testing",
  "fabrication",
] as const;
export type ResourceCategory = (typeof RESOURCE_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<ResourceCategory, string> = {
  "3d-printing": "3D printing",
  electronics: "Electronics",
  imaging: "Imaging",
  robotics: "Robotics",
  workspace: "Workspace",
  testing: "Testing",
  fabrication: "Fabrication",
};

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  pending: "Awaiting review",
  waitlisted: "Waitlisted",
  approved: "Approved",
  rejected: "Not approved",
  cancelled: "Cancelled",
  checked_in: "In use",
  return_submitted: "Return pending",
  completed: "Completed",
};

export const ROLE_LABELS: Record<Role, string> = {
  student: "Student",
  owner: "Resource owner",
  manager: "Lab manager",
  admin: "Administrator",
};

export const INCIDENT_TYPES = [
  "damage",
  "missing_accessory",
  "late_return",
  "access_conflict",
  "other",
] as const;
export type IncidentType = (typeof INCIDENT_TYPES)[number];

export const INCIDENT_TYPE_LABELS: Record<IncidentType, string> = {
  damage: "Damage",
  missing_accessory: "Missing accessory",
  late_return: "Late return",
  access_conflict: "Access conflict",
  other: "Other issue",
};

export const INCIDENT_SEVERITIES = ["low", "medium", "high"] as const;
export type IncidentSeverity = (typeof INCIDENT_SEVERITIES)[number];

export const CONDITION_GRADES = ["excellent", "good", "fair", "poor", "damaged"] as const;
export type ConditionGrade = (typeof CONDITION_GRADES)[number];

export const CONDITION_LABELS: Record<ConditionGrade, string> = {
  excellent: "Excellent",
  good: "Good",
  fair: "Fair — minor wear",
  poor: "Poor — needs attention",
  damaged: "Damaged",
};

export const DEMO_ORGANIZATION_SLUG = "northstar";
export const DEMO_PASSWORD = "LabLoop!2026";
export const SESSION_COOKIE = "labloop_session";
export const SESSION_TTL_DAYS = 14;
