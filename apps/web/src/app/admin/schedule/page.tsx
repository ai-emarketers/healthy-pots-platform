'use client';
/** Per-subscription schedule with admin pause, reschedule, resume and swap (reason required). */
import { useEffect, useState } from 'react';
import { api, useApi, fmtDate, MEAL_LABEL } from '@/lib/api';
import { Button, Card, Field, Loading, Notice, PageHeader, Stat, Stats, StatusBadge, Table } from '@/components/ui';

/** Admin schedule table with audited actions. */
export default function SchedulePage() {
  const { data: subs } = useApi<any[]>('/admin/subscriptions?status=ACTIVE');
  const [id, setId] = useState('');
  useEffect(() => { if (subs?.length && !id) setId(subs[0].id); }, [subs, id]);
  const { data: d, error, loading, reload } = useApi<any>(id ? `/subscriptions/${id}` : null);
  const [err, setErr] = useState('');
  const run = async (fn: () => Promise<any>) => { setErr(''); try { await fn(); await reload(); } catch (e: any) { setErr(e.message); } };
  const reason = () => window.prompt('Reason (recorded in the audit log)') ?? '';

  async function swap(mealId: string) {
    const options = await api<any[]>(`/admin/meals/${mealId}/safe-dishes`);
    const pick = window.prompt('Swap to which dish?\n' + options.map((o, i) => `${i + 1}. ${o.name}`).join('\n'));
    const dish = options[Number(pick) - 1];
    if (!dish) return;
    const r = reason();
    if (r) await run(() => api(`/admin/meals/${mealId}/swap-dish`, { body: { dishId: dish.id, reason: r } }));
  }

  return (
    <>
      <PageHeader title="Schedule management" sub="View original and revised dates. Every change is written to the audit log." />
      <Field label="Subscription"><select value={id} onChange={(e) => setId(e.target.value)}>{subs?.map((s) => <option key={s.id} value={s.id}>{s.code} · {s.customer} · {s.plan}</option>)}</select></Field>
      {err && <Notice tone="bad">{err}</Notice>}
      {!d ? <Loading error={error} loading={loading} /> : (
        <>
          <Stats>
            <Stat label="Total" value={d.progress.total} /><Stat label="Delivered" value={d.progress.delivered} tone="good" />
            <Stat label="Paused" value={d.progress.paused} tone="warn" /><Stat label="Exceptions" value={d.meals.filter((m: any) => m.status === 'EXCEPTION' || m.delivery?.status === 'FAILED').length} tone="bad" /><Stat label="Remaining" value={d.progress.remaining} />
            <Stat label="Estimated finish" value={fmtDate(d.progress.estimatedFinish)} hint={`Original ${fmtDate(d.originalEnd)}`} />
          </Stats>
          <Card>
            <Table head={['Meal ID', 'Meal', 'Dish', 'Original date', 'Revised date', 'Status', 'Lock', 'Actions']}>
              {d.meals.map((m: any) => (
                <tr key={m.id}>
                  <td>{m.code}</td><td>{MEAL_LABEL[m.mealType]}</td><td>{m.dish ?? '–'}</td><td>{fmtDate(m.originalDate)}</td><td>{fmtDate(m.revisedDate)}</td>
                  <td><StatusBadge status={m.status} /></td><td>{m.locked ? 'Locked' : m.status === 'SCHEDULED' ? 'Open' : ''}</td>
                  <td><div className="row">
                    {m.status === 'SCHEDULED' && !m.locked && <>
                      <Button small kind="ghost" onClick={() => { const r = reason(); if (r) run(() => api('/schedule/pause', { body: { subscriptionId: d.id, mealIds: [m.id], reason: r } })); }}>Pause</Button>
                      <Button small kind="ghost" onClick={() => { const to = window.prompt('New date (YYYY-MM-DD)'); const r = to && reason(); if (to && r) run(() => api('/schedule/reschedule', { body: { mealId: m.id, newDate: to, reason: r } })); }}>Reschedule</Button>
                      <Button small kind="ghost" onClick={() => swap(m.id)}>Swap dish</Button>
                    </>}
                    {m.status === 'PAUSED' && <Button small kind="ghost" onClick={() => { const r = reason(); if (r) run(() => api('/schedule/resume', { body: { subscriptionId: d.id, mealIds: [m.id], reason: r } })); }}>Resume</Button>}
                  </div></td>
                </tr>
              ))}
            </Table>
          </Card>
        </>
      )}
    </>
  );
}
