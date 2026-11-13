'use client';
/** Month calendar of a customer's meals with status colours. */
import { MEAL_LETTER } from '@/lib/api';

// Minimal meal shape the calendar needs
interface M { id: string; code: string; mealType: string; date: string; status: string; locked: boolean }

/** Monday-first month-style grid covering every date in the plan. Tap a meal chip to select it. */
// Calendar grid of meals; onPick/pickable make chips clickable
export function MealCalendar({ meals, closed = [], selected = [], onPick, pickable }: {
  meals: M[]; closed?: string[]; selected?: string[]; onPick?: (m: M) => void; pickable?: (m: M) => boolean;
}) {
  // Nothing to draw
  if (!meals.length) return <p className="muted">No meals yet.</p>;
  // Sorted list of all meal dates
  const dates = meals.map((m) => m.date).sort();
  // First meal date, moved back to the Monday of its week
  const start = new Date(dates[0] + 'T00:00:00Z');
  // Last meal date
  const end = new Date(dates[dates.length - 1] + 'T00:00:00Z');
  start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  // Every calendar cell from start up to the end of the last week
  const days: Date[] = [];
  // Build the cells day by day (pad to full weeks)
  for (let d = new Date(start); d <= end || days.length % 7; d.setUTCDate(d.getUTCDate() + 1)) days.push(new Date(d));
  // Meals grouped by date
  const by: Record<string, M[]> = {};
  meals.forEach((m) => (by[m.date] ??= []).push(m));
  // Plan range used to grey out days outside it
  const first = dates[0], last = dates[dates.length - 1];

  return (
    <div className="cal">
      {/* Weekday header row */}
      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d} className="dow">{d}</div>)}
      {/* One cell per day */}
      {days.map((d) => {
        // Date as YYYY-MM-DD
        const key = d.toISOString().slice(0, 10);
        // Is this day inside the plan?
        const inRange = key >= first && key <= last;
        const list = by[key] ?? [];
        return (
          <div key={key} className={`day ${inRange ? '' : 'out'}`}>
            <b>{d.getUTCDate()}{d.getUTCDate() === 1 ? ' ' + d.toLocaleString('en', { month: 'short', timeZone: 'UTC' }) : ''}</b>
            {closed.includes(key) && <span className="muted">closed</span>}
            {list.map((m) => {
              // Can this meal chip be clicked (needs onPick and passes pickable)?
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
