'use client';
/** Admin delivery jobs and exception resolution. */
import { useState } from 'react';
import { PageHeader } from '@/components/ui';
import { dateParam, ServiceDate } from '@/components/ops/DatePicker';
import { DeliveryJobs, Exceptions } from '@/components/ops/DeliveryJobs';

// Admin delivery page: exceptions first, then jobs
export default function AdminDelivery() {
  // Service date toggle
  const [when, setWhen] = useState<'today' | 'next'>('today');
  return (
    <>
      <PageHeader title="Delivery" sub="Assign or reassign partners and handle exceptions." />
      {/* Admins can resolve failed deliveries */}
      <Exceptions canResolve />
      <ServiceDate value={when} onChange={setWhen} />
      {/* Jobs for the chosen date */}
      <DeliveryJobs date={dateParam(when)} />
    </>
  );
}
