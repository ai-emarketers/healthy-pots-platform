'use client';
/** Operations production sheet. */
import { useState } from 'react';
import { PageHeader } from '@/components/ui';
import { dateParam, ServiceDate } from '@/components/ops/DatePicker';
import { ProductionSheet } from '@/components/ops/ProductionSheet';

// Production sheet page
export default function ProductionPage() {
  // Selected service date
  const [when, setWhen] = useState<'today' | 'next'>('today');
  return (
    <>
      <PageHeader title="Production sheet" sub="Grouped by meal, then Veg and Non-Veg" />
      <ServiceDate value={when} onChange={setWhen} />
      {/* Sheet for that date */}
      <ProductionSheet date={dateParam(when)} />
    </>
  );
}
