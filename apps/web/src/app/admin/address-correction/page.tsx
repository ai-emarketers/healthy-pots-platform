'use client';
/** Super-admin address correction (audited, with a reason). */
import { useEffect, useState } from 'react';
import { api, useApi, fmtTime, MEAL_LABEL } from '@/lib/api';
import { Button, Card, Field, Notice, PageHeader, Table } from '@/components/ui';

export default function AddressCorrection() {
  const { data: subs } = useApi<any[]>('/admin/subscriptions?status=ACTIVE');
  const { data: log, reload } = useApi<any[]>('/admin/address-corrections');
  const [id, setId] = useState('');
  const [meal, setMeal] = useState('LUNCH');
  const { data: addrs } = useApi<any[]>(id ? `/admin/subscriptions/${id}/addresses` : null);
  const [f, setF] = useState({ line1: '', landmark: '', city: 'Kolkata', pincode: '', reason: '' });
  const [msg, setMsg] = useState<any>(null);
  useEffect(() => { if (subs?.length && !id) setId(subs[0].id); }, [subs, id]);
  const cur = addrs?.find((a) => a.mealType === meal) ?? addrs?.[0];
  useEffect(() => { if (cur) { setMeal(cur.mealType); setF((p) => ({ ...p, line1: cur.line1, landmark: cur.landmark ?? '', city: cur.city, pincode: cur.pincode })); } }, [cur?.id]);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  async function apply() {
    try { await api('/admin/address-corrections', { body: { subscriptionId: id, mealType: cur.mealType, ...f } }); setMsg({ tone: 'good', text: 'Correction applied. Open kitchen orders pick up the new address.' }); reload(); }
    catch (e: any) { setMsg({ tone: 'bad', text: e.message }); }
  }
  return (
    <>
      <PageHeader title="Exceptional address correction" sub="Restricted. Customers cannot change addresses after payment. Use this only for errors such as a missing landmark." />
      <Notice tone="warn">Super admin area. The old and new address are stored in the audit log.</Notice>
      <Card>
        <div className="grid2">
          <Field label="Subscription"><select value={id} onChange={(e) => setId(e.target.value)}>{subs?.map((s) => <option key={s.id} value={s.id}>{s.code} · {s.customer}</option>)}</select></Field>
          <Field label="Meal"><select value={cur?.mealType ?? ''} onChange={(e) => setMeal(e.target.value)}>{addrs?.map((a) => <option key={a.id} value={a.mealType}>{MEAL_LABEL[a.mealType]}</option>)}</select></Field>
        </div>
        {cur && <p className="muted">Current fixed address: {cur.line1}{cur.landmark ? `, ${cur.landmark}` : ''}, {cur.city} {cur.pincode}</p>}
        <div className="grid2">
          <Field label="House or flat number and street"><input value={f.line1} onChange={(e) => set('line1', e.target.value)} /></Field>
          <Field label="Area or landmark"><input value={f.landmark} onChange={(e) => set('landmark', e.target.value)} /></Field>
          <Field label="City"><input value={f.city} onChange={(e) => set('city', e.target.value)} /></Field>
          <Field label="Pincode"><input value={f.pincode} onChange={(e) => set('pincode', e.target.value)} /></Field>
          <Field label="Reason"><input value={f.reason} onChange={(e) => set('reason', e.target.value)} /></Field>
        </div>
        {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
        <Button onClick={apply} disabled={!cur || !f.line1}>Apply correction</Button>
      </Card>
      <Card title="Past corrections">
        <Table head={['Time', 'Who', 'Meal', 'Old', 'New', 'Reason']} empty={log?.length ? undefined : 'None yet.'}>
          {log?.map((a) => (<tr key={a.id}><td>{fmtTime(a.at)}</td><td>{a.actorLabel}</td><td>{a.target}</td><td>{a.oldValue}</td><td>{a.newValue}</td><td>{a.reason ?? '–'}</td></tr>))}
        </Table>
      </Card>
    </>
  );
}
