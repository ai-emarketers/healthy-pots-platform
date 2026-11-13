/**
 * All service dates are calendar dates in IST. We store them as UTC-midnight Dates
 * (Postgres DATE), so "2026-11-13" is always the IST day 13 Nov regardless of server timezone.
 */
// IST is UTC+5:30, expressed in milliseconds
const IST_MS = 5.5 * 3600 * 1000;
// Milliseconds in one day
const DAY = 86400000;

// "2026-11-13" -> Date at UTC midnight (our canonical way to hold a calendar date)
export const parseDate = (s: string): Date => new Date(`${s}T00:00:00.000Z`);
// Date -> "YYYY-MM-DD"
export const iso = (d: Date): string => d.toISOString().slice(0, 10);
// Add (or subtract) whole days
export const addDays = (d: Date, n: number): Date => new Date(d.getTime() + n * DAY);

/** Today's IST calendar date. */
// Today's date as seen in India, even if the server runs in another timezone
export function istToday(now = new Date()): Date {
  // Shift the clock to IST, then read the UTC parts as IST parts
  const t = new Date(now.getTime() + IST_MS);
  return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()));
}

/** Customer changes for a service date close at 5:00 PM IST on the previous day (inclusive). */
// Moment when changes close: 5 PM IST on the day BEFORE the service date
export function cutoffFor(service: Date): Date {
  // previous midnight UTC + 17h - 5.5h = 5 PM IST expressed in UTC
  return new Date(addDays(service, -1).getTime() + (17 * 3600 - IST_MS / 1000) * 1000);
}

/** Inclusive cutoff: a request at exactly 5:00:00 PM IST is still accepted; 5:00:01 PM is locked. */
// True once "now" is past the cutoff (exactly 5:00:00 PM is still allowed)
export const isLocked = (service: Date, now = new Date()): boolean => now.getTime() > cutoffFor(service).getTime();

// Business calendar: which weekdays we deliver and which dates are closed
export interface Calendar {
  operatingDays: number[]; // 0 = Sunday
  closures: Set<string>; // ISO dates
}

// A delivery day = operating weekday AND not a closure date
export const isDeliveryDay = (d: Date, cal: Calendar): boolean =>
  cal.operatingDays.includes(d.getUTCDay()) && !cal.closures.has(iso(d));

/** First delivery day on or after `from`. */
// Walks forward day by day until a delivery day (400-day safety limit)
export function nextDeliveryDay(from: Date, cal: Calendar): Date {
  let d = from;
  for (let i = 0; i < 400 && !isDeliveryDay(d, cal); i++) d = addDays(d, 1);
  return d;
}

/** `count` consecutive delivery days starting on or after `start`. */
// Returns N delivery days in a row (skipping Sundays/closures)
export function deliveryDays(start: Date, count: number, cal: Calendar): Date[] {
  // Collected dates
  const out: Date[] = [];
  let d = nextDeliveryDay(start, cal);
  // Keep adding until we have enough
  while (out.length < count) {
    out.push(d);
    d = nextDeliveryDay(addDays(d, 1), cal);
  }
  return out;
}

/** Next bookable day: the first delivery day whose cutoff has not passed. */
// Earliest day a new customer can start: a delivery day whose cutoff has not passed
export function nextBookableDay(cal: Calendar, now = new Date()): Date {
  let d = nextDeliveryDay(istToday(now), cal);
  // Skip days that are already locked
  while (isLocked(d, now)) d = nextDeliveryDay(addDays(d, 1), cal);
  return d;
}
