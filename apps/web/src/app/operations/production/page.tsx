'use client';
/** Operations production sheet. */
import { useState } from 'react';
import { PageHeader } from '@/components/ui';
import { dateParam, ServiceDate } from '@/components/ops/DatePicker';
import { ProductionSheet } from '@/components/ops/ProductionSheet';

export default function ProductionPage() {
  const [when, setWhen] = useState<'today' | 'next'>('today');
  return (
    <>
      <PageHeader title="Production sheet" sub="Grouped by meal, then Veg and Non-Veg" />
      <ServiceDate value={when} onChange={setWhen} />
      <ProductionSheet date={dateParam(when)} />
    </>
  );
}
