'use client';
/** Browser API helper, data-loading hook and display formatters. */
// React hooks used by useApi below
import { useCallback, useEffect, useState } from 'react';

// Error that also carries the HTTP status code
export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

/** All calls go through the Next.js proxy (/backend -> NestJS /api) so the auth cookie stays first-party. */
// The one function every screen uses to call the backend
export async function api<T = any>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  // Calls /backend/... (proxied to the API). POST is used automatically when a body is given
  const res = await fetch(`/backend${path}`, {
    method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'),
    headers: opts.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    // Send the login cookie with every call
    credentials: 'same-origin',
  });
  // Session expired / not logged in -> go to the login page (except for the auth calls themselves)
  if (res.status === 401 && typeof window !== 'undefined' && !path.startsWith('/auth/')) {
    window.location.href = '/login';
  }
  // Read the body as text first so empty responses do not crash JSON.parse
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  // HTTP error: turn the API's message into an ApiError
  if (!res.ok) {
    const m = data?.message;
    throw new ApiError(Array.isArray(m) ? m.join(', ') : m || res.statusText, res.status);
  }
  return data as T;
}

// Hook: loads data from a path and gives { data, error, loading, reload }
export function useApi<T = any>(path: string | null) {
  // Loaded data
  const [data, setData] = useState<T | undefined>();
  // Error message, if any
  const [error, setError] = useState<string | undefined>();
  // True while a request is running (starts true if a path is given)
  const [loading, setLoading] = useState(!!path);
  // Fetches the data again (also used after a button action changes something)
  const reload = useCallback(async () => {
    // Pass null to skip loading (e.g. waiting for a selection)
    if (!path) return;
    setLoading(true);
    try {
      setData(await api<T>(path));
      setError(undefined);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [path]);
  // Load automatically when the path changes
  useEffect(() => {
    reload();
  }, [reload]);
  // What components receive
  return { data, error, loading, reload };
}

// Format a number as Indian rupees, e.g. ₹1,299
export const inr = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');

// Parse "YYYY-MM-DD" as a UTC date so the day never shifts with the browser timezone
const D = (s: string) => new Date(s + 'T00:00:00Z');
// "Fri, 13 Nov" style date
export const fmtDate = (s?: string | null) =>
  s ? D(s).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }) : '–';
// Date + time in IST
export const fmtTime = (s?: string | null) =>
  s ? new Date(s).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : '–';

// Meal names shown in the UI
export const MEAL_LABEL: Record<string, string> = { BREAKFAST: 'Breakfast', LUNCH: 'Lunch', SNACK: 'Evening snack', DINNER: 'Dinner' };
// One-letter meal codes (used in the calendar chips)
export const MEAL_LETTER: Record<string, string> = { BREAKFAST: 'B', LUNCH: 'L', SNACK: 'S', DINNER: 'D' };
// Allergy severity names shown in the UI
export const SEVERITY_LABEL: Record<string, string> = { NONE: 'No allergies', NOT_DECLARED: 'Not declared', MILD: 'Mild', MODERATE: 'Moderate', SEVERE: 'Severe' };
