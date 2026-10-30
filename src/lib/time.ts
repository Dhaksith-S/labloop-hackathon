/**
 * Timezone helpers for LabLoop.
 *
 * The demo institution operates in Asia/Kolkata (UTC+05:30, no daylight
 * saving). Every timestamp is persisted as an ISO-8601 UTC string; conversion
 * happens only at the presentation and form-boundary layers.
 */

export const INSTITUTION_TIMEZONE = "Asia/Kolkata";
const IST_OFFSET_MINUTES = 330;

export function nowIso(): string {
  return new Date().toISOString();
}

export function addMinutes(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}

export function addHours(iso: string, hours: number): string {
  return addMinutes(iso, hours * 60);
}

export function addDays(iso: string, days: number): string {
  return addHours(iso, days * 24);
}

export function isValidIso(value: string): boolean {
  return !Number.isNaN(new Date(value).getTime());
}

/** A Date whose UTC getters represent wall-clock time in Asia/Kolkata. */
function toIstClock(iso: string): Date {
  return new Date(new Date(iso).getTime() + IST_OFFSET_MINUTES * 60_000);
}

export function istDateKey(iso: string): string {
  return toIstClock(iso).toISOString().slice(0, 10);
}

export function istWeekday(iso: string): number {
  return toIstClock(iso).getUTCDay();
}

export function istMinuteOfDay(iso: string): number {
  const clock = toIstClock(iso);
  return clock.getUTCHours() * 60 + clock.getUTCMinutes();
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: INSTITUTION_TIMEZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: INSTITUTION_TIMEZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: INSTITUTION_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}

export function formatTimeRange(startIso: string, endIso: string): string {
  return `${formatTime(startIso)} – ${formatTime(endIso)}`;
}

export function formatDateTimeRange(startIso: string, endIso: string): string {
  return `${formatDate(startIso)} · ${formatTimeRange(startIso, endIso)}`;
}

export function formatDuration(startIso: string, endIso: string): string {
  const minutes = Math.max(
    0,
    Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60_000),
  );
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  if (rest === 0) return `${hours} hr${hours === 1 ? "" : "s"}`;
  return `${hours} hr ${rest} min`;
}

export function formatRelative(iso: string, now = new Date()): string {
  const deltaSeconds = Math.round((new Date(iso).getTime() - now.getTime()) / 1000);
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 31_536_000],
    ["month", 2_592_000],
    ["week", 604_800],
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
    ["second", 1],
  ];
  for (const [unit, seconds] of units) {
    if (Math.abs(deltaSeconds) >= seconds || unit === "second") {
      return formatter.format(Math.round(deltaSeconds / seconds), unit);
    }
  }
  return "now";
}

/** Convert a stored UTC ISO value to a `datetime-local` input value in IST. */
export function toDateTimeLocalValue(iso: string): string {
  return toIstClock(iso).toISOString().slice(0, 16);
}

/** Interpret a `datetime-local` value as Asia/Kolkata wall time and return UTC ISO. */
export function fromDateTimeLocalValue(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match) throw new Error("INVALID_DATETIME_LOCAL");
  const [, year, month, day, hour, minute, second = "00"] = match;
  const utcMs =
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
    ) -
    IST_OFFSET_MINUTES * 60_000;
  return new Date(utcMs).toISOString();
}

/** Round a timestamp up to the next 5-minute boundary (IST-independent). */
export function roundUpToFiveMinutes(iso: string): string {
  const ms = new Date(iso).getTime();
  const five = 5 * 60_000;
  return new Date(Math.ceil(ms / five) * five).toISOString();
}

export function sameIstDay(startIso: string, endIso: string): boolean {
  return istDateKey(startIso) === istDateKey(endIso);
}

/** Human-readable label for a weekly availability window. */
export function formatMinuteOfDay(minute: number): string {
  const hour24 = Math.floor(minute / 60) % 24;
  const mins = minute % 60;
  const meridiem = hour24 >= 12 ? "pm" : "am";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}${mins ? `:${String(mins).padStart(2, "0")}` : ""}${meridiem}`;
}

export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const WEEKDAY_LONG_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
