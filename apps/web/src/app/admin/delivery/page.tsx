'use client';
/** Admin delivery jobs and exception resolution. */
import { useState } from 'react';
import { PageHeader } from '@/components/ui';
import { dateParam, ServiceDate } from '@/components/ops/DatePicker';
import { DeliveryJobs, Exceptions } from '@/components/ops/DeliveryJobs';

export default function AdminDelivery() {
  const [when, setWhen] = useState<'today' | 'next'>('today');
  return (
    <>
      <PageHeader title="Delivery" sub="Assign or reassign partners and handle exceptions." />
      <Exceptions canResolve />
      <ServiceDate value={when} onChange={setWhen} />
      <DeliveryJobs date={dateParam(when)} />
    </>
  );
}
