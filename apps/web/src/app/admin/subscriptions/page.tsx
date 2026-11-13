'use client';
/** Subscriptions list and manual subscription creation. */
import { useState } from 'react';
import { api, useApi, fmtDate, MEAL_LABEL } from '@/lib/api';
import { Button, Card, Field, Loading, Notice, PageHeader, Segmented, StatusBadge, Table } from '@/components/ui';

// Form to create and activate a subscription for an existing customer
function ManualForm({ onDone }: { onDone: () => void }) {
  // Customers for the dropdown
  const { data: customers } = useApi<any[]>('/admin/customers');
  // Plans, durations and start dates
  const { data: cat } = useApi<any>('/catalog/plans');
  // Form values
  const [f, setF] = useState<any>({ customerId: '', planSlug: 'weight-loss', days: 14, diet: 'VEG', meals: ['BREAKFAST', 'LUNCH', 'DINNER'], startDate: '', method: 'MANUAL', line1: '', landmark: '', city: 'Kolkata', pincode: '700091' });
  // Result banner
  const [msg, setMsg] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null);
  // Wait for data
  if (!customers || !cat) return <Loading />;
  // Update one field
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));
  // Tick / untick a meal type
  const toggle = (m: string) => set('meals', f.meals.includes(m) ? f.meals.filter((x: string) => x !== m) : [...f.meals, m]);
  // Build the checkout body and call POST /admin/subscriptions
  async function submit() {
    try {
      // One address used for all meals
      const addr = { line1: f.line1, landmark: f.landmark, city: f.city, pincode: f.pincode };
      const r = await api('/admin/subscriptions', { body: { customerId: f.customerId, method: f.method, subscription: { planSlug: f.planSlug, days: Number(f.days), mealTypes: f.meals, diet: f.diet, startDate: f.startDate || cat.startDates[0], perMealAddress: false, addresses: { [f.meals[0]]: addr } } } });
      setMsg({ tone: 'good', text: `Created ${r.subscription.code}` });
      onDone();
    } catch (e: any) { setMsg({ tone: 'bad', text: e.message }); }
  }
  return (
    <Card title="Create manual subscription">
      {/* Form fields */}
      <div className="grid2">
        <Field label="Customer"><select value={f.customerId} onChange={(e) => set('customerId', e.target.value)}><option value="">Select…</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}</select></Field>
        <Field label="Plan"><select value={f.planSlug} onChange={(e) => set('planSlug', e.target.value)}>{cat.plans.map((p: any) => <option key={p.slug} value={p.slug}>{p.name}</option>)}</select></Field>
        <Field label="Duration (delivery days)"><select value={f.days} onChange={(e) => set('days', e.target.value)}>{cat.durations.map((d: any) => <option key={d.days} value={d.days}>{d.days} days</option>)}</select></Field>
        <Field label="Food preference"><select value={f.diet} onChange={(e) => set('diet', e.target.value)}><option value="VEG">Vegetarian</option><option value="NON_VEG">Non-vegetarian</option><option value="EGG">Eggetarian</option><option value="MIXED">Mixed day by day</option></select></Field>
        <Field label="Start date"><select value={f.startDate} onChange={(e) => set('startDate', e.target.value)}>{cat.startDates.map((d: string) => <option key={d} value={d}>{fmtDate(d)}</option>)}</select></Field>
        <Field label="Payment method"><select value={f.method} onChange={(e) => set('method', e.target.value)}><option>MANUAL</option><option>UPI</option><option>Card</option><option>NetBanking</option></select></Field>
        <Field label="Address line"><input value={f.line1} onChange={(e) => set('line1', e.target.value)} /></Field>
        <Field label="Landmark"><input value={f.landmark} onChange={(e) => set('landmark', e.target.value)} /></Field>
        <Field label="City"><input value={f.city} onChange={(e) => set('city', e.target.value)} /></Field>
        <Field label="Pincode"><input value={f.pincode} onChange={(e) => set('pincode', e.target.value)} /></Field>
      </div>
      {/* Meal type checkboxes */}
      <div className="row" style={{ margin: '10px 0' }}>{cat.meals.map((m: any) => (<label key={m.type} className="row"><input type="checkbox" style={{ width: 'auto' }} checked={f.meals.includes(m.type)} onChange={() => toggle(m.type)} />{m.label}</label>))}</div>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      <Button onClick={submit} disabled={!f.customerId || !f.line1 || !f.meals.length}>Create and activate</Button>
    </Card>
  );
}

// Subscriptions list with a status filter
export default function SubscriptionsPage() {
  // ALL / ACTIVE / COMPLETED
  const [status, setStatus] = useState('ALL');
  // Is the manual form open?
  const [open, setOpen] = useState(false);
  // Load subscriptions for the filter
  const { data, error, loading, reload } = useApi<any[]>(`/admin/subscriptions?status=${status}`);
  return (
    <>
      {/* Title and the "Create manual subscription" toggle */}
      <PageHeader title="Subscriptions" sub="Plans, duration, payment and entitlements" action={<Button onClick={() => setOpen(!open)}>{open ? 'Close' : 'Create manual subscription'}</Button>} />
      {/* Manual creation form */}
      {open && <ManualForm onDone={reload} />}
      {/* Status filter */}
      <Segmented value={status} onChange={setStatus} options={[{ value: 'ALL', label: 'All' }, { value: 'ACTIVE', label: 'Active' }, { value: 'COMPLETED', label: 'Completed' }]} />
      {/* Loading state or the table (end date shows the current end; "orig" appears when it moved) */}
      {!data ? <Loading error={error} loading={loading} /> : (
        <Card>
          <Table head={['ID', 'Customer', 'Plan', 'Meals', 'Pref', 'Allergy', 'Progress', 'Dates', 'Payment', 'Status']}>
            {data.map((s) => (
              <tr key={s.id}>
                <td>{s.code}</td><td>{s.customer}</td><td>{s.plan}<small>{s.days} days</small></td>
                <td>{s.mealTypes.map((m: string) => MEAL_LABEL[m][0]).join(' + ')}</td><td>{s.diet.replace('_', '-')}</td>
                <td>{s.allergens.length ? s.allergens.join(', ') : s.allergy === 'NOT_DECLARED' ? 'Not declared' : 'None'}</td>
                <td>{s.progress}</td>
                <td>{fmtDate(s.start)} → {fmtDate(s.end)}{s.end !== s.originalEnd && s.originalEnd && <small>orig {fmtDate(s.originalEnd)}</small>}</td>
                <td>{s.payment}<small>{s.source}</small></td><td><StatusBadge status={s.status} /></td>
              </tr>
            ))}
          </Table>
        </Card>
      )}
    </>
  );
}
