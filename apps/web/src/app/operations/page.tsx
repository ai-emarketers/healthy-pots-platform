'use client';
/** Operations overview for the chosen service date. */
import { useState } from 'react';
import { useApi, fmtDate, MEAL_LABEL } from '@/lib/api';
import { Loading, PageHeader, Stat, Stats } from '@/components/ui';
import { dateParam, ServiceDate } from '@/components/ops/DatePicker';
import { AllergenTable, SheetBanner } from '@/components/ops/ProductionSheet';

// Operations home: counts for the chosen service date
export default function OperationsOverview() {
  // Today or next bookable day
  const [when, setWhen] = useState<'today' | 'next'>('today');
  // Load the overview from the kitchen API
  const { data: s, error, loading } = useApi<any>(`/kitchen/overview?date=${dateParam(when)}`);
  return (
    <>
      {/* Title with the date */}
      <PageHeader title="Kitchen and delivery at a glance" sub={s ? fmtDate(s.date) : ''} />
      {/* Date toggle */}
      <ServiceDate value={when} onChange={setWhen} />
      {/* Wait for data */}
      {!s ? <Loading error={error} loading={loading} /> : (
        <>
          {/* Draft/final status of the sheet */}
          <SheetBanner s={s} />
          {/* KPI tiles: totals, per-meal counts, paused, delivered, exceptions, allergy alerts */}
          <Stats>
            <Stat label="Meals to prepare" value={s.totals.meals} hint={`${s.totals.veg} Veg · ${s.totals.nonVeg} Non-Veg`} />
            {s.groups.map((g: any) => <Stat key={g.mealType} label={g.label} value={g.count} hint={g.window} />)}
            <Stat label="Paused (excluded)" value={s.totals.paused} hint="Not on the sheet" />
            <Stat label="Delivered" value={s.totals.delivered} hint={`of ${s.totals.meals}`} tone="good" />
            <Stat label="Exceptions" value={s.openExceptions} hint="With admin" tone={s.openExceptions ? 'bad' : undefined} />
            <Stat label="Allergy alerts" value={s.totals.allergyAlerts} hint={`${s.totals.dishConflicts} dish conflict(s)`} tone={s.totals.dishConflicts ? 'warn' : undefined} />
          </Stats>
          {/* Allergy table for the date */}
          <AllergenTable rows={s.allergenAlerts} notDeclared={s.notDeclared} />
        </>
      )}
    </>
  );
}
