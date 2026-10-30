-- LabLoop SQLite schema (local, runnable demo backend)
-- Mirrors the relational model documented in supabase/migrations/.
-- All timestamps are ISO-8601 UTC strings; the institution timezone is Asia/Kolkata.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  location TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  full_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  headline TEXT,
  avatar_color TEXT NOT NULL DEFAULT '#0b6b5f',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS organization_members (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('student', 'owner', 'manager', 'admin')),
  title TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at TEXT NOT NULL,
  UNIQUE (organization_id, user_id)
);

CREATE TABLE IF NOT EXISTS resources (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  owner_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (
    category IN ('3d-printing', 'electronics', 'imaging', 'robotics', 'workspace', 'testing', 'fabrication')
  ),
  description TEXT NOT NULL,
  location TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
  max_duration_hours INTEGER NOT NULL DEFAULT 4 CHECK (max_duration_hours BETWEEN 1 AND 24),
  fair_use_limit INTEGER NOT NULL DEFAULT 2 CHECK (fair_use_limit BETWEEN 1 AND 10),
  usage_rules TEXT NOT NULL,
  condition_summary TEXT NOT NULL,
  eligibility_note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS resource_requirements (
  id TEXT PRIMARY KEY,
  resource_id TEXT NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('membership', 'qualification', 'training')),
  label TEXT NOT NULL,
  description TEXT,
  is_required INTEGER NOT NULL DEFAULT 1 CHECK (is_required IN (0, 1)),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_qualifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('lab_badge', 'training_certificate', 'membership')),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('verified', 'pending', 'expired', 'revoked')),
  verified_by TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  verified_at TEXT,
  expires_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (user_id, organization_id, name)
);

CREATE TABLE IF NOT EXISTS availability_windows (
  id TEXT PRIMARY KEY,
  resource_id TEXT NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  weekday INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_minute INTEGER NOT NULL CHECK (start_minute BETWEEN 0 AND 1439),
  end_minute INTEGER NOT NULL CHECK (end_minute BETWEEN 1 AND 1440),
  created_at TEXT NOT NULL,
  UNIQUE (resource_id, weekday, start_minute, end_minute),
  CHECK (end_minute > start_minute)
);

CREATE TABLE IF NOT EXISTS resource_blackouts (
  id TEXT PRIMARY KEY,
  resource_id TEXT NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL,
  CHECK (starts_at < ends_at)
);

CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  resource_id TEXT NOT NULL REFERENCES resources(id) ON DELETE RESTRICT,
  borrower_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  purpose TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'waitlisted', 'approved', 'rejected', 'cancelled', 'checked_in', 'return_submitted', 'completed')
  ),
  decision_reason TEXT,
  decided_by TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  decided_at TEXT,
  cancelled_at TEXT,
  checked_in_at TEXT,
  return_submitted_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (starts_at < ends_at)
);

CREATE TABLE IF NOT EXISTS booking_events (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  actor_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  kind TEXT NOT NULL,
  summary TEXT NOT NULL,
  metadata_json TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS condition_reports (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  phase TEXT NOT NULL CHECK (phase IN ('check_in', 'check_out')),
  condition TEXT NOT NULL CHECK (condition IN ('excellent', 'good', 'fair', 'poor', 'damaged')),
  accessories_ok INTEGER NOT NULL DEFAULT 1 CHECK (accessories_ok IN (0, 1)),
  notes TEXT,
  photo_url TEXT,
  submitted_by TEXT NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL,
  UNIQUE (booking_id, phase)
);

CREATE TABLE IF NOT EXISTS incidents (
  id TEXT PRIMARY KEY,
  booking_id TEXT REFERENCES bookings(id) ON DELETE SET NULL,
  resource_id TEXT NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  reporter_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  type TEXT NOT NULL CHECK (type IN ('damage', 'missing_accessory', 'late_return', 'access_conflict', 'other')),
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high')),
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewing', 'resolved', 'dismissed')),
  resolution_notes TEXT,
  resolved_by TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  resolved_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  href TEXT,
  read_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  summary TEXT NOT NULL,
  metadata_json TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_members_user ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_resources_org ON resources(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_resources_category ON resources(category);
CREATE INDEX IF NOT EXISTS idx_requirements_resource ON resource_requirements(resource_id);
CREATE INDEX IF NOT EXISTS idx_qualifications_user ON user_qualifications(user_id, organization_id, status);
CREATE INDEX IF NOT EXISTS idx_availability_resource ON availability_windows(resource_id);
CREATE INDEX IF NOT EXISTS idx_blackouts_resource ON resource_blackouts(resource_id, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_bookings_resource_status ON bookings(resource_id, status, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_bookings_borrower ON bookings(borrower_id, status, starts_at);
CREATE INDEX IF NOT EXISTS idx_booking_events_booking ON booking_events(booking_id, created_at);
CREATE INDEX IF NOT EXISTS idx_conditions_booking ON condition_reports(booking_id);
CREATE INDEX IF NOT EXISTS idx_incidents_resource ON incidents(resource_id, status);
CREATE INDEX IF NOT EXISTS idx_incidents_booking ON incidents(booking_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read_at, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_org ON audit_events(organization_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_events(actor_id, created_at);
CREATE INDEX IF NOT EXISTS idx_sessions_hash ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- ---------------------------------------------------------------------------
-- Database-level integrity guards
-- ---------------------------------------------------------------------------

-- Append-only audit + timeline records. Application users have no update/delete path.
CREATE TRIGGER IF NOT EXISTS audit_events_no_update
BEFORE UPDATE ON audit_events
BEGIN
  SELECT RAISE(ABORT, 'AUDIT_APPEND_ONLY');
END;

CREATE TRIGGER IF NOT EXISTS audit_events_no_delete
BEFORE DELETE ON audit_events
BEGIN
  SELECT RAISE(ABORT, 'AUDIT_APPEND_ONLY');
END;

CREATE TRIGGER IF NOT EXISTS booking_events_no_update
BEFORE UPDATE ON booking_events
BEGIN
  SELECT RAISE(ABORT, 'TIMELINE_APPEND_ONLY');
END;

CREATE TRIGGER IF NOT EXISTS booking_events_no_delete
BEFORE DELETE ON booking_events
BEGIN
  SELECT RAISE(ABORT, 'TIMELINE_APPEND_ONLY');
END;

CREATE TRIGGER IF NOT EXISTS condition_reports_no_update
BEFORE UPDATE ON condition_reports
BEGIN
  SELECT RAISE(ABORT, 'CONDITION_REPORT_APPEND_ONLY');
END;

CREATE TRIGGER IF NOT EXISTS condition_reports_no_delete
BEFORE DELETE ON condition_reports
BEGIN
  SELECT RAISE(ABORT, 'CONDITION_REPORT_APPEND_ONLY');
END;

-- Last line of defence: a single-capacity resource can never have overlapping
-- custody-bearing reservations, even if application code is bypassed.
CREATE TRIGGER IF NOT EXISTS bookings_no_overlap_insert
BEFORE INSERT ON bookings
WHEN NEW.status IN ('approved', 'checked_in', 'return_submitted')
BEGIN
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM bookings b
    WHERE b.resource_id = NEW.resource_id
      AND b.status IN ('approved', 'checked_in', 'return_submitted')
      AND b.starts_at < NEW.ends_at
      AND b.ends_at > NEW.starts_at
  ) THEN RAISE(ABORT, 'BOOKING_CONFLICT') END;
END;

CREATE TRIGGER IF NOT EXISTS bookings_no_overlap_update
BEFORE UPDATE OF status, starts_at, ends_at ON bookings
WHEN NEW.status IN ('approved', 'checked_in', 'return_submitted')
 AND (OLD.status NOT IN ('approved', 'checked_in', 'return_submitted')
      OR NEW.starts_at <> OLD.starts_at
      OR NEW.ends_at <> OLD.ends_at)
BEGIN
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM bookings b
    WHERE b.resource_id = NEW.resource_id
      AND b.id <> NEW.id
      AND b.status IN ('approved', 'checked_in', 'return_submitted')
      AND b.starts_at < NEW.ends_at
      AND b.ends_at > NEW.starts_at
  ) THEN RAISE(ABORT, 'BOOKING_CONFLICT') END;
END;

-- Additive guard also upgrades existing databases without replacing history.
CREATE TRIGGER IF NOT EXISTS bookings_no_overlap_resource_update
BEFORE UPDATE OF resource_id ON bookings
WHEN NEW.status IN ('approved', 'checked_in', 'return_submitted')
BEGIN
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM bookings b
    WHERE b.resource_id = NEW.resource_id AND b.id <> NEW.id
      AND b.status IN ('approved', 'checked_in', 'return_submitted')
      AND b.starts_at < NEW.ends_at AND b.ends_at > NEW.starts_at
  ) THEN RAISE(ABORT, 'BOOKING_CONFLICT') END;
END;

INSERT INTO schema_meta (key, value) VALUES ('schema_version', '1')
ON CONFLICT(key) DO NOTHING;
