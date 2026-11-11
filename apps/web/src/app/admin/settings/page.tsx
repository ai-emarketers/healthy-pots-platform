'use client';
/** Super-admin settings: service area, operating days, closures, rate card, pricing rules. */
import { useEffect, useState } from 'react';
import { api, useApi, MEAL_LABEL } from '@/lib/api';
import { Button, Card, Field, Loading, Notice, PageHeader, Table } from '@/components/ui';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function SettingsPage() {
  const { data: me } = useApi<any>('/auth/me');
  const { data, error, loading, reload } = useApi<any>('/admin/settings');
  const [pricing, setPricing] = useState<any>(null);
  const [rates, setRates] = useState<any[]>([]);
  const [days, setDays] = useState<number[]>([]);
  const [pin, setPin] = useState({ pincode: '', area: '', zone: 'A' });
  const [closure, setClosure] = useState({ date: '', reason: '' });
  const [msg, setMsg] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null);
  const canEdit = me?.user?.role === 'SUPER_ADMIN';

  useEffect(() => { if (data) { setPricing(structuredClone(data.pricing)); setRates(structuredClone(data.rateCard)); setDays(data.operatingDays); } }, [data]);
  if (!data || !pricing) return <Loading error={error} loading={loading} />;

  const run = async (fn: () => Promise<any>, ok = 'Saved') => { try { await fn(); setMsg({ tone: 'good', text: ok }); await reload(); } catch (e: any) { setMsg({ tone: 'bad', text: e.message }); } };
  const setP = (path: string[], v: number) => setPricing((p: any) => { const c = structuredClone(p); let o = c; path.slice(0, -1).forEach((k) => (o = o[k])); o[path[path.length - 1]] = v; return c; });
  const num = (v: string) => (v === '' ? 0 : Number(v));

  return (
    <>
      <PageHeader title="Settings" sub={canEdit ? 'Service area, operating days, rate card and pricing rules.' : 'Read only. Only a super admin can change settings.'} />
      <Notice tone="info">{data.cutoff}</Notice>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}

      <Card title="Service area">
        <Table head={['Pincode', 'Area', 'Zone', '']}>
          {data.pincodes.map((p: any) => (<tr key={p.pincode}><td>{p.pincode}</td><td>{p.area}</td><td>{p.zone}</td><td>{canEdit && <Button small kind="ghost" onClick={() => run(() => api(`/admin/settings/pincodes/${p.pincode}`, { method: 'DELETE' }), 'Removed')}>Remove</Button>}</td></tr>))}
        </Table>
        {canEdit && <div className="row" style={{ marginTop: 10 }}>
          <input style={{ width: 110 }} placeholder="Pincode" value={pin.pincode} onChange={(e) => setPin({ ...pin, pincode: e.target.value })} />
          <input style={{ width: 200 }} placeholder="Area" value={pin.area} onChange={(e) => setPin({ ...pin, area: e.target.value })} />
          <select style={{ width: 70 }} value={pin.zone} onChange={(e) => setPin({ ...pin, zone: e.target.value })}><option>A</option><option>B</option></select>
          <Button small disabled={!pin.pincode || !pin.area} onClick={() => run(() => api('/admin/settings/pincodes', { body: pin }), 'Pincode saved')}>Add pincode</Button>
        </div>}
      </Card>

      <Card title="Operating calendar">
        <div className="row">{DAYS.map((d, i) => (<label key={d} className="row"><input type="checkbox" style={{ width: 'auto' }} disabled={!canEdit} checked={days.includes(i)} onChange={() => setDays(days.includes(i) ? days.filter((x) => x !== i) : [...days, i])} />{d}</label>))}</div>
        {canEdit && <div style={{ marginTop: 10 }}><Button small onClick={() => run(() => api('/admin/settings', { method: 'PUT', body: { operatingDays: days } }))}>Save delivery days</Button></div>}
        <p className="muted">Selected days are delivery days. Holidays and closures:</p>
        {data.closures.map((c: any) => (<p key={c.id}>{c.date}: {c.reason} {canEdit && <Button small kind="ghost" onClick={() => run(() => api(`/admin/settings/closures/${c.id}`, { method: 'DELETE' }), 'Removed')}>Remove</Button>}</p>))}
        {canEdit && <div className="row">
          <input type="date" style={{ width: 170 }} value={closure.date} onChange={(e) => setClosure({ ...closure, date: e.target.value })} />
          <input style={{ width: 240 }} placeholder="Reason" value={closure.reason} onChange={(e) => setClosure({ ...closure, reason: e.target.value })} />
          <Button small disabled={!closure.date || !closure.reason} onClick={() => run(() => api('/admin/settings/closures', { body: closure }), 'Closure added')}>Add closure</Button>
        </div>}
      </Card>

      <Card title="Rate card (₹ per meal)">
        <Table head={['Plan', ...['BREAKFAST', 'LUNCH', 'SNACK', 'DINNER'].map((m) => MEAL_LABEL[m])]}>
          {rates.map((r, i) => (<tr key={r.planId}><td>{r.plan}</td>{['BREAKFAST', 'LUNCH', 'SNACK', 'DINNER'].map((m) => (<td key={m}><input type="number" style={{ width: 90 }} disabled={!canEdit} value={r.rates[m] ?? ''} onChange={(e) => setRates((p) => { const c = structuredClone(p); c[i].rates[m] = num(e.target.value); return c; })} /></td>))}</tr>))}
        </Table>
        {canEdit && <div style={{ marginTop: 10 }}><Button small onClick={() => run(() => api('/admin/settings', { method: 'PUT', body: { rateCard: rates.map((r) => ({ planId: r.planId, rates: r.rates })) } }))}>Save rate card</Button></div>}
      </Card>

      <Card title="Pricing rules">
        <div className="grid2">
          {Object.keys(pricing.discount).map((d) => (<Field key={d} label={`Discount on ${d} days (%)`}><input type="number" disabled={!canEdit} value={pricing.discount[d]} onChange={(e) => setP(['discount', d], num(e.target.value))} /></Field>))}
          {Object.keys(pricing.multiMeal).map((d) => (<Field key={d} label={`Saving for ${d} meal(s) a day (%)`}><input type="number" disabled={!canEdit} value={pricing.multiMeal[d]} onChange={(e) => setP(['multiMeal', d], num(e.target.value))} /></Field>))}
          <Field label="GST (%)"><input type="number" disabled={!canEdit} value={pricing.gst} onChange={(e) => setP(['gst'], num(e.target.value))} /></Field>
          <Field label="Delivery per drop, zone A (₹)"><input type="number" disabled={!canEdit} value={pricing.deliveryA} onChange={(e) => setP(['deliveryA'], num(e.target.value))} /></Field>
          <Field label="Delivery per drop, zone B (₹)"><input type="number" disabled={!canEdit} value={pricing.deliveryB} onChange={(e) => setP(['deliveryB'], num(e.target.value))} /></Field>
          <Field label="Free delivery above (₹, 0 = never)"><input type="number" disabled={!canEdit} value={pricing.freeAbove} onChange={(e) => setP(['freeAbove'], num(e.target.value))} /></Field>
          <Field label="Meals per type per day (capacity)"><input type="number" disabled={!canEdit} value={pricing.capacity} onChange={(e) => setP(['capacity'], num(e.target.value))} /></Field>
        </div>
        <p className="muted">Confirm GST treatment with your accountant before launch. Each delivery is one drop.</p>
        {canEdit && <Button small onClick={() => run(() => api('/admin/settings', { method: 'PUT', body: { pricing } }))}>Save pricing rules</Button>}
      </Card>
    </>
  );
}
