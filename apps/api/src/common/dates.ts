/**
 * All service dates are calendar dates in IST. We store them as UTC-midnight Dates
 * (Postgres DATE), so "2026-11-13" is always the IST day 13 Nov regardless of server timezone.
 */
const IST_MS = 5.5 * 3600 * 1000;
const DAY = 86400000;

export const parseDate = (s: string): Date => new Date(`${s}T00:00:00.000Z`);
export const iso = (d: Date): string => d.toISOString().slice(0, 10);
export const addDays = (d: Date, n: number): Date => new Date(d.getTime() + n * DAY);

/** Today's IST calendar date. */
export function istToday(now = new Date()): Date {
  const t = new Date(now.getTime() + IST_MS);
  return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()));
}

/** Customer changes for a service date close at 5:00 PM IST on the previous day (inclusive). */
export function cutoffFor(service: Date): Date {
  return new Date(addDays(service, -1).getTime() + (17 * 3600 - IST_MS / 1000) * 1000);
}

/** Inclusive cutoff: a request at exactly 5:00:00 PM IST is still accepted; 5:00:01 PM is locked. */
export const isLocked = (service: Date, now = new Date()): boolean => now.getTime() > cutoffFor(service).getTime();

export interface Calendar {
  operatingDays: number[]; // 0 = Sunday
  closures: Set<string>; // ISO dates
}

export const isDeliveryDay = (d: Date, cal: Calendar): boolean =>
  cal.operatingDays.includes(d.getUTCDay()) && !cal.closures.has(iso(d));

/** First delivery day on or after `from`. */
export function nextDeliveryDay(from: Date, cal: Calendar): Date {
  let d = from;
  for (let i = 0; i < 400 && !isDeliveryDay(d, cal); i++) d = addDays(d, 1);
  return d;
}

/** `count` consecutive delivery days starting on or after `start`. */
export function deliveryDays(start: Date, count: number, cal: Calendar): Date[] {
  const out: Date[] = [];
  let d = nextDeliveryDay(start, cal);
  while (out.length < count) {
    out.push(d);
    d = nextDeliveryDay(addDays(d, 1), cal);
  }
  return out;
}

/** Next bookable day: the first delivery day whose cutoff has not passed. */
export function nextBookableDay(cal: Calendar, now = new Date()): Date {
  let d = nextDeliveryDay(istToday(now), cal);
  while (isLocked(d, now)) d = nextDeliveryDay(addDays(d, 1), cal);
  return d;
}
