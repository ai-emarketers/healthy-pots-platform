'use client';
/** Customer dashboard: schedule, pause, resume, reschedule, tracking, invoices, allergies, history. */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, useApi, fmtDate, fmtTime, inr, MEAL_LABEL, SEVERITY_LABEL } from '@/lib/api';
import { Button, Card, Field, Loading, Notice, PageHeader, Stat, Stats, StatusBadge, Table } from '@/components/ui';
import { AllergyForm, AllergyValue, emptyAllergy } from '@/components/AllergyForm';
import { MealCalendar } from '@/components/customer/MealCalendar';
import { mapUrl } from '@/lib/maps';

// The dashboard tabs, one per customer task
const TABS = ['My Goal & Meals', 'My Meal Schedule', 'Pause Meals', 'Resume Meals', 'Reschedule Meals', 'Track My Delivery', 'Invoices & Payments', 'Allergies & Diet', 'Subscription History'] as const;
// Type of a tab name (derived from TABS)
type Tab = (typeof TABS)[number];

/** Dashboard with one tab per customer task. */
// Main customer page: pick a subscription, then use the tabs
export default function CustomerDashboard() {
  // Load all of this customer's subscriptions
  const { data: subs, error, loading } = useApi<any[]>('/subscriptions/mine');
  // Selected subscription id
  const [id, setId] = useState('');
  // Selected tab (starts on the schedule)
  const [tab, setTab] = useState<Tab>('My Meal Schedule');
  // Auto-select the active subscription (or the latest one)
  useEffect(() => { if (subs?.length && !id) setId((subs.find((s) => s.status === 'ACTIVE') ?? subs[subs.length - 1]).id); }, [subs, id]);
  // Load full details of the selected subscription (null path = do nothing)
  const { data: d, reload } = useApi<any>(id ? `/subscriptions/${id}` : null);

  // Wait for the list
  if (!subs) return <Loading error={error} loading={loading} />;
  // New customer with no plan: show a "Start a subscription" call to action
  if (!subs.length)
    return (
      <>
        <PageHeader title="Welcome" sub="You do not have a subscription yet." />
        <Card><p>Tell us your goal. We cook, schedule and deliver the meals.</p><Link href="/customer/subscribe" className="btn primary">Start a subscription</Link></Card>
      </>
    );

  return (
    <>
      {/* Header with a "New subscription" button */}
      <PageHeader title="My dashboard" action={<Link href="/customer/subscribe" className="btn ghost">New subscription</Link>} />
      {/* Dropdown to switch between subscriptions */}
      <Field label="Subscription"><select value={id} onChange={(e) => setId(e.target.value)}>{subs.map((s) => <option key={s.id} value={s.id}>{s.code} · {s.plan} ({s.status.toLowerCase()})</option>)}</select></Field>
      {/* Everything below needs the loaded subscription */}
      {d && (
        <>
          {/* Progress counters */}
          <Stats>
            <Stat label="Total meals" value={d.progress.total} />
            <Stat label="Completed" value={d.progress.delivered} tone="good" />
            <Stat label="Remaining" value={d.progress.remaining} />
            <Stat label="Paused" value={d.progress.paused} tone={d.progress.paused ? 'warn' : undefined} />
          </Stats>
          {/* Progress % and the rule that a plan ends when all meals are delivered */}
          <Notice tone="info">{d.progress.percent}% complete. Estimated finish {fmtDate(d.progress.estimatedFinish)}{d.originalEnd && d.progress.estimatedFinish !== d.originalEnd ? ` (originally ${fmtDate(d.originalEnd)})` : ''}. A plan finishes when all {d.progress.total} meals are delivered, not after a fixed number of calendar days. Changes to next-day meals close at 5:00 PM IST the day before.</Notice>
          {/* Tab buttons */}
          <div className="tabs">{TABS.map((t) => <button key={t} className={t === tab ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>)}</div>
          {/* Only the selected tab is rendered */}
          {tab === 'My Goal & Meals' && <GoalTab d={d} />}
          {tab === 'My Meal Schedule' && <Card title="My Meal Schedule"><MealCalendar meals={d.meals} closed={d.closedDays} /><Legend /></Card>}
          {tab === 'Pause Meals' && <PauseTab d={d} reload={reload} />}
          {tab === 'Resume Meals' && <ResumeTab d={d} reload={reload} />}
          {tab === 'Reschedule Meals' && <RescheduleTab d={d} reload={reload} />}
          {tab === 'Track My Delivery' && <TrackTab id={d.id} />}
          {tab === 'Invoices & Payments' && <InvoicesTab />}
          {tab === 'Allergies & Diet' && <AllergyTab />}
          {tab === 'Subscription History' && <HistoryTab subs={subs} />}
        </>
      )}
    </>
  );
}

// Explains the letters and colours of the calendar chips
const Legend = () => <p className="muted" style={{ marginTop: 10 }}>B breakfast, L lunch, S snack, D dinner. Blue scheduled · grey locked · green delivered · amber paused · red exception.</p>;

/** Goal, meals and the fixed delivery addresses. */
// Plan summary and the fixed delivery addresses
function GoalTab({ d }: { d: any }) {
  return (
    <Card title="My Goal & Meals">
      <p><strong>{d.plan}</strong> · {d.mealTypes.map((m: string) => MEAL_LABEL[m]).join(', ')} · {d.diet.replace('_', '-')}</p>
      <p className="muted">{fmtDate(d.startDate)} to {fmtDate(d.progress.estimatedFinish)}</p>
      {/* One row per meal type with a map link */}
      <Table head={['Meal', 'Delivery address (fixed after payment)']}>
        {d.addresses.map((a: any) => (<tr key={a.id}><td>{MEAL_LABEL[a.mealType]}</td><td>{a.line1}{a.landmark ? `, ${a.landmark}` : ''}, {a.city} {a.pincode}{' '}<a href={mapUrl(a)} target="_blank" rel="noopener noreferrer">View on map</a></td></tr>))}
      </Table>
      <p className="muted">Addresses are fixed once you pay. Rescheduling changes dates only. Need a correction? Contact support.</p>
    </Card>
  );
}

/** Tracks which items are selected. */
// Small hook to keep a list of selected ids (toggle / clear)
function usePicker(initial: string[] = []) {
  const [sel, setSel] = useState<string[]>(initial);
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  return { sel, toggle, clear: () => setSel([]) };
}

/** Runs an action and shows its success or error message. */
// Hook: run an API action, show success/error text, then reload data
function useAction(reload: () => Promise<void>) {
  const [msg, setMsg] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null);
  // fn = the API call, ok = builds the success message from the result
  const run = async (fn: () => Promise<any>, ok: (r: any) => string) => {
    try { const r = await fn(); setMsg({ tone: 'good', text: ok(r) }); await reload(); } catch (e: any) { setMsg({ tone: 'bad', text: e.message }); }
  };
  return { msg, run };
}

// Meal types in display order
const MEAL_TYPES = ['BREAKFAST', 'LUNCH', 'SNACK', 'DINNER'] as const;

/** One selectable meal line (checkbox) used by pause and resume. */
// One meal line with an optional checkbox (used by pause and resume)
function MealRow({ m, checked, onToggle, note, disabled }: { m: any; checked?: boolean; onToggle?: () => void; note?: string; disabled?: boolean }) {
  return (
    <label className={`meal-row ${disabled ? 'disabled' : ''}`}>
      {/* Checkbox only when selection is allowed */}
      {onToggle && <input type="checkbox" checked={!!checked} disabled={disabled} onChange={onToggle} />}
      <span><strong>{m.label ?? MEAL_LABEL[m.mealType]}</strong> · {fmtDate(m.date)} · {m.code}{m.locked ? <em className="locked-tag"> Locked</em> : null}</span>
      {note && <small className="muted">{note}</small>}
    </label>
  );
}

/** Pause flow: choose meal types and dates, then the exact meals. */
// Pause flow in two steps: choose types + dates, then tick the exact meals
function PauseTab({ d, reload }: { d: any; reload: () => Promise<void> }) {
  // Selected meal types
  const [types, setTypes] = useState<string[]>([]);
  // Range start
  const [from, setFrom] = useState('');
  // Range end
  const [to, setTo] = useState('');
  // Preview list from the API (null = not loaded yet)
  const [list, setList] = useState<any[] | null>(null);
  // Meal ids ticked for pausing
  const [sel, setSel] = useState<string[]>([]);
  // Validation / API error
  const [err, setErr] = useState('');
  const { msg, run } = useAction(reload);
  // Toggle a meal type and clear the preview
  const toggleType = (t: string) => { setTypes((x) => (x.includes(t) ? x.filter((y) => y !== t) : [...x, t])); setList(null); };

  // Validate the form, then fetch the preview of affected meals
  async function show() {
    setErr('');
    if (!types.length) return setErr('Choose at least one meal type');
    if (!from || !to) return setErr('Choose a start and end date');
    if (to < from) return setErr('The end date must be on or after the start date');
    try { const r = await api(`/schedule/pause-preview?subscriptionId=${d.id}&mealTypes=${types.join(',')}&from=${from}&to=${to}`); setList(r.meals); setSel(r.meals.filter((m: any) => !m.locked).map((m: any) => m.id)); }
    catch (e: any) { setErr(e.message); }
  }
  // Tick / untick one meal
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  return (
    <Card title="Pause Meals">
      {/* Instructions */}
      <p className="muted">1. Choose the meals and dates. 2. Pick the exact meals to pause. Paused meals move to the end of your plan. Changes close at 5:00 PM IST the day before.</p>
      <p><strong>Which meals?</strong></p>
      <div className="row">{MEAL_TYPES.filter((t) => d.mealTypes.includes(t)).map((t) => <button key={t} type="button" className={`btn small ${types.includes(t) ? 'primary' : 'ghost'}`} onClick={() => toggleType(t)}>{MEAL_LABEL[t]}</button>)}</div>
      {/* Date range inputs and "Show meals" button */}
      <div className="row" style={{ marginTop: 10 }}>
        <Field label="From"><input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setList(null); }} /></Field>
        <Field label="To"><input type="date" value={to} min={from || undefined} onChange={(e) => { setTo(e.target.value); setList(null); }} /></Field>
        <Button onClick={show}>Show meals</Button>
      </div>
      {err && <Notice tone="bad">{err}</Notice>}
      {/* Preview and the final "Pause N meals" button (locked meals cannot be ticked) */}
      {list && (
        <div style={{ marginTop: 12 }}>
          {!list.length ? <p className="muted">No scheduled meals match those choices.</p> : (
            <>
              <div className="meal-list">{list.map((m) => <MealRow key={m.id} m={m} checked={sel.includes(m.id)} disabled={m.locked} onToggle={() => toggle(m.id)} />)}</div>
              <div style={{ marginTop: 12 }}><Button disabled={!sel.length} onClick={() => run(() => api('/schedule/pause', { body: { subscriptionId: d.id, mealIds: sel } }), (r) => { setList(null); setSel([]); return `${r.paused} meal(s) paused`; })}>Pause {sel.length} meal{sel.length === 1 ? '' : 's'}</Button></div>
            </>
          )}
        </div>
      )}
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
    </Card>
  );
}

/** Resume flow: paused meals with the day each would return on. */
// Resume flow: tick paused meals; each shows the day it would return on
function ResumeTab({ d, reload }: { d: any; reload: () => Promise<void> }) {
  // Load paused meals with proposed new dates
  const { data, error, loading, reload: reloadPreview } = useApi<{ meals: any[] }>(`/schedule/resume-preview?subscriptionId=${d.id}`);
  // Ticked meals
  const [sel, setSel] = useState<string[]>([]);
  // Action helper that reloads both the dashboard and this preview
  const { msg, run } = useAction(async () => { await reload(); await reloadPreview(); });
  if (!data) return <Loading error={error} loading={loading} />;
  // All paused meal ids (for "Select all")
  const all = data.meals.map((m) => m.id);
  // Tick / untick one meal
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  return (
    <Card title="Resume Meals">
      {/* Nothing paused, or the list with "Select all" and a Resume button */}
      {!data.meals.length ? <p className="muted">You have no paused meals.</p> : (
        <>
          <p className="muted">Resumed meals keep their meal IDs and are added after your last scheduled day.</p>
          <label className="meal-row"><input type="checkbox" checked={sel.length === all.length} onChange={() => setSel(sel.length === all.length ? [] : all)} /> <strong>Select all</strong></label>
          <div className="meal-list">{data.meals.map((m) => <MealRow key={m.id} m={m} checked={sel.includes(m.id)} onToggle={() => toggle(m.id)} note={`was ${fmtDate(m.wasDate)} · would resume on ${fmtDate(m.wouldResumeOn)}`} />)}</div>
          <div style={{ marginTop: 12 }}><Button disabled={!sel.length} onClick={() => run(() => api('/schedule/resume', { body: { subscriptionId: d.id, mealIds: sel } }), (r) => { setSel([]); return `${r.resumed} meal(s) resumed`; })}>Resume {sel.length} meal{sel.length === 1 ? '' : 's'}</Button></div>
        </>
      )}
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
    </Card>
  );
}

/** Reschedule flow: choose a meal, then a new date from the days we can deliver. */
// Reschedule flow: pick a meal, then one of the offered dates
function RescheduleTab({ d, reload }: { d: any; reload: () => Promise<void> }) {
  // Meal being moved
  const [meal, setMeal] = useState<any>(null);
  // Chosen new date
  const [date, setDate] = useState('');
  // Load allowed dates once a meal is chosen
  const { data: avail, error, loading } = useApi<{ dates: string[] }>(meal ? `/schedule/available-dates?mealId=${meal.id}` : null);
  // Action helper
  const { msg, run } = useAction(reload);
  // Only scheduled meals can be moved
  const upcoming = d.meals.filter((m: any) => m.status === 'SCHEDULED');
  return (
    <Card title="Reschedule Meals">
      <p className="muted">1. Choose the meal to move. 2. Choose a new date from the days we can deliver. Locked meals cannot be moved.</p>
      {/* Radio list of movable meals (locked ones disabled) */}
      <div className="meal-list">
        {upcoming.map((m: any) => (
          <label key={m.id} className={`meal-row ${m.locked ? 'disabled' : ''}`}>
            <input type="radio" name="resched" disabled={m.locked} checked={meal?.id === m.id} onChange={() => { setMeal(m); setDate(''); }} />
            <span><strong>{MEAL_LABEL[m.mealType]}</strong> · {fmtDate(m.date)} · {m.code}{m.locked ? <em className="locked-tag"> Locked</em> : null}</span>
          </label>
        ))}
        {!upcoming.length && <p className="muted">No scheduled meals to move.</p>}
      </div>
      {/* Date buttons and the "Move meal" button appear after choosing a meal */}
      {meal && (
        <div style={{ marginTop: 12 }}>
          <p><strong>Move {meal.code} to</strong></p>
          {!avail ? <Loading error={error} loading={loading} /> : !avail.dates.length ? <Notice tone="warn">No open dates right now. Try again later.</Notice> : (
            <div className="row">{avail.dates.map((x) => <button key={x} type="button" className={`btn small ${date === x ? 'primary' : 'ghost'}`} onClick={() => setDate(x)}>{fmtDate(x)}</button>)}</div>
          )}
          <div style={{ marginTop: 12 }}><Button disabled={!date} onClick={() => run(() => api('/schedule/reschedule', { body: { mealId: meal.id, newDate: date } }), (r) => { setMeal(null); setDate(''); return `Moved to ${fmtDate(r.date)}`; })}>Move meal</Button></div>
        </div>
      )}
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
    </Card>
  );
}

/** Five day tabs with a delivery status stepper per meal. */
// Delivery tracking with day tabs and a progress stepper
function TrackTab({ id }: { id: string }) {
  // Middle day of the 5-day window ('' = today)
  const [center, setCenter] = useState('');
  // Selected day tab
  const [day, setDay] = useState('');
  // Load tracking data for that window
  const { data, error, loading } = useApi<any>(`/subscriptions/${id}/tracking${center ? `?date=${center}` : ''}`);
  // Default to today once loaded
  useEffect(() => { if (data && !day) setDay(data.today); }, [data, day]);
  if (!data) return <Loading error={error} loading={loading} />;
  // Meals of the selected day
  const shown = data.meals.filter((m: any) => m.date === (day || data.today));
  // "Today" or a formatted date
  const label = (x: string) => (x === data.today ? 'Today' : fmtDate(x));
  return (
    <Card title="Track My Delivery">
      {/* Day tabs */}
      <div className="tabs">{data.days.map((x: string) => <button key={x} className={x === (day || data.today) ? 'on' : ''} onClick={() => setDay(x)}>{label(x)}</button>)}</div>
      {/* Move the 5-day window earlier/later by 5 days */}
      <div className="row" style={{ marginBottom: 8 }}>
        <Button small kind="ghost" onClick={() => { const c = new Date(`${data.center}T00:00:00Z`); c.setUTCDate(c.getUTCDate() - 5); setCenter(c.toISOString().slice(0, 10)); setDay(''); }}>Earlier days</Button>
        <Button small kind="ghost" onClick={() => { const c = new Date(`${data.center}T00:00:00Z`); c.setUTCDate(c.getUTCDate() + 5); setCenter(c.toISOString().slice(0, 10)); setDay(''); }}>Later days</Button>
      </div>
      {!shown.length && <p className="muted">No deliveries on this day.</p>}
      {/* One card per meal */}
      {shown.map((m: any) => (
        <div key={m.id} className="track-card">
          <div className="row" style={{ justifyContent: 'space-between' }}><strong>{m.label} · {m.code}</strong><StatusBadge status={m.delivery?.status ?? m.status} /></div>
          <p className="muted">{m.dish ?? 'Dish to be confirmed'} · Delivery window {m.window}{m.address ? ` · ${m.address}` : ''}</p>
          {/* Stepper: steps up to the current stage are "done"; after a failure the rest turn red */}
          <ul className="tracker">{data.steps.map((st: string, i: number) => <li key={st} className={m.failed && i > m.stage ? 'fail' : i <= m.stage ? 'done' : ''}>{st}</li>)}</ul>
          {/* Warning for failed deliveries */}
          {m.failed && <Notice tone="bad">Delivery could not be completed{m.failureNote ? `: ${m.failureNote}` : ''}. Our team is sorting this out. It will not count as a delivered meal until it is resolved.</Notice>}
        </div>
      ))}
    </Card>
  );
}

/** Payments and GST invoices. */
// Payment history and invoices
function InvoicesTab() {
  const { data, error, loading } = useApi<any[]>('/payments/mine');
  if (!data) return <Loading error={error} loading={loading} />;
  // Fetch one invoice and show its summary in a popup
  const view = async (n: string) => {
    const i = await api(`/invoice?number=${encodeURIComponent(n)}`);
    window.alert(`Tax invoice ${i.number}\n${i.plan} (${i.subscription})\nTaxable ${inr(i.taxable)}\nGST ${inr(i.gst)}\nTotal ${inr(i.total)}`);
  };
  return (
    <Card title="Invoices & Payments">
      <Table head={['Date', 'Payment', 'Subscription', 'Method', 'Amount', 'Status', 'Invoice']}>
        {data.map((p) => (<tr key={p.code}><td>{p.date}</td><td>{p.code}</td><td>{p.subscription ?? '–'}</td><td>{p.method ?? '–'}</td><td>{inr(p.amount)}</td><td><StatusBadge status={p.status} /></td><td>{p.invoice ? <Button small kind="ghost" onClick={() => view(p.invoice)}>{p.invoice}</Button> : '–'}</td></tr>))}
      </Table>
    </Card>
  );
}

/** Allergy and diet preferences, sent to the kitchen with each meal. */
// Edit the allergy declaration after subscribing
function AllergyTab() {
  // Allergen list
  const { data: opts } = useApi<any>('/me/allergy-options');
  // Saved profile and allergies
  const { data: me, reload } = useApi<any>('/me/profile');
  // Form state
  const [form, setForm] = useState<AllergyValue>({ ...emptyAllergy });
  // Success / error text
  const [msg, setMsg] = useState<any>(null);
  // load what the customer saved before
  // Convert the saved profile into form values (known allergens vs free-text "other")
  useEffect(() => {
    if (!me || !opts) return;
    setForm({
      status: me.allergySeverity === 'NONE' ? 'NONE' : me.allergySeverity === 'NOT_DECLARED' ? 'SKIP' : 'HAS',
      allergens: me.allergens.filter((a: string) => opts.allergens.includes(a)),
      other: me.allergens.filter((a: string) => !opts.allergens.includes(a)).join(', '),
      severity: me.allergySeverity && !['NONE', 'NOT_DECLARED'].includes(me.allergySeverity) ? me.allergySeverity : 'MODERATE',
      dislikes: me.dislikes ?? '',
      notes: me.allergyNotes ?? '',
    });
  }, [me, opts]);
  // Wait for data
  if (!opts || !me) return <Loading />;
  // Validate and PUT /me/allergies
  async function save() {
    if (form.status === 'HAS' && !form.allergens.length && !form.other.trim()) return setMsg({ tone: 'bad', text: 'Tick at least one allergen or type it below.' });
    try { await api('/me/allergies', { method: 'PUT', body: form }); setMsg({ tone: 'good', text: 'Saved. The kitchen and our admin team will see this on your next meals.' }); reload(); }
    catch (e: any) { setMsg({ tone: 'bad', text: e.message }); }
  }
  return (
    <Card title="Allergies & Diet">
      <p className="muted">Anyone can have an allergy to any food. Your answers go to the kitchen and our admin team with each meal, and we flag any dish that contains something you listed.</p>
      <AllergyForm value={form} options={opts.allergens} onChange={(v) => { setForm(v); setMsg(null); }} />
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      <Button onClick={save}>Save</Button>
    </Card>
  );
}

/** All subscriptions with View, Renew and Choose a new plan. */
// All subscriptions with View / Renew / New plan actions
function HistoryTab({ subs }: { subs: any[] }) {
  // Which subscription's meal list is expanded
  const [open, setOpen] = useState('');
  return (
    <Card title="Subscription History">
      {!subs.length && <p className="muted">No subscriptions yet.</p>}
      {/* Newest subscription first */}
      {[...subs].reverse().map((s) => (
        <div key={s.id} className="track-card">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <strong>{s.code} · {s.plan}</strong><StatusBadge status={s.status} />
          </div>
          <p className="muted">{s.mealTypes.map((m: string) => MEAL_LABEL[m]).join(', ')} · {fmtDate(s.startDate)} → {fmtDate(s.progress.estimatedFinish)}</p>
          <p>{s.progress.total} meals, {s.progress.delivered} delivered{s.progress.paused ? `, ${s.progress.paused} paused` : ''}</p>
          <div className="row">
            <Button small kind="ghost" onClick={() => setOpen(open === s.id ? '' : s.id)}>{open === s.id ? 'Hide' : 'View'}</Button>
            <Link href={`/customer/subscribe?plan=${s.planSlug ?? ''}`} className="btn small primary">Renew this plan</Link>
            <Link href="/customer/subscribe" className="btn small ghost">Choose a new plan</Link>
          </div>
          {open === s.id && <HistoryDetail id={s.id} />}
        </div>
      ))}
    </Card>
  );
}

/** Every meal of a past subscription. */
// Every meal of one subscription
function HistoryDetail({ id }: { id: string }) {
  const { data, error, loading } = useApi<any>(`/subscriptions/${id}`);
  if (!data) return <Loading error={error} loading={loading} />;
  return (
    <Table head={['Meal ID', 'Meal', 'Date', 'Status']}>
      {data.meals.map((m: any) => (<tr key={m.id}><td>{m.code}</td><td>{MEAL_LABEL[m.mealType]}</td><td>{fmtDate(m.date)}</td><td><StatusBadge status={m.delivery?.status === 'FAILED' ? 'FAILED' : m.status} /></td></tr>))}
    </Table>
  );
}
