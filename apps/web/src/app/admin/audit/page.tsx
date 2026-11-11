'use client';
/** Audit log viewer. */
import { useState } from 'react';
import { useApi, fmtTime } from '@/lib/api';
import { Card, Loading, PageHeader, Segmented, Table } from '@/components/ui';

export default function AuditPage() {
  const [area, setArea] = useState('All');
  const { data, error, loading } = useApi<any[]>(`/admin/audit?area=${area}`);
  return (
    <>
      <PageHeader title="Audit log" sub="Every override, address correction and schedule change: who, when, old value, new value and reason." />
      <Segmented value={area} onChange={setArea} options={['All', 'Delivery', 'Address', 'Schedule', 'Allergy', 'Payment', 'Subscription', 'Settings'].map((v) => ({ value: v, label: v === 'All' ? 'All areas' : v }))} />
      {!data ? <Loading error={error} loading={loading} /> : (
        <Card>
          <Table head={['Time', 'User', 'Area', 'Action', 'Target', 'Old value', 'New value', 'Reason']} empty={data.length ? undefined : 'No entries.'}>
            {data.map((a) => (<tr key={a.id}><td>{fmtTime(a.at)}</td><td>{a.actorLabel}</td><td>{a.area}</td><td>{a.action}</td><td>{a.target}</td><td>{a.oldValue ?? '–'}</td><td>{a.newValue ?? '–'}</td><td>{a.reason ?? '–'}</td></tr>))}
          </Table>
        </Card>
      )}
    </>
  );
}
