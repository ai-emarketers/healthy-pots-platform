'use client';
/** Operations delivery jobs. */
import { useState } from 'react';
import { PageHeader } from '@/components/ui';
import { dateParam, ServiceDate } from '@/components/ops/DatePicker';
import { DeliveryJobs } from '@/components/ops/DeliveryJobs';

// Delivery jobs page
export default function DeliveryPage() {
  // Selected service date
  const [when, setWhen] = useState<'today' | 'next'>('today');
  return (
    <>
      <PageHeader title="Delivery jobs" sub="One delivery job per meal, created when the kitchen marks it Ready" />
      <ServiceDate value={when} onChange={setWhen} />
      {/* Jobs for that date */}
      <DeliveryJobs date={dateParam(when)} />
    </>
  );
}
