import { randomUUID } from "node:crypto";
import type { Db } from "../db";
import { hashPassword } from "../password";
import { logAudit, logBookingEvent, pushNotification } from "../events";
import { addDays, addHours, addMinutes, fromDateTimeLocalValue, istDateKey } from "../time";
import { DEMO_ORGANIZATION_SLUG, DEMO_PASSWORD } from "../domain";

function id(prefix: string, n: number): string {
  return `${prefix}000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
}

const ORG = id("0a", 1);

const USERS = {
  arjun: id("1a", 1),
  maya: id("1a", 2),
  riya: id("1a", 3),
  priya: id("1a", 4),
  dev: id("1a", 5),
};

const MEMBERSHIPS = {
  arjun: id("2a", 1),
  maya: id("2a", 2),
  riya: id("2a", 3),
  priya: id("2a", 4),
  dev: id("2a", 5),
};

const RESOURCES = {
  printer: id("3a", 1),
  oscilloscope: id("3a", 2),
  openBench: id("3a", 3),
  tester: id("3a", 4),
  camera: id("3a", 5),
  robot: id("3a", 6),
  laser: id("3a", 7),
};

const QUALIFICATIONS = {
  arjunPrint: id("5a", 1),
  arjunElectronics: id("5a", 2),
  arjunMaterialsPending: id("5a", 3),
  priyaPrint: id("5a", 4),
  priyaElectronics: id("5a", 5),
  priyaCamera: id("5a", 6),
  devPrint: id("5a", 7),
};

const BOOKINGS = {
  arjunPending: id("7a", 1),
  devApproved: id("7a", 2),
  priyaWaitlisted: id("7a", 3),
  arjunCheckedIn: id("7a", 4),
  arjunCompleted: id("7a", 5),
};

const INCIDENTS = {
  resolvedAccessory: id("ba", 1),
  openLaser: id("ba", 2),
};

const CONDITIONS = {
  checkInOscilloscope: id("9a", 1),
  checkInBench: id("9a", 2),
  checkOutBench: id("9a", 3),
};

export interface SeedResult {
  seeded: boolean;
  organizationId?: string;
  message: string;
}

/**
 * Idempotent fictional demo dataset. If any profile already exists the seed
 * returns early, so judge-created records are never overwritten.
 */
export async function seedDemoDatabase(db: Db): Promise<SeedResult> {
  const existing = db.prepare("SELECT COUNT(*) AS count FROM profiles").get() as {
    count: number;
  };
  if (existing.count > 0) {
    return {
      seeded: false,
      message: "Database already contains profiles; demo seed skipped.",
    };
  }

  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const now = new Date();
  const nowIso = now.toISOString();

  const pendingStart = new Date(
    Math.ceil((now.getTime() + 20 * 60_000) / (5 * 60_000)) * 5 * 60_000,
  ).toISOString();
  const pendingEnd = addHours(pendingStart, 2);

  const checkedInStart = addMinutes(nowIso, -15);
  const checkedInEnd = addMinutes(nowIso, 105);

  const tomorrowKey = istDateKey(addDays(nowIso, 1));
  const walkInStart = fromDateTimeLocalValue(`${tomorrowKey}T14:00`);
  const walkInEnd = fromDateTimeLocalValue(`${tomorrowKey}T16:00`);

  const historyKey = istDateKey(addDays(nowIso, -4));
  const historyStart = fromDateTimeLocalValue(`${historyKey}T10:00`);
  const historyEnd = fromDateTimeLocalValue(`${historyKey}T12:00`);

  const blackoutStart = fromDateTimeLocalValue(`${istDateKey(addDays(nowIso, 3))}T08:00`);
  const blackoutEnd = fromDateTimeLocalValue(`${istDateKey(addDays(nowIso, 3))}T12:00`);

  const seed = db.transaction(() => {
    db.prepare(
      `INSERT INTO organizations (id, name, slug, timezone, location, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      ORG,
      "Northstar Institute of Applied Technology",
      DEMO_ORGANIZATION_SLUG,
      "Asia/Kolkata",
      "Maker Wing, Building C — fictional Northstar campus",
      nowIso,
    );

    const insertProfile = db.prepare(
      `INSERT INTO profiles (id, email, full_name, password_hash, headline, avatar_color, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    insertProfile.run(
      USERS.arjun,
      "student@labloop.demo",
      "Arjun Mehta",
      passwordHash,
      "Mechatronics student · Rover team",
      "#0b6b5f",
      nowIso,
    );
    insertProfile.run(
      USERS.maya,
      "owner@labloop.demo",
      "Maya Iyer",
      passwordHash,
      "Fabrication lab steward",
      "#b45309",
      nowIso,
    );
    insertProfile.run(
      USERS.riya,
      "manager@labloop.demo",
      "Riya Sen",
      passwordHash,
      "Operations lead, Maker Wing",
      "#6d28d9",
      nowIso,
    );
    insertProfile.run(
      USERS.priya,
      "priya@labloop.demo",
      "Priya Nair",
      passwordHash,
      "Robotics capstone student",
      "#0369a1",
      nowIso,
    );
    insertProfile.run(
      USERS.dev,
      "dev@labloop.demo",
      "Dev Patel",
      passwordHash,
      "Design engineering student",
      "#9d174d",
      nowIso,
    );

    const insertMember = db.prepare(
      `INSERT INTO organization_members (id, organization_id, user_id, role, title, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'active', ?)`,
    );
    insertMember.run(MEMBERSHIPS.arjun, ORG, USERS.arjun, "student", "Member", nowIso);
    insertMember.run(MEMBERSHIPS.maya, ORG, USERS.maya, "owner", "Fabrication lab steward", nowIso);
    insertMember.run(MEMBERSHIPS.riya, ORG, USERS.riya, "manager", "Maker Wing operations lead", nowIso);
    insertMember.run(MEMBERSHIPS.priya, ORG, USERS.priya, "student", "Member", nowIso);
    insertMember.run(MEMBERSHIPS.dev, ORG, USERS.dev, "student", "Member", nowIso);

    const insertQualification = db.prepare(
      `INSERT INTO user_qualifications
        (id, user_id, organization_id, kind, name, status, verified_by, verified_at, expires_at, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    insertQualification.run(
      QUALIFICATIONS.arjunPrint,
      USERS.arjun,
      ORG,
      "training_certificate",
      "3D Printing Safety",
      "verified",
      USERS.maya,
      addDays(nowIso, -90),
      addDays(nowIso, 275),
      "Completed nozzle, material handling and fire-safety induction.",
      addDays(nowIso, -90),
    );
    insertQualification.run(
      QUALIFICATIONS.arjunElectronics,
      USERS.arjun,
      ORG,
      "lab_badge",
      "Electronics Bench Safety",
      "verified",
      USERS.maya,
      addDays(nowIso, -60),
      addDays(nowIso, 305),
      "Bench power, probing and ESD protocol assessed.",
      addDays(nowIso, -60),
    );
    insertQualification.run(
      QUALIFICATIONS.arjunMaterialsPending,
      USERS.arjun,
      ORG,
      "training_certificate",
      "Materials Lab Certification",
      "pending",
      null,
      null,
      null,
      "Practical assessment scheduled with the materials lab.",
      addDays(nowIso, -2),
    );
    insertQualification.run(
      QUALIFICATIONS.priyaPrint,
      USERS.priya,
      ORG,
      "training_certificate",
      "3D Printing Safety",
      "verified",
      USERS.maya,
      addDays(nowIso, -40),
      addDays(nowIso, 325),
      null,
      addDays(nowIso, -40),
    );
    insertQualification.run(
      QUALIFICATIONS.priyaElectronics,
      USERS.priya,
      ORG,
      "lab_badge",
      "Electronics Bench Safety",
      "verified",
      USERS.maya,
      addDays(nowIso, -35),
      addDays(nowIso, 330),
      null,
      addDays(nowIso, -35),
    );
    insertQualification.run(
      QUALIFICATIONS.priyaCamera,
      USERS.priya,
      ORG,
      "lab_badge",
      "Camera Handling Checkout",
      "verified",
      USERS.maya,
      addDays(nowIso, -20),
      addDays(nowIso, 345),
      null,
      addDays(nowIso, -20),
    );
    insertQualification.run(
      QUALIFICATIONS.devPrint,
      USERS.dev,
      ORG,
      "training_certificate",
      "3D Printing Safety",
      "verified",
      USERS.maya,
      addDays(nowIso, -70),
      addDays(nowIso, 295),
      null,
      addDays(nowIso, -70),
    );

    const insertResource = db.prepare(
      `INSERT INTO resources
        (id, organization_id, owner_id, name, category, description, location, status,
         max_duration_hours, fair_use_limit, usage_rules, condition_summary, eligibility_note,
         created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    insertResource.run(
      RESOURCES.printer,
      ORG,
      USERS.maya,
      "Bambu Lab X1 Carbon",
      "3d-printing",
      "Enclosed FDM printer with AMS multi-material unit, hardened nozzle and camera monitoring. Ideal for functional prototypes and detailed enclosures.",
      "Maker Wing · Room C-104 · Bay 2",
      "active",
      6,
      2,
      "Run the 3D-printing safety checklist before slicing. Use Northstar PLA/PETG stock only. Remove supports at the finishing bench, not inside the printer bay. Log failed prints in the booking timeline.",
      "Excellent — nozzle replaced 12 Oct, bed mesh calibrated weekly. AMS slot 3 is reserved for support material.",
      "3D Printing Safety verification is required. First-time users must complete a 15-minute bay induction with the steward.",
      addDays(nowIso, -120),
      addDays(nowIso, -5),
    );
    insertResource.run(
      RESOURCES.oscilloscope,
      ORG,
      USERS.maya,
      "Rigol DS1054Z Oscilloscope",
      "electronics",
      "Four-channel 50 MHz digital oscilloscope with probes, logic analyser and a dedicated ESD-safe bench. Suitable for embedded bring-up and signal debug.",
      "Maker Wing · Electronics Bench E-2",
      "active",
      4,
      2,
      "Use the ESD wrist strap. Inspect probes before connecting. Do not exceed 300 V CAT II. Return probes to the correct pouch and clear the bench.",
      "Good — all four channels verified during the October calibration; one 10× probe has a scuffed clip.",
      "Electronics Bench Safety badge required.",
      addDays(nowIso, -200),
      addDays(nowIso, -10),
    );
    insertResource.run(
      RESOURCES.openBench,
      ORG,
      USERS.maya,
      "Open Maker Bench 04",
      "workspace",
      "A flexible 1.8 m workbench with power, task lighting, hand tools and a mobile vice. Book it for assembly, soldering-free fit checks or collaborative build sessions.",
      "Maker Wing · Open Floor · Bench 04",
      "active",
      8,
      2,
      "Keep solvents out of the open floor. Return hand tools to the shadow board. Leave the bench clear at the end of your slot. Food and drink must stay sealed.",
      "Good — bench surface refinished in September. Vice and task lamp functional.",
      "Open to all active Northstar members. No additional qualification required.",
      addDays(nowIso, -150),
      addDays(nowIso, -3),
    );
    insertResource.run(
      RESOURCES.tester,
      ORG,
      USERS.maya,
      "50 kN Universal Testing Machine",
      "testing",
      "Dual-column universal tester for tensile, compression and flexural characterisation of coupons and small assemblies.",
      "Materials Lab · Room M-2",
      "active",
      3,
      1,
      "Only coupon-sized specimens. Submit the test plan before loading. Never operate without the materials technician present. Log fixture changes.",
      "Excellent — load cell calibrated 02 Oct. Safety shield and emergency stop tested.",
      "Materials Lab Certification is required and verified by the materials technician.",
      addDays(nowIso, -250),
      addDays(nowIso, -20),
    );
    insertResource.run(
      RESOURCES.camera,
      ORG,
      USERS.maya,
      "Canon EOS R6 Documentary Kit",
      "imaging",
      "Full-frame mirrorless body with 24–105 mm lens, two batteries, dual charger, 128 GB card and a weather-sealed carry case for field documentation.",
      "Media Store · Room A-011",
      "active",
      8,
      1,
      "Never leave the kit unattended. Use the strap at all times. Format the card only after footage is copied. Report any moisture exposure immediately.",
      "Good — sensor clean, 4,812 shutter actuations. Lens hood has a cosmetic scuff.",
      "Camera Handling Checkout required. Collection and return must happen inside Media Store hours.",
      addDays(nowIso, -300),
      addDays(nowIso, -15),
    );
    insertResource.run(
      RESOURCES.robot,
      ORG,
      USERS.riya,
      "Collaborative Robot Cell",
      "robotics",
      "Six-axis collaborative arm in a fenced cell with teach pendant, gripper set and compressed-air supply for manipulation research.",
      "Robotics Lab · Cell R-1",
      "active",
      4,
      1,
      "Two-person rule applies whenever the cell is energised. Reduced-speed mode only outside supervised research sessions. Never bypass the light curtain.",
      "Good — gripper jaws inspected 18 Oct. Fence interlock test due next month.",
      "Robotics Cell Orientation required. Access is limited to scheduled supervised sessions.",
      addDays(nowIso, -180),
      addDays(nowIso, -12),
    );
    insertResource.run(
      RESOURCES.laser,
      ORG,
      USERS.maya,
      "Epilog Zing Laser Cutter",
      "fabrication",
      "40 W CO₂ laser cutter for plywood, acrylic and card stock, with exhaust filtration and a 610 × 305 mm bed.",
      "Maker Wing · Room C-102",
      "paused",
      2,
      2,
      "Never cut PVC, polycarbonate or unknown plastics. Keep the lid closed during operation. Stay with the machine for the entire job.",
      "Paused for exhaust servicing — do not operate until the steward reopens the bay.",
      "Laser Safety certification required. Currently paused pending extraction maintenance.",
      addDays(nowIso, -220),
      addDays(nowIso, -1),
    );

    const insertRequirement = db.prepare(
      `INSERT INTO resource_requirements (id, resource_id, kind, label, description, is_required, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    let requirementNumber = 1;
    const requirementRows: Array<[string, string, string, string, number]> = [
      [RESOURCES.printer, "qualification", "3D Printing Safety", "Verified bay induction and material-handling assessment.", 1],
      [RESOURCES.oscilloscope, "qualification", "Electronics Bench Safety", "Bench power, probing and ESD assessment.", 1],
      [RESOURCES.openBench, "membership", "Active Northstar membership", "Open to current students, researchers and staff.", 1],
      [RESOURCES.tester, "qualification", "Materials Lab Certification", "Practical assessment with the materials technician.", 1],
      [RESOURCES.camera, "qualification", "Camera Handling Checkout", "Sensor care, media handling and checkout protocol.", 1],
      [RESOURCES.robot, "qualification", "Robotics Cell Orientation", "Fenced-cell safety and two-person rule briefing.", 1],
      [RESOURCES.laser, "qualification", "Laser Safety", "Extraction, materials and fire-safety induction.", 1],
    ];
    for (const [resourceId, kind, label, description, required] of requirementRows) {
      insertRequirement.run(
        id("4a", requirementNumber++),
        resourceId,
        kind,
        label,
        description,
        required,
        nowIso,
      );
    }

    const insertWindow = db.prepare(
      `INSERT INTO availability_windows (id, resource_id, weekday, start_minute, end_minute, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    let windowNumber = 1;
    const addWindows = (
      resourceId: string,
      weekdays: number[],
      startMinute: number,
      endMinute: number,
    ) => {
      for (const weekday of weekdays) {
        insertWindow.run(
          id("6a", windowNumber++),
          resourceId,
          weekday,
          startMinute,
          endMinute,
          nowIso,
        );
      }
    };
    addWindows(RESOURCES.printer, [0, 1, 2, 3, 4, 5, 6], 8 * 60, 22 * 60);
    addWindows(RESOURCES.oscilloscope, [1, 2, 3, 4, 5, 6], 9 * 60, 21 * 60);
    addWindows(RESOURCES.openBench, [0, 1, 2, 3, 4, 5, 6], 0, 1440);
    addWindows(RESOURCES.tester, [1, 2, 3, 4, 5], 10 * 60, 17 * 60);
    addWindows(RESOURCES.camera, [1, 2, 3, 4, 5], 9 * 60, 17 * 60);
    addWindows(RESOURCES.robot, [2, 4], 13 * 60, 19 * 60);
    addWindows(RESOURCES.laser, [1, 2, 3, 4, 5], 9 * 60, 18 * 60);

    db.prepare(
      `INSERT INTO resource_blackouts (id, resource_id, starts_at, ends_at, reason, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      id("6b", 1),
      RESOURCES.printer,
      blackoutStart,
      blackoutEnd,
      "Preventive nozzle and belt service",
      addDays(nowIso, -2),
    );

    const insertBooking = db.prepare(
      `INSERT INTO bookings
        (id, resource_id, borrower_id, organization_id, starts_at, ends_at, purpose, notes,
         status, decision_reason, decided_by, decided_at, cancelled_at, checked_in_at,
         return_submitted_at, completed_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    insertBooking.run(
      BOOKINGS.arjunPending,
      RESOURCES.openBench,
      USERS.arjun,
      ORG,
      pendingStart,
      pendingEnd,
      "Fit-check the sensor enclosure for our capstone rover",
      "I need a clear bench and access to the small vice. I will bring my own fastener tray.",
      "pending",
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      addMinutes(nowIso, -30),
      addMinutes(nowIso, -30),
    );

    insertBooking.run(
      BOOKINGS.devApproved,
      RESOURCES.printer,
      USERS.dev,
      ORG,
      walkInStart,
      walkInEnd,
      "Print the gearbox housing for the design review",
      "PETG, approximately 5 hours including purge.",
      "approved",
      "Slot is free and the safety credential is verified.",
      USERS.maya,
      addMinutes(nowIso, -180),
      null,
      null,
      null,
      null,
      addMinutes(nowIso, -240),
      addMinutes(nowIso, -180),
    );

    insertBooking.run(
      BOOKINGS.priyaWaitlisted,
      RESOURCES.printer,
      USERS.priya,
      ORG,
      walkInStart,
      walkInEnd,
      "Print flexible gripper fingers for the robotics cell",
      null,
      "waitlisted",
      "The bay is already committed to a capstone print at this time. You are first in line if that slot is released.",
      USERS.maya,
      addMinutes(nowIso, -150),
      null,
      null,
      null,
      null,
      addMinutes(nowIso, -210),
      addMinutes(nowIso, -150),
    );

    insertBooking.run(
      BOOKINGS.arjunCheckedIn,
      RESOURCES.oscilloscope,
      USERS.arjun,
      ORG,
      checkedInStart,
      checkedInEnd,
      "Debug the I²C bus on the rover motor controller",
      "Using channel 1 and 2 with the short ground springs.",
      "checked_in",
      "Eligibility confirmed; slot available.",
      USERS.maya,
      addHours(checkedInStart, -6),
      null,
      checkedInStart,
      null,
      null,
      addHours(checkedInStart, -24),
      checkedInStart,
    );

    insertBooking.run(
      BOOKINGS.arjunCompleted,
      RESOURCES.openBench,
      USERS.arjun,
      ORG,
      historyStart,
      historyEnd,
      "Assemble the first rover chassis prototype",
      null,
      "completed",
      "Approved for the requested window.",
      USERS.maya,
      addDays(historyStart, -1),
      null,
      historyStart,
      addMinutes(historyEnd, 8),
      addMinutes(historyEnd, 45),
      addDays(historyStart, -2),
      addMinutes(historyEnd, 45),
    );

    const insertEvent = db.prepare(
      `INSERT INTO booking_events (id, booking_id, actor_id, kind, summary, metadata_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    const event = (
      bookingId: string,
      actorId: string | null,
      kind: string,
      summary: string,
      createdAt: string,
      metadata?: Record<string, unknown>,
    ) => {
      insertEvent.run(
        randomUUID(),
        bookingId,
        actorId,
        kind,
        summary,
        metadata ? JSON.stringify(metadata) : null,
        createdAt,
      );
    };

    event(
      BOOKINGS.arjunPending,
      USERS.arjun,
      "submitted",
      "Booking request submitted for owner review.",
      addMinutes(nowIso, -30),
    );
    event(
      BOOKINGS.arjunPending,
      USERS.arjun,
      "eligibility_checked",
      "All required eligibility rules passed at submission.",
      addMinutes(nowIso, -30),
      { eligible: true, mode: "request" },
    );

    event(
      BOOKINGS.devApproved,
      USERS.dev,
      "submitted",
      "Booking request submitted for owner review.",
      addMinutes(nowIso, -240),
    );
    event(
      BOOKINGS.devApproved,
      USERS.maya,
      "approved",
      "Approved after eligibility and schedule review.",
      addMinutes(nowIso, -180),
    );

    event(
      BOOKINGS.priyaWaitlisted,
      USERS.priya,
      "submitted",
      "Booking request submitted for owner review.",
      addMinutes(nowIso, -210),
    );
    event(
      BOOKINGS.priyaWaitlisted,
      USERS.maya,
      "waitlisted",
      "Waitlisted: the bay is committed to another approved print at this time.",
      addMinutes(nowIso, -150),
      { position: 1 },
    );

    event(
      BOOKINGS.arjunCheckedIn,
      USERS.arjun,
      "submitted",
      "Booking request submitted for owner review.",
      addHours(checkedInStart, -24),
    );
    event(
      BOOKINGS.arjunCheckedIn,
      USERS.maya,
      "approved",
      "Approved after eligibility and schedule review.",
      addHours(checkedInStart, -6),
    );
    event(
      BOOKINGS.arjunCheckedIn,
      USERS.arjun,
      "checked_in",
      "Checked in with an initial condition report. Custody transferred to the borrower.",
      checkedInStart,
    );

    event(
      BOOKINGS.arjunCompleted,
      USERS.arjun,
      "submitted",
      "Booking request submitted for owner review.",
      addDays(historyStart, -2),
    );
    event(
      BOOKINGS.arjunCompleted,
      USERS.maya,
      "approved",
      "Approved after eligibility and schedule review.",
      addDays(historyStart, -1),
    );
    event(
      BOOKINGS.arjunCompleted,
      USERS.arjun,
      "checked_in",
      "Checked in with an initial condition report. Custody transferred to the borrower.",
      historyStart,
    );
    event(
      BOOKINGS.arjunCompleted,
      USERS.arjun,
      "return_submitted",
      "Return submitted with final condition notes.",
      addMinutes(historyEnd, 8),
    );
    event(
      BOOKINGS.arjunCompleted,
      USERS.maya,
      "return_confirmed",
      "Owner confirmed the return. Custody closed.",
      addMinutes(historyEnd, 45),
    );

    const insertCondition = db.prepare(
      `INSERT INTO condition_reports
        (id, booking_id, phase, condition, accessories_ok, notes, photo_url, submitted_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
    );
    insertCondition.run(
      CONDITIONS.checkInOscilloscope,
      BOOKINGS.arjunCheckedIn,
      "check_in",
      "good",
      1,
      "All four probes present. One probe clip shows existing scuff. Bench lamp working.",
      USERS.arjun,
      checkedInStart,
    );
    insertCondition.run(
      CONDITIONS.checkInBench,
      BOOKINGS.arjunCompleted,
      "check_in",
      "good",
      1,
      "Bench clear, vice mounted, task lamp working.",
      USERS.arjun,
      historyStart,
    );
    insertCondition.run(
      CONDITIONS.checkOutBench,
      BOOKINGS.arjunCompleted,
      "check_out",
      "fair",
      1,
      "Assembly completed. Light adhesive residue on the rear edge; cleaned most of it. Vice returned.",
      USERS.arjun,
      addMinutes(historyEnd, 8),
    );

    const insertIncident = db.prepare(
      `INSERT INTO incidents
        (id, booking_id, resource_id, reporter_id, type, severity, description, status,
         resolution_notes, resolved_by, resolved_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    insertIncident.run(
      INCIDENTS.resolvedAccessory,
      BOOKINGS.arjunCompleted,
      RESOURCES.openBench,
      USERS.arjun,
      "missing_accessory",
      "low",
      "The small F-clamp that normally lives on the bench shadow board was missing at check-in. I used my own clamp and returned it.",
      "resolved",
      "Clamp was recovered from the finishing bay. No borrower fault recorded. Shadow-board labels reissued.",
      USERS.maya,
      addDays(nowIso, -2),
      addDays(historyStart, -1),
      addDays(nowIso, -2),
    );
    insertIncident.run(
      INCIDENTS.openLaser,
      null,
      RESOURCES.laser,
      USERS.priya,
      "other",
      "medium",
      "The laser cutter extraction indicator was amber during my induction walk-through. The bay is already marked paused, but the filter service log on the door is from August.",
      "reviewing",
      null,
      null,
      null,
      addDays(nowIso, -1),
      addDays(nowIso, -1),
    );

    event(
      BOOKINGS.arjunCompleted,
      USERS.arjun,
      "incident_opened",
      "Missing accessory reported. A human review is required; no penalty applied automatically.",
      addDays(historyStart, -1),
    );
    event(
      BOOKINGS.arjunCompleted,
      USERS.maya,
      "incident_resolved",
      "Incident resolved: clamp recovered; no fault recorded.",
      addDays(nowIso, -2),
    );

    const insertNotification = db.prepare(
      `INSERT INTO notifications (id, user_id, kind, title, body, href, read_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const notification = (
      userId: string,
      kind: string,
      title: string,
      body: string,
      href: string,
      readAt: string | null,
      createdAt: string,
    ) => {
      insertNotification.run(
        randomUUID(),
        userId,
        kind,
        title,
        body,
        href,
        readAt,
        createdAt,
      );
    };
    notification(
      USERS.maya,
      "request_submitted",
      "New request · Open Maker Bench 04",
      "Arjun Mehta requested an open-floor bench. Eligibility checks passed; owner review is required.",
      `/owner/requests`,
      null,
      addMinutes(nowIso, -30),
    );
    notification(
      USERS.priya,
      "waitlist_placed",
      "Waitlisted · Bambu Lab X1 Carbon",
      "You are first in line for the requested slot. If the approved booking is released, your request returns to owner review — it is never auto-approved.",
      `/bookings/${BOOKINGS.priyaWaitlisted}`,
      null,
      addMinutes(nowIso, -150),
    );
    notification(
      USERS.arjun,
      "return_confirmed",
      "Return confirmed · Open Maker Bench 04",
      "Maya Iyer confirmed your return. Your custody record is complete.",
      `/bookings/${BOOKINGS.arjunCompleted}`,
      addDays(nowIso, -2),
      addMinutes(historyEnd, 45),
    );
    notification(
      USERS.arjun,
      "welcome",
      "Welcome to LabLoop",
      "Your 3D Printing Safety and Electronics Bench Safety credentials are verified. You can request eligible resources now.",
      `/dashboard`,
      addDays(nowIso, -5),
      addDays(nowIso, -5),
    );
    notification(
      USERS.maya,
      "incident_opened",
      "Incident needs review · Laser Cutter",
      "Priya Nair reported an extraction indicator concern. The resource remains paused pending human review.",
      `/owner/incidents`,
      null,
      addDays(nowIso, -1),
    );

    logAudit(db, {
      organizationId: ORG,
      actorId: USERS.maya,
      action: "organization.created",
      entityType: "organization",
      entityId: ORG,
      summary: "Northstar maker resources onboarded to LabLoop.",
      createdAt: addDays(nowIso, -120),
    });
    logAudit(db, {
      organizationId: ORG,
      actorId: USERS.maya,
      action: "resource.created",
      entityType: "resource",
      entityId: RESOURCES.printer,
      summary: "Listed Bambu Lab X1 Carbon for supervised member access.",
      createdAt: addDays(nowIso, -120),
    });
    logAudit(db, {
      organizationId: ORG,
      actorId: USERS.riya,
      action: "resource.created",
      entityType: "resource",
      entityId: RESOURCES.robot,
      summary: "Listed the Collaborative Robot Cell with supervised-session rules.",
      createdAt: addDays(nowIso, -180),
    });
    logAudit(db, {
      organizationId: ORG,
      actorId: USERS.arjun,
      action: "booking.submitted",
      entityType: "booking",
      entityId: BOOKINGS.arjunPending,
      summary: "Request submitted for Open Maker Bench 04.",
      createdAt: addMinutes(nowIso, -30),
    });
    logAudit(db, {
      organizationId: ORG,
      actorId: USERS.maya,
      action: "booking.waitlisted",
      entityType: "booking",
      entityId: BOOKINGS.priyaWaitlisted,
      summary: "Waitlisted a competing print request with a written reason.",
      createdAt: addMinutes(nowIso, -150),
    });
    logAudit(db, {
      organizationId: ORG,
      actorId: USERS.maya,
      action: "booking.return_confirmed",
      entityType: "booking",
      entityId: BOOKINGS.arjunCompleted,
      summary: "Confirmed the return of Open Maker Bench 04 and closed custody.",
      createdAt: addMinutes(historyEnd, 45),
    });
    logAudit(db, {
      organizationId: ORG,
      actorId: USERS.maya,
      action: "incident.resolved",
      entityType: "incident",
      entityId: INCIDENTS.resolvedAccessory,
      summary: "Resolved a missing-accessory incident with no borrower penalty.",
      createdAt: addDays(nowIso, -2),
    });
  });

  seed.immediate();

  return {
    seeded: true,
    organizationId: ORG,
    message: "Seeded fictional Northstar demo institution and lifecycle records.",
  };
}
