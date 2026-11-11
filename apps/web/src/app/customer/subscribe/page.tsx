'use client';
/** Six-step subscription builder with live price panel and validation. */
import { useEffect, useMemo, useState } from 'react';
import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AllergyForm, emptyAllergy } from '@/components/AllergyForm';
import { addressErrors, emailError, Errors, hasErrors, nameError, numberError, pincodeError } from '@/lib/validate';
import { api, useApi, fmtDate, fmtTime, inr, MEAL_LABEL, SEVERITY_LABEL } from '@/lib/api';
import { Badge, Button, Card, Field, Loading, Notice, PageHeader, Segmented, Table } from '@/components/ui';

const STEPS = ['Goal', 'About you', 'Your meals', 'Allergies', 'Delivery addresses', 'Meals and price'];
const DIETS = [['VEG', 'Vegetarian'], ['NON_VEG', 'Non-Vegetarian'], ['EGG', 'Eggetarian'], ['MIXED', 'Mixed day by day']];
const emptyAddr = { line1: '', landmark: '', city: 'Kolkata', pincode: '' };

/** Wrapper that provides Suspense for reading ?plan=. */
export default function SubscribePage() {
  return (
    <Suspense>
      <Wizard />
    </Suspense>
  );
}

/** The six-step subscription builder. */
function Wizard() {
  const router = useRouter();
  const preset = useSearchParams().get('plan');
  const { data: cat, error, loading } = useApi<any>('/catalog/plans');
  const { data: me } = useApi<any>('/me/profile');
  const { data: opts } = useApi<any>('/me/allergy-options');
  const [step, setStep] = useState(0);
  const [plan, setPlan] = useState<any>(null);
  const [days, setDays] = useState(14);
  const [meals, setMeals] = useState<string[]>(['BREAKFAST', 'LUNCH', 'DINNER']);
  const [diet, setDiet] = useState('VEG');
  const [start, setStart] = useState('');
  const [profile, setProfile] = useState<any>({ name: '', email: '', city: 'Kolkata', gender: '', age: '', weightKg: '', ft: '', inch: '' });
  const [allergy, setAllergy] = useState<any>({ ...emptyAllergy });
  const [sameAddr, setSameAddr] = useState(true);
  const [addr, setAddr] = useState<Record<string, any>>({});
  const [svc, setSvc] = useState<Record<string, string>>({});
  const [coupon, setCoupon] = useState('');
  const [quote, setQuote] = useState<any>(null);
  const [msg, setMsg] = useState<{ tone: 'good' | 'bad' | 'warn'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [areaPin, setAreaPin] = useState('');
  const [areaMsg, setAreaMsg] = useState('');

  useEffect(() => { if (cat && !start) setStart(cat.startDates[0]); }, [cat, start]);
  // arriving from the public goals page with ?plan=slug: skip the goal step
  useEffect(() => { if (cat && preset && !plan) { const p = cat.plans.find((x: any) => x.slug === preset); if (p) { setPlan(p); setStep(1); } } }, [cat, preset, plan]);
  useEffect(() => {
    if (!me) return;
    setProfile((p: any) => ({ ...p, name: me.name ?? '', email: me.email ?? '', city: me.city ?? 'Kolkata', gender: me.gender ?? '', age: me.age ?? '', weightKg: me.weightKg ?? '' }));
    if (me.addresses?.length) setAddr((a) => ({ ...a }));
  }, [me]);

  const orderedMeals = useMemo(() => (cat ? cat.meals.map((m: any) => m.type).filter((t: string) => meals.includes(t)) : meals), [cat, meals]);
  const addrKey = (mt: string) => (sameAddr ? orderedMeals[0] : mt);
  const getAddr = (mt: string) => addr[addrKey(mt)] ?? emptyAddr;
  const setAddrField = (mt: string, k: string, v: string) => setAddr((a) => ({ ...a, [addrKey(mt)]: { ...(a[addrKey(mt)] ?? emptyAddr), [k]: v } }));
  const bmi = profile.weightKg && profile.ft ? (Number(profile.weightKg) / Math.pow((Number(profile.ft) * 12 + Number(profile.inch || 0)) * 0.0254, 2)).toFixed(1) : null;
  const pincodes = Object.fromEntries(orderedMeals.map((m: string) => [m, getAddr(m).pincode]));

  async function checkPin(mt: string) {
    const pin = getAddr(mt).pincode;
    const r = await api(`/catalog/serviceability?pincode=${pin}`);
    setSvc((s) => ({ ...s, [addrKey(mt)]: r.serviceable ? `We deliver to ${r.area} (zone ${r.zone}).` : `Sorry, we do not deliver to ${pin} yet.` }));
  }

  async function loadQuote() {
    try { setQuote(await api('/catalog/quote', { body: { planSlug: plan.slug, days, mealTypes: orderedMeals, pincodes, coupon: coupon || undefined } })); setMsg(null); }
    catch (e: any) { setMsg({ tone: 'bad', text: e.message }); }
  }
  useEffect(() => { if ((step === 2 || step === 5) && plan && orderedMeals.length) loadQuote(); /* eslint-disable-next-line */ }, [step, days, orderedMeals.join(',')]);

  async function checkArea() {
    if (!areaPin.trim()) return setAreaMsg('Enter a pincode');
    try { const r = await api(`/catalog/serviceability?pincode=${areaPin.trim()}`); setAreaMsg(r.serviceable ? `Yes, we deliver to ${r.area}.` : `Sorry, we do not deliver to ${areaPin} yet.`); }
    catch (x: any) { setAreaMsg(x.message); }
  }

  function validate(): Errors {
    const e: Errors = {};
    if (step === 1) {
      const n = nameError(profile.name); if (n) e.name = n;
      const m = emailError(profile.email); if (m) e.email = m;
      const a = numberError(profile.age, 'Age', 10, 100); if (a) e.age = a;
      const w = numberError(profile.weightKg, 'Weight', 20, 300); if (w) e.weightKg = w;
      const f = numberError(profile.ft, 'Height (feet)', 3, 8); if (f) e.ft = f;
      const i = numberError(profile.inch, 'Inches', 0, 11); if (i) e.inch = i;
    }
    if (step === 2) {
      if (!orderedMeals.length) e.meals = 'Choose at least one meal';
      if (!start) e.start = 'Choose a start date';
    }
    if (step === 3 && allergy.status === 'HAS' && !allergy.allergens.length && !allergy.other.trim()) e.allergy = 'Tap at least one allergen or type it below';
    if (step === 4) {
      for (const mt of sameAddr ? [orderedMeals[0]] : orderedMeals) {
        const ae = addressErrors(getAddr(mt));
        for (const [k, v] of Object.entries(ae)) e[`${addrKey(mt)}.${k}`] = v;
      }
    }
    return e;
  }

  async function next() {
    setMsg(null);
    const er = validate();
    setErrors(er);
    if (hasErrors(er)) return setMsg({ tone: 'bad', text: 'Please fix the highlighted fields.' });
    try {
      if (step === 1) await api('/me/profile', { method: 'PATCH', body: { name: profile.name, email: profile.email || undefined, city: profile.city, gender: profile.gender || undefined, age: profile.age ? Number(profile.age) : undefined, weightKg: profile.weightKg ? Number(profile.weightKg) : undefined, heightCm: profile.ft ? Math.round((Number(profile.ft) * 12 + Number(profile.inch || 0)) * 2.54) : undefined } });
      if (step === 3) await api('/me/allergies', { method: 'PUT', body: allergy });
      setStep(step + 1);
    } catch (e: any) { setMsg({ tone: 'bad', text: e.message }); }
  }

  async function pay() {
    setBusy(true); setMsg(null);
    try {
      const addresses = Object.fromEntries(orderedMeals.map((m: string) => [m, getAddr(m)]));
      const r = await api('/subscriptions/checkout', { body: { planSlug: plan.slug, days, mealTypes: orderedMeals, diet, startDate: start, perMealAddress: !sameAddr, addresses, coupon: coupon || undefined } });
      try {
        await api(`/payments/${r.payment.code}/confirm`, { body: { method: 'UPI' } });
        router.replace('/customer');
      } catch (e: any) {
        setMsg({ tone: 'warn', text: `Order ${r.subscription.code} created. ${e.message}` });
      }
    } catch (e: any) { setMsg({ tone: 'bad', text: e.message }); }
    finally { setBusy(false); }
  }

  if (!cat) return <Loading error={error} loading={loading} />;
  const setP = (k: string, v: any) => setProfile((p: any) => ({ ...p, [k]: v }));
  const multi = cat.multiMeal[String(orderedMeals.length)] ?? 0;
  const dur = cat.durations.find((d: any) => d.days === days)?.discount ?? 0;

  return (
    <>
      <PageHeader title="Tell us your goal" sub="We cook, schedule and deliver the meals." />
      <div className="steps">{STEPS.map((s, i) => <span key={s} className={i === step ? 'on' : i < step ? 'done' : ''}>{i === 0 ? '' : `${i}. `}{s}</span>)}</div>

      {step === 0 && (
        <>
          {['GOAL', 'HEALTH'].map((g) => (
            <div key={g}>
              <h2>{g === 'GOAL' ? 'What is your goal?' : 'Health-condition goals'}</h2>
              <div className="choice-grid" style={{ marginBottom: 18 }}>
                {cat.plans.filter((p: any) => p.group === g).map((p: any) => (
                  <button key={p.slug} className={`choice ${plan?.slug === p.slug ? 'on' : ''}`} onClick={() => { setPlan(p); setStep(1); }}>
                    <strong>{p.name}</strong><small>{p.description}</small>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      {step === 1 && (
        <Card title="About you">
          <p className="muted">Your goal: {plan.name}. {plan.description}. Our dietitian uses this to portion your meals.</p>
          <div className="grid2">
            <Field label="Full name" error={errors.name}><input value={profile.name} maxLength={80} onChange={(e) => setP('name', e.target.value)} /></Field>
            <Field label="Phone"><input value={me?.phone ?? ''} disabled /></Field>
            <Field label="Email address" error={errors.email}><input type="email" value={profile.email} onChange={(e) => setP('email', e.target.value)} /></Field>
            <Field label="State / city"><select value={profile.city} onChange={(e) => setP('city', e.target.value)}>{['Kolkata', 'Delhi NCR', 'Bangalore', 'Mumbai', 'Pune', 'Hyderabad'].map((c) => <option key={c}>{c}</option>)}</select></Field>
            <Field label="Gender"><select value={profile.gender} onChange={(e) => setP('gender', e.target.value)}><option value="">Select</option><option>Female</option><option>Male</option><option>Other</option></select></Field>
            <Field label="Age" error={errors.age}><input inputMode="numeric" value={profile.age} onChange={(e) => setP('age', e.target.value)} /></Field>
            <Field label="Weight (kg)" error={errors.weightKg}><input inputMode="decimal" value={profile.weightKg} onChange={(e) => setP('weightKg', e.target.value)} /></Field>
            <Field label="Height (feet)" error={errors.ft}><input inputMode="numeric" value={profile.ft} onChange={(e) => setP('ft', e.target.value)} /></Field>
            <Field label="Height (inches)" error={errors.inch}><input inputMode="numeric" value={profile.inch} onChange={(e) => setP('inch', e.target.value)} /></Field>
          </div>
          {bmi && <p className="muted">BMI {bmi}. Optional.</p>}
        </Card>
      )}

      {step === 2 && (
        <Card title={`Build your ${plan.name} subscription`}>
          <p className="muted">Choose duration, meals and preference. The price updates as you go.</p>
          <h3>1. Duration</h3>
          <div className="choice-grid" style={{ margin: '8px 0 16px' }}>
            {cat.durations.map((d: any) => (<button key={d.days} className={`choice ${days === d.days ? 'on' : ''}`} onClick={() => setDays(d.days)}><strong>{d.days} delivery days</strong><small>{d.discount ? `${d.discount}% off` : 'Try us first'}</small></button>))}
          </div>
          <p className="muted">Counts delivery days. Non-operating days and kitchen-closed days are skipped.</p>
          <h3>2. Meals per day</h3>
          <div className="choice-grid" style={{ margin: '8px 0 16px' }}>
            {cat.meals.map((m: any) => {
              const on = meals.includes(m.type);
              return (<button key={m.type} className={`choice ${on ? 'on' : ''}`} onClick={() => setMeals(on ? meals.filter((x) => x !== m.type) : [...meals, m.type])}><strong>{m.label}</strong><small>{plan.rates[m.type] ? inr(plan.rates[m.type]) + ' · ' : ''}{m.window}</small></button>);
            })}
          </div>
          {errors.meals && <small className="error-text">{errors.meals}</small>}
          <Notice tone="info">{orderedMeals.length} meal(s) a day{multi ? `, ${multi}% multi-meal saving` : ''}.{dur ? ` ${dur}% duration discount.` : ''}</Notice>
          <h3>3. Meal preference</h3>
          <div style={{ margin: '8px 0 16px' }}><Segmented value={diet} onChange={setDiet} options={DIETS.map(([value, label]) => ({ value, label }))} /></div>
          <h3>4. Start date</h3>
          <div style={{ margin: '8px 0' }}><Segmented value={start} onChange={setStart} options={cat.startDates.map((d: string) => ({ value: d, label: fmtDate(d) }))} /></div>
          <p className="muted">Meals for {fmtDate(cat.cutoff.service)} can still be booked until {fmtTime(cat.cutoff.closesAt)}.</p>
          <h3 style={{ marginTop: 16 }}>5. Do we deliver to your area?</h3>
          <div className="row" style={{ margin: '8px 0' }}>
            <input style={{ width: 160 }} maxLength={12} placeholder="Pincode" value={areaPin} onChange={(e) => { setAreaPin(e.target.value); setAreaMsg(''); }} />
            <Button small kind="ghost" onClick={checkArea}>Check</Button>
            <span className="muted">{areaMsg}</span>
          </div>
          <PricePanel quote={quote} orderedMeals={orderedMeals} cat={cat} plan={plan} days={days} />
        </Card>
      )}

      {step === 3 && opts && (
        <Card title="Allergies and foods to avoid">
          <p className="muted">Anyone can have an allergy to any food. Tell us now and we pass it to the kitchen with every {plan.name} meal.</p>
          <AllergyForm value={allergy} options={opts.allergens} onChange={(v) => { setAllergy(v); setErrors((e) => ({ ...e, allergy: '' })); }} error={errors.allergy} />
          <p className="muted">You can change this later from Allergies &amp; Diet in your dashboard.</p>
        </Card>
      )}

      {step === 4 && (
        <Card title="Where should we deliver?">
          <p className="muted">Send every meal to one address, or give each its own. For example breakfast at home, lunch at the office, dinner at a parent&apos;s home.</p>
          <Segmented value={sameAddr ? 'one' : 'each'} onChange={(v) => setSameAddr(v === 'one')} options={[{ value: 'one', label: 'Yes, one address' }, { value: 'each', label: 'No, a different address per meal' }]} />
          {(sameAddr ? [orderedMeals[0]] : orderedMeals).map((mt: string) => (
            <div key={mt} style={{ marginTop: 16 }}>
              <h3>{sameAddr ? `All selected meals (${orderedMeals.map((m: string) => MEAL_LABEL[m]).join(', ')})` : MEAL_LABEL[mt]}</h3>
              {me?.addresses?.length > 0 && <div className="row" style={{ margin: '6px 0' }}><span className="muted">Use a saved address:</span>{me.addresses.map((a: any) => <button key={a.id} className="btn small ghost" onClick={() => setAddr((x) => ({ ...x, [addrKey(mt)]: { line1: a.line1, landmark: a.landmark ?? '', city: a.city, pincode: a.pincode } }))}>{a.label}</button>)}</div>}
              <div className="grid2">
                <Field label="House or flat number and street" error={errors[`${addrKey(mt)}.line1`]}><input value={getAddr(mt).line1} onChange={(e) => setAddrField(mt, 'line1', e.target.value)} /></Field>
                <Field label="Area or landmark"><input value={getAddr(mt).landmark} onChange={(e) => setAddrField(mt, 'landmark', e.target.value)} /></Field>
                <Field label="City" error={errors[`${addrKey(mt)}.city`]}><input value={getAddr(mt).city} onChange={(e) => setAddrField(mt, 'city', e.target.value)} /></Field>
                <Field label="Pincode (optional)" error={errors[`${addrKey(mt)}.pincode`]}><input maxLength={12} value={getAddr(mt).pincode} onChange={(e) => setAddrField(mt, 'pincode', e.target.value)} /></Field>
              </div>
              <div className="row"><Button small kind="ghost" onClick={() => checkPin(mt)}>Check serviceability</Button><span className="muted">{svc[addrKey(mt)] ?? 'Not checked yet.'}</span></div>
            </div>
          ))}
          <Notice tone="info">Addresses are fixed once you pay. After payment, rescheduling changes dates only. There is no address editing in the dashboard.</Notice>
        </Card>
      )}

      {step === 5 && (
        <Card title="Meals and price">
          <p className="muted">Check your goal, meals, addresses and price, then pay.</p>
          <Table head={['', '']}>
            <tr><td>Goal</td><td>{plan.name}, {days} delivery days</td></tr>
            <tr><td>Dates</td><td>Starting {fmtDate(start)}</td></tr>
            <tr><td>Meals</td><td>{orderedMeals.map((m: string) => `${days} × ${MEAL_LABEL[m].toLowerCase()}`).join(', ')} · {days * orderedMeals.length} individual meals</td></tr>
            <tr><td>Food preference</td><td>{DIETS.find(([v]) => v === diet)?.[1]}</td></tr>
            <tr><td>Delivery</td><td>{orderedMeals.map((m: string) => <div key={m}>{MEAL_LABEL[m]}: {getAddr(m).line1}, {getAddr(m).city} {getAddr(m).pincode}</div>)}</td></tr>
            <tr><td>Allergies</td><td>{allergy.status === 'HAS' ? [...allergy.allergens, allergy.other].filter(Boolean).join(', ') + ` (${SEVERITY_LABEL[allergy.severity]})` : allergy.status === 'NONE' ? 'No allergies' : 'Not declared'}</td></tr>
          </Table>
          {quote && (
            <>
              <h3 style={{ marginTop: 16 }}>Your price</h3>
              <PricePanel quote={quote} orderedMeals={orderedMeals} cat={cat} plan={plan} days={days} compact />
              <Table head={['Item', 'Amount']}>
                {quote.lines.map((l: any) => (<tr key={l.label}><td>{l.label}</td><td>{l.amount < 0 ? '−' : ''}{inr(Math.abs(l.amount))}</td></tr>))}
                <tr><td><strong>Total payable</strong></td><td className="price-total">{inr(quote.total)}</td></tr>
              </Table>
              <div className="row" style={{ margin: '10px 0' }}>
                <input style={{ width: 200 }} placeholder="Coupon code" value={coupon} onChange={(e) => setCoupon(e.target.value)} />
                <Button small kind="ghost" onClick={loadQuote}>Apply</Button>
              </div>
            </>
          )}
          <p className="muted">Your subscription starts only after payment is confirmed. Addresses are fixed after payment. Changes to next-day meals close at 5:00 PM IST the day before.</p>
        </Card>
      )}

      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      {step > 0 && (
        <div className="row">
          <Button kind="ghost" onClick={() => setStep(step - 1)}>Previous</Button>
          {step < 5 ? <Button onClick={next} disabled={step === 2 && !orderedMeals.length}>Next: {STEPS[step + 1].toLowerCase()}</Button> : <Button onClick={pay} disabled={busy || !quote}>Confirm and pay {quote ? inr(quote.total) : ''}</Button>}
        </div>
      )}
    </>
  );
}

/** The prototype's live price card: struck-through original, final price, saving, and the "shop more, save more" nudge. */
function PricePanel({ quote, orderedMeals, cat, plan, days, compact }: { quote: any; orderedMeals: string[]; cat: any; plan: any; days: number; compact?: boolean }) {
  if (!quote) return null;
  const nextMulti = cat.multiMeal[String(orderedMeals.length + 1)] ?? 0;
  const curMulti = cat.multiMeal[String(orderedMeals.length)] ?? 0;
  return (
    <div className="price-panel">
      <div className="pp-row"><span>Price per day</span><span>{quote.savedPerDay > 0 && <span className="strike">{inr(quote.originalPerDay)}</span>}<strong>{inr(quote.pricePerDay)}</strong></span></div>
      {quote.savedPerDay > 0 && <p className="good-text">Save {inr(quote.savedPerDay)} a day. Flat {quote.discountPct}% applied.</p>}
      <div className="pp-row"><span>Effective price per meal</span><span>{quote.savedPerDay > 0 && <span className="strike">{inr(quote.originalPerMeal)}</span>}<strong>{inr(quote.effectivePerMeal)}</strong></span></div>
      {!compact && orderedMeals.length < 4 && nextMulti > curMulti && <p className="muted">SHOP FOR MORE AND SAVE MORE: add one more meal a day to save {nextMulti}%.</p>}
      {!compact && (
        <div className="pp-summary">
          <strong>Your meal summary</strong>
          <p className="muted">{plan.name} · {days} delivery days · {quote.totalMeals} meals</p>
          {orderedMeals.map((m) => (<div key={m} className="pp-row"><span>{MEAL_LABEL[m]}</span><span>{plan.rates[m] ? `${inr(plan.rates[m])} × ${days}` : ''}</span></div>))}
        </div>
      )}
    </div>
  );
}
