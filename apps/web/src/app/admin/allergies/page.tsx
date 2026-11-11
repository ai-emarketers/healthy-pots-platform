'use client';
/** Allergy review and dish swaps for conflicting meals. */
import { useState } from 'react';
import { api, useApi, SEVERITY_LABEL } from '@/lib/api';
import { Card, Loading, Notice, PageHeader, Segmented, Stat, Stats, StatusBadge, Table } from '@/components/ui';

export default function AllergiesPage() {
  const { data, error, loading } = useApi<any>('/admin/allergies');
  const [f, setF] = useState('all');
  if (!data) return <Loading error={error} loading={loading} />;
  const rows = data.rows.filter((r: any) => f === 'all' || (f === 'has' && r.severity !== 'NONE' && r.severity !== 'NOT_DECLARED') || (f === 'severe' && r.severity === 'SEVERE') || (f === 'conflicts' && r.conflicts) || (f === 'nd' && r.severity === 'NOT_DECLARED'));
  return (
    <>
      <PageHeader title="Allergies and diet" sub="Declared by customers at purchase or later from their dashboard. Shared with the kitchen on every production sheet." />
      <Stats>
        <Stat label="Active subscriptions" value={data.active} />
        <Stat label="With allergies" value={data.withAllergies} hint={`${data.severe} severe`} tone="warn" />
        <Stat label="Not declared" value={data.notDeclared} hint="Ask before first delivery" />
        <Stat label="Dish conflicts" value={data.conflicts} hint="No swap agreed yet" tone={data.conflicts ? 'bad' : undefined} />
      </Stats>
      <Segmented value={f} onChange={setF} options={[{ value: 'all', label: 'All' }, { value: 'has', label: 'Has allergy' }, { value: 'severe', label: 'Severe' }, { value: 'conflicts', label: 'Dish conflicts' }, { value: 'nd', label: 'Not declared' }]} />
      <Card>
        <Table head={['Subscription', 'Customer', 'Allergy', 'Avoids / notes', 'Upcoming conflicts']}>
          {rows.map((r: any) => (
            <tr key={r.subscription}>
              <td>{r.subscription}</td><td>{r.customer}</td>
              <td><StatusBadge status={r.severity} label={SEVERITY_LABEL[r.severity]} /><small>{r.allergens.join(', ')}</small></td>
              <td>{[r.notes, r.dislikes && `Dislikes: ${r.dislikes}`].filter(Boolean).join(' · ') || '–'}</td>
              <td>{r.conflicts ? `${r.conflicts} meals` : 'None'}</td>
            </tr>
          ))}
        </Table>
        {data.conflicts > 0 && <Notice tone="warn">Conflicting meals get a safe dish by opening the Schedule page for that subscription and choosing Swap dish on the meal.</Notice>}
      </Card>
    </>
  );
}
