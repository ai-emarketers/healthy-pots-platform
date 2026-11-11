'use client';
/** Browser API helper, data-loading hook and display formatters. */
import { useCallback, useEffect, useState } from 'react';

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

/** All calls go through the Next.js proxy (/backend -> NestJS /api) so the auth cookie stays first-party. */
export async function api<T = any>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`/backend${path}`, {
    method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'),
    headers: opts.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    credentials: 'same-origin',
  });
  if (res.status === 401 && typeof window !== 'undefined' && !path.startsWith('/auth/')) {
    window.location.href = '/login';
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const m = data?.message;
    throw new ApiError(Array.isArray(m) ? m.join(', ') : m || res.statusText, res.status);
  }
  return data as T;
}

export function useApi<T = any>(path: string | null) {
  const [data, setData] = useState<T | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(!!path);
  const reload = useCallback(async () => {
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
  useEffect(() => {
    reload();
  }, [reload]);
  return { data, error, loading, reload };
}

export const inr = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');

const D = (s: string) => new Date(s + 'T00:00:00Z');
export const fmtDate = (s?: string | null) =>
  s ? D(s).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }) : '–';
export const fmtTime = (s?: string | null) =>
  s ? new Date(s).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : '–';

export const MEAL_LABEL: Record<string, string> = { BREAKFAST: 'Breakfast', LUNCH: 'Lunch', SNACK: 'Evening snack', DINNER: 'Dinner' };
export const MEAL_LETTER: Record<string, string> = { BREAKFAST: 'B', LUNCH: 'L', SNACK: 'S', DINNER: 'D' };
export const SEVERITY_LABEL: Record<string, string> = { NONE: 'No allergies', NOT_DECLARED: 'Not declared', MILD: 'Mild', MODERATE: 'Moderate', SEVERE: 'Severe' };
