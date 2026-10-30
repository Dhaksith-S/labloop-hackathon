import type { AvailabilityRow, BlackoutRow } from "@/lib/db-types";
import {
  WEEKDAY_LABELS,
  addDays,
  formatMinuteOfDay,
  fromDateTimeLocalValue,
  istDateKey,
  istMinuteOfDay,
} from "@/lib/time";

export interface AvailabilityGroup {
  days: string;
  start: string;
  end: string;
  startMinute: number;
  endMinute: number;
}

function groupKey(row: Pick<AvailabilityRow, "start_minute" | "end_minute">): string {
  return `${row.start_minute}-${row.end_minute}`;
}

function dayRange(weekdays: number[]): string {
  if (weekdays.length === 7) return "Every day";
  const sorted = [...new Set(weekdays)].sort((a, b) => a - b);
  if (sorted.length === 5 && sorted.join(",") === "1,2,3,4,5") return "Mon–Fri";
  if (sorted.length === 6 && sorted.join(",") === "1,2,3,4,5,6") return "Mon–Sat";
  return sorted.map((day) => WEEKDAY_LABELS[day]).join(", ");
}

export function groupAvailability(
  rows: Array<Pick<AvailabilityRow, "weekday" | "start_minute" | "end_minute">>,
): AvailabilityGroup[] {
  const groups = new Map<string, number[]>();
  for (const row of rows) {
    const key = groupKey(row);
    groups.set(key, [...(groups.get(key) ?? []), row.weekday]);
  }
  return [...groups.entries()]
    .map(([key, weekdays]) => {
      const [startMinute, endMinute] = key.split("-").map(Number);
      return {
        days: dayRange(weekdays),
        start: startMinute === 0 && endMinute === 1440 ? "24 hours" : formatMinuteOfDay(startMinute),
        end: startMinute === 0 && endMinute === 1440 ? "" : formatMinuteOfDay(endMinute),
        startMinute,
        endMinute,
      };
    })
    .sort((a, b) => a.startMinute - b.startMinute);
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function localValue(dateKey: string, minute: number): string {
  const hour = Math.floor(minute / 60);
  const mins = minute % 60;
  return `${dateKey}T${pad(hour)}:${pad(mins)}`;
}

/**
 * Suggest the next bookable slot as `datetime-local` values in institutional
 * time. Used to pre-fill the request form so a judge is not left guessing.
 */
export function suggestLocalSlot({
  availability,
  blackouts = [],
  now,
  durationMinutes = 90,
  maxDurationHours = 4,
}: {
  availability: Array<Pick<AvailabilityRow, "weekday" | "start_minute" | "end_minute">>;
  blackouts?: Array<Pick<BlackoutRow, "starts_at" | "ends_at">>;
  now: string;
  durationMinutes?: number;
  maxDurationHours?: number;
}): { startsAt: string; endsAt: string } | null {
  if (availability.length === 0) return null;
  const duration = Math.min(durationMinutes, maxDurationHours * 60);
  for (let offset = 0; offset <= 8; offset += 1) {
    const dayIso = addDays(now, offset);
    const dateKey = istDateKey(dayIso);
    const weekday = new Date(`${dateKey}T00:00:00Z`).getUTCDay();
    const windows = availability
      .filter((window) => window.weekday === weekday)
      .sort((a, b) => a.start_minute - b.start_minute);
    for (const window of windows) {
      const earliest = offset === 0 ? istMinuteOfDay(dayIso) + 30 : window.start_minute;
      let start = Math.max(window.start_minute, earliest);
      start = Math.ceil(start / 15) * 15;
      if (start + 30 > window.end_minute) continue;
      const end = Math.min(window.end_minute, start + duration, 23 * 60 + 45);
      if (end - start < 30) continue;
      const startsAt = localValue(dateKey, start);
      const endsAt = localValue(dateKey, end);
      let startIso: string;
      let endIso: string;
      try {
        startIso = fromDateTimeLocalValue(startsAt);
        endIso = fromDateTimeLocalValue(endsAt);
      } catch {
        continue;
      }
      const inBlackout = blackouts.some(
        (blackout) => startIso < blackout.ends_at && endIso > blackout.starts_at,
      );
      if (inBlackout) continue;
      return { startsAt, endsAt };
    }
  }
  return null;
}

export function summarizeAvailability(
  rows: Array<Pick<AvailabilityRow, "weekday" | "start_minute" | "end_minute">>,
): string {
  if (rows.length === 0) return "No hours published";
  const has24x7 =
    rows.length === 7 && rows.every((row) => row.start_minute === 0 && row.end_minute === 1440);
  if (has24x7) return "Open 24/7";
  const groups = groupAvailability(rows);
  if (groups.length === 1) {
    const group = groups[0];
    return group.start === "24 hours"
      ? `${group.days} · 24 hours`
      : `${group.days} · ${group.start}–${group.end}`;
  }
  return `${groups.length} weekly windows`;
}
