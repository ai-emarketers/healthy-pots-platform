'use client';
/** Today / next service date selector for the operations screens. */
import { Segmented } from '@/components/ui';

/** "Today" or "Next bookable day" (the day whose customer cutoff is the next 5 PM IST). */
export function ServiceDate({ value, onChange }: { value: 'today' | 'next'; onChange: (v: 'today' | 'next') => void }) {
  return (
    <div className="row" style={{ marginBottom: 12 }}>
      <span className="muted">Service date</span>
      <Segmented value={value} onChange={onChange} options={[{ value: 'today', label: 'Today' }, { value: 'next', label: 'Next bookable day' }]} />
    </div>
  );
}

export const dateParam = (v: 'today' | 'next') => (v === 'next' ? 'next' : '');
