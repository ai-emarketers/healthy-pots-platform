'use client';
/** Delivery job list: assign a partner, advance status, report a failure. */
import { useState } from 'react';
import { api, useApi, MEAL_LABEL } from '@/lib/api';
import { mapUrl } from '@/lib/maps';
import { Button, Card, Loading, Notice, StatusBadge, Table } from '@/components/ui';

const PARTNERS = ['Shadowfax rider 1', 'Shadowfax rider 2', 'Shadowfax rider 3'];

export function DeliveryJobs({ date }: { date: string }) {
  const { data, error, loading, reload } = useApi<any>(`/delivery/jobs?date=${date}`);
  const [err, setErr] = useState('');
  const act = async (fn: () => Promise<any>) => { setErr(''); try { await fn(); await reload(); } catch (e: any) { setErr(e.message); } };
  if (!data) return <Loading error={error} loading={loading} />;
  return (
    <Card title="Delivery jobs">
      <Notice tone="info">One delivery job per meal, created when the kitchen marks it Ready. Partner updates will arrive from the delivery partner by webhook once the vendor confirms its API. These buttons stand in for those updates.</Notice>
      {err && <Notice tone="bad">{err}</Notice>}
      <Table head={['Meal', 'Customer and address', 'Partner', 'Tracking', 'Status', 'Next step']} empty={data.jobs.length ? undefined : 'No delivery jobs for this date yet. Mark meals Ready on the Kitchen board.'}>
        {data.jobs.map((j: any) => (
          <tr key={j.id}>
            <td>{j.meal}<small>{MEAL_LABEL[j.mealType]}</small></td>
            <td>{j.customer}<small>{j.address}</small><small><a href={mapUrl({ line1: j.address, mapLink: j.mapLink })} target="_blank" rel="noopener noreferrer">Open in Maps</a></small></td>
            <td>
              <select value={j.partner ?? ''} onChange={(e) => act(() => api(`/delivery/jobs/${j.id}/assign`, { body: { partner: e.target.value } }))}>
                <option value="">Unassigned</option>
                {PARTNERS.map((p) => <option key={p}>{p}</option>)}
              </select>
            </td>
            <td>{j.trackingRef ?? '–'}</td>
            <td><StatusBadge status={j.status} /></td>
            <td>
              <div className="row">
                {j.next.map((n: string) =>
                  n === 'FAILED' ? (
                    <Button key={n} small kind="danger" onClick={() => { const reason = window.prompt('Why did the delivery fail?'); if (reason) act(() => api(`/delivery/jobs/${j.id}/advance`, { body: { status: n, reason } })); }}>Failed</Button>
                  ) : (
                    <Button key={n} small onClick={() => act(() => api(`/delivery/jobs/${j.id}/advance`, { body: { status: n } }))}>{n.replace(/_/g, ' ').toLowerCase()}</Button>
                  ),
                )}
              </div>
            </td>
          </tr>
        ))}
      </Table>
    </Card>
  );
}

export function Exceptions({ canResolve }: { canResolve: boolean }) {
  const { data, error, loading, reload } = useApi<any[]>('/delivery/exceptions');
  const [err, setErr] = useState('');
  if (!data) return <Loading error={error} loading={loading} />;
  const resolve = async (id: string) => {
    const resolution = (window.prompt('Resolution: CREDIT, REDELIVER or WAIVE', 'CREDIT') ?? '').toUpperCase();
    if (!['CREDIT', 'REDELIVER', 'WAIVE'].includes(resolution)) return;
    const note = window.prompt('Reason for the audit log');
    if (!note) return;
    try { await api(`/delivery/exceptions/${id}/resolve`, { body: { resolution, note } }); await reload(); } catch (e: any) { setErr(e.message); }
  };
  return (
    <Card title={`Delivery exceptions (${data.filter((e) => e.status === 'OPEN').length} open)`}>
      <Notice tone="info">A failed delivery is not a completed meal. Admin investigates and resolves.</Notice>
      {err && <Notice tone="bad">{err}</Notice>}
      <Table head={['Meal ID', 'Date', 'Customer', 'Reason', 'Status', '']} empty={data.length ? undefined : 'No exceptions.'}>
        {data.map((e) => (
          <tr key={e.id}>
            <td>{e.meal}</td><td>{e.date}</td><td>{e.customer}</td><td>{e.reason}</td>
            <td>{e.status === 'OPEN' ? (canResolve ? <StatusBadge status="OPEN" /> : <StatusBadge status="OPEN" label="Sent to admin" />) : <StatusBadge status="RESOLVED" label={`Resolved: ${e.resolution?.toLowerCase()}`} />}</td>
            <td>{e.status === 'OPEN' && canResolve && <Button small onClick={() => resolve(e.id)}>Resolve</Button>}</td>
          </tr>
        ))}
      </Table>
    </Card>
  );
}
