'use client';
/** Today / next service date selector for the operations screens. */
import { Segmented } from '@/components/ui';

/** "Today" or "Next bookable day" (the day whose customer cutoff is the next 5 PM IST). */
// Toggle between today's and the next bookable day's sheet
export function ServiceDate({ value, onChange }: { value: 'today' | 'next'; onChange: (v: 'today' | 'next') => void }) {
  return (
    <div className="row" style={{ marginBottom: 12 }}>
      <span className="muted">Service date</span>
      <Segmented value={value} onChange={onChange} options={[{ value: 'today', label: 'Today' }, { value: 'next', label: 'Next bookable day' }]} />
    </div>
  );
}

// Query value for the API: '' = today, 'next' = next bookable day
export const dateParam = (v: 'today' | 'next') => (v === 'next' ? 'next' : '');
