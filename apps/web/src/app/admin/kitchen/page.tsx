'use client';
/** Admin view of the production sheet and kitchen board. */
import { useState } from 'react';
import { PageHeader, Segmented } from '@/components/ui';
import { dateParam, ServiceDate } from '@/components/ops/DatePicker';
import { ProductionSheet } from '@/components/ops/ProductionSheet';
import { KitchenBoard } from '@/components/ops/KitchenBoard';

export default function AdminKitchen() {
  const [when, setWhen] = useState<'today' | 'next'>('today');
  const [tab, setTab] = useState<'sheet' | 'board'>('sheet');
  return (
    <>
      <PageHeader title="Kitchen" sub="View and export the production sheet, and update preparation status." />
      <ServiceDate value={when} onChange={setWhen} />
      <Segmented<'sheet' | 'board'> value={tab} onChange={setTab} options={[{ value: 'sheet', label: 'Production sheet' }, { value: 'board', label: 'Status board' }]} />
      <div style={{ marginTop: 14 }}>{tab === 'sheet' ? <ProductionSheet date={dateParam(when)} /> : <KitchenBoard date={dateParam(when)} />}</div>
    </>
  );
}
