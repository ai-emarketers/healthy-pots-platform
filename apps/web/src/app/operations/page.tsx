'use client';
/** Operations overview for the chosen service date. */
import { useState } from 'react';
import { useApi, fmtDate, MEAL_LABEL } from '@/lib/api';
import { Loading, PageHeader, Stat, Stats } from '@/components/ui';
import { dateParam, ServiceDate } from '@/components/ops/DatePicker';
import { AllergenTable, SheetBanner } from '@/components/ops/ProductionSheet';

export default function OperationsOverview() {
  const [when, setWhen] = useState<'today' | 'next'>('today');
  const { data: s, error, loading } = useApi<any>(`/kitchen/overview?date=${dateParam(when)}`);
  return (
    <>
      <PageHeader title="Kitchen and delivery at a glance" sub={s ? fmtDate(s.date) : ''} />
      <ServiceDate value={when} onChange={setWhen} />
      {!s ? <Loading error={error} loading={loading} /> : (
        <>
          <SheetBanner s={s} />
          <Stats>
            <Stat label="Meals to prepare" value={s.totals.meals} hint={`${s.totals.veg} Veg · ${s.totals.nonVeg} Non-Veg`} />
            {s.groups.map((g: any) => <Stat key={g.mealType} label={g.label} value={g.count} hint={g.window} />)}
            <Stat label="Paused (excluded)" value={s.totals.paused} hint="Not on the sheet" />
            <Stat label="Delivered" value={s.totals.delivered} hint={`of ${s.totals.meals}`} tone="good" />
            <Stat label="Exceptions" value={s.openExceptions} hint="With admin" tone={s.openExceptions ? 'bad' : undefined} />
            <Stat label="Allergy alerts" value={s.totals.allergyAlerts} hint={`${s.totals.dishConflicts} dish conflict(s)`} tone={s.totals.dishConflicts ? 'warn' : undefined} />
          </Stats>
          <AllergenTable rows={s.allergenAlerts} notDeclared={s.notDeclared} />
        </>
      )}
    </>
  );
}
