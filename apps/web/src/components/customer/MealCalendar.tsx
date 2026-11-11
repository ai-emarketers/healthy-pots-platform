'use client';
/** Month calendar of a customer's meals with status colours. */
import { MEAL_LETTER } from '@/lib/api';

interface M { id: string; code: string; mealType: string; date: string; status: string; locked: boolean }

/** Monday-first month-style grid covering every date in the plan. Tap a meal chip to select it. */
export function MealCalendar({ meals, closed = [], selected = [], onPick, pickable }: {
  meals: M[]; closed?: string[]; selected?: string[]; onPick?: (m: M) => void; pickable?: (m: M) => boolean;
}) {
  if (!meals.length) return <p className="muted">No meals yet.</p>;
  const dates = meals.map((m) => m.date).sort();
  const start = new Date(dates[0] + 'T00:00:00Z');
  const end = new Date(dates[dates.length - 1] + 'T00:00:00Z');
  start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  const days: Date[] = [];
  for (let d = new Date(start); d <= end || days.length % 7; d.setUTCDate(d.getUTCDate() + 1)) days.push(new Date(d));
  const by: Record<string, M[]> = {};
  meals.forEach((m) => (by[m.date] ??= []).push(m));
  const first = dates[0], last = dates[dates.length - 1];

  return (
    <div className="cal">
      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d} className="dow">{d}</div>)}
      {days.map((d) => {
        const key = d.toISOString().slice(0, 10);
        const inRange = key >= first && key <= last;
        const list = by[key] ?? [];
        return (
          <div key={key} className={`day ${inRange ? '' : 'out'}`}>
            <b>{d.getUTCDate()}{d.getUTCDate() === 1 ? ' ' + d.toLocaleString('en', { month: 'short', timeZone: 'UTC' }) : ''}</b>
            {closed.includes(key) && <span className="muted">closed</span>}
            {list.map((m) => {
              const can = onPick && (!pickable || pickable(m));
              return (
                <button key={m.id} className={`chip ${m.status} ${m.locked ? 'locked' : ''} ${selected.includes(m.id) ? 'sel' : ''}`} disabled={!can} title={`${m.code} · ${m.status}${m.locked ? ' · locked' : ''}`} onClick={() => onPick?.(m)}>
                  {MEAL_LETTER[m.mealType]}
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
