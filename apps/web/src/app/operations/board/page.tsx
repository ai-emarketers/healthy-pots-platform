'use client';
/** Operations kitchen status board. */
import { useState } from 'react';
import { PageHeader } from '@/components/ui';
import { dateParam, ServiceDate } from '@/components/ops/DatePicker';
import { KitchenBoard } from '@/components/ops/KitchenBoard';

// Kitchen board page
export default function BoardPage() {
  // Selected service date
  const [when, setWhen] = useState<'today' | 'next'>('today');
  return (
    <>
      <PageHeader title="Kitchen board" sub="Update preparation status. Marking a meal Ready creates its delivery job." />
      <ServiceDate value={when} onChange={setWhen} />
      {/* Board for that date ('' = today, 'next' = next bookable day) */}
      <KitchenBoard date={dateParam(when)} />
    </>
  );
}
