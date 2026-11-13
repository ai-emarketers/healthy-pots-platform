'use client';
/** Six-step subscription builder with live price panel and validation. */
import { useEffect, useMemo, useState } from 'react';
import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AllergyForm, emptyAllergy } from '@/components/AllergyForm';
import { AddressPicker } from '@/components/AddressPicker';
import { addressErrors, emailError, Errors, hasErrors, nameError, numberError, pincodeError } from '@/lib/validate';
import { api, useApi, fmtDate, fmtTime, inr, MEAL_LABEL, SEVERITY_LABEL } from '@/lib/api';
import { Badge, Button, Card, Field, Loading, Notice, PageHeader, Segmented, Table } from '@/components/ui';

// Wizard step names
const STEPS = ['Goal', 'About you', 'Your meals', 'Allergies', 'Delivery addresses', 'Meals and price'];
// Diet options [value, label]
const DIETS = [['VEG', 'Vegetarian'], ['NON_VEG', 'Non-Vegetarian'], ['EGG', 'Eggetarian'], ['MIXED', 'Mixed day by day']];
// Blank address object
const emptyAddr = { line1: '', landmark: '', city: 'Kolkata', pincode: '', mapLink: '' };

/** Wrapper that provides Suspense for reading ?plan=. */
// Page component; Suspense is required for useSearchParams
export default function SubscribePage() {
  return (
    <Suspense>
      <Wizard />
    </Suspense>
  );
}

/** The six-step subscription builder. */
// The six-step subscription builder: goal, about you, meals, allergies, addresses, price and payment
function Wizard() {
  // For redirecting after payment
  const router = useRouter();
  // ?plan=slug coming from the public goals page
  const preset = useSearchParams().get('plan');
  // Catalog: plans, durations, discounts, start dates, cutoff
  const { data: cat, error, loading } = useApi<any>('/catalog/plans');
  // Customer profile with saved addresses
  const { data: me } = useApi<any>('/me/profile');
  // Allergen options
  const { data: opts } = useApi<any>('/me/allergy-options');
  // Current step number (0 to 5)
  const [step, setStep] = useState(0);
  // Chosen plan
  const [plan, setPlan] = useState<any>(null);
  // Plan length in delivery days
  const [days, setDays] = useState(14);
  // Selected meal types
  const [meals, setMeals] = useState<string[]>(['BREAKFAST', 'LUNCH', 'DINNER']);
  // Food preference
  const [diet, setDiet] = useState('VEG');
  // Start date
  const [start, setStart] = useState('');
  // "About you" form values
  const [profile, setProfile] = useState<any>({ name: '', email: '', city: 'Kolkata', gender: '', age: '', weightKg: '', ft: '', inch: '' });
  // Allergy form values
  const [allergy, setAllergy] = useState<any>({ ...emptyAllergy });
  // One address for all meals, or one per meal
  const [sameAddr, setSameAddr] = useState(true);
  // Addresses keyed by meal type
  const [addr, setAddr] = useState<Record<string, any>>({});
  // Serviceability message per address
  const [svc, setSvc] = useState<Record<string, string>>({});
  // Coupon code typed by the user
  const [coupon, setCoupon] = useState('');
  // Latest price from the API
  const [quote, setQuote] = useState<any>(null);
  // Banner message
  const [msg, setMsg] = useState<{ tone: 'good' | 'bad' | 'warn'; text: string } | null>(null);
  // True while paying
  const [busy, setBusy] = useState(false);
  // Validation errors keyed by field
  const [errors, setErrors] = useState<Errors>({});
  // Pincode typed in "Do we deliver to your area?"
  const [areaPin, setAreaPin] = useState('');
  // Answer for that check
  const [areaMsg, setAreaMsg] = useState('');

  // Default start date = first available
  useEffect(() => { if (cat && !start) setStart(cat.startDates[0]); }, [cat, start]);
  // arriving from the public goals page with ?plan=slug: skip the goal step
  // Plan came from the URL: pre-select it and skip the goal step
  useEffect(() => { if (cat && preset && !plan) { const p = cat.plans.find((x: any) => x.slug === preset); if (p) { setPlan(p); setStep(1); } } }, [cat, preset, plan]);
  // Pre-fill the form with the customer's saved profile
  useEffect(() => {
    if (!me) return;
    setProfile((p: any) => ({ ...p, name: me.name ?? '', email: me.email ?? '', city: me.city ?? 'Kolkata', gender: me.gender ?? '', age: me.age ?? '', weightKg: me.weightKg ?? '' }));
    if (me.addresses?.length) setAddr((a) => ({ ...a }));
  }, [me]);

  // Selected meals sorted into breakfast->dinner order
  const orderedMeals = useMemo(() => (cat ? cat.meals.map((m: any) => m.type).filter((t: string) => meals.includes(t)) : meals), [cat, meals]);
  // Which address slot a meal uses (the first meal's slot when one address is shared)
  const addrKey = (mt: string) => (sameAddr ? orderedMeals[0] : mt);
  // Current address for a meal
  const getAddr = (mt: string) => addr[addrKey(mt)] ?? emptyAddr;
  // Update one field of an address
  const setAddrField = (mt: string, k: string, v: string) => setAddr((a) => ({ ...a, [addrKey(mt)]: { ...(a[addrKey(mt)] ?? emptyAddr), [k]: v } }));
  // Optional BMI from weight and height (feet + inches converted to metres)
  const bmi = profile.weightKg && profile.ft ? (Number(profile.weightKg) / Math.pow((Number(profile.ft) * 12 + Number(profile.inch || 0)) * 0.0254, 2)).toFixed(1) : null;
  // Pincode per meal (the API uses it to pick delivery zones)
  const pincodes = Object.fromEntries(orderedMeals.map((m: string) => [m, getAddr(m).pincode]));

  // Checks serviceability for an address pincode
  async function checkPin(mt: string) {
    const pin = getAddr(mt).pincode;
    const r = await api(`/catalog/serviceability?pincode=${pin}`);
    setSvc((s) => ({ ...s, [addrKey(mt)]: r.serviceable ? `We deliver to ${r.area} (zone ${r.zone}).` : `Sorry, we do not deliver to ${pin} yet.` }));
  }

  // Asks the API for the live price (also used by the coupon "Apply" button)
  async function loadQuote() {
    try { setQuote(await api('/catalog/quote', { body: { planSlug: plan.slug, days, mealTypes: orderedMeals, pincodes, coupon: coupon || undefined } })); setMsg(null); }
    catch (e: any) { setMsg({ tone: 'bad', text: e.message }); }
  }
  // Recalculate the price when relevant inputs change
  useEffect(() => { if ((step === 2 || step === 5) && plan && orderedMeals.length) loadQuote(); /* eslint-disable-next-line */ }, [step, days, orderedMeals.join(',')]);

  // "Do we deliver to your area?" lookup
  async function checkArea() {
    if (!areaPin.trim()) return setAreaMsg('Enter a pincode');
    try { const r = await api(`/catalog/serviceability?pincode=${areaPin.trim()}`); setAreaMsg(r.serviceable ? `Yes, we deliver to ${r.area}.` : `Sorry, we do not deliver to ${areaPin} yet.`); }
    catch (x: any) { setAreaMsg(x.message); }
  }

  // Step-by-step validation; returns a map of field errors
  function validate(): Errors {
    const e: Errors = {};
    // About you: name, email, age, weight, height
    if (step === 1) {
      const n = nameError(profile.name); if (n) e.name = n;
      const m = emailError(profile.email); if (m) e.email = m;
      const a = numberError(profile.age, 'Age', 10, 100); if (a) e.age = a;
      const w = numberError(profile.weightKg, 'Weight', 20, 300); if (w) e.weightKg = w;
      const f = numberError(profile.ft, 'Height (feet)', 3, 8); if (f) e.ft = f;
      const i = numberError(profile.inch, 'Inches', 0, 11); if (i) e.inch = i;
    }
    // Meals: at least one meal and a start date
    if (step === 2) {
      if (!orderedMeals.length) e.meals = 'Choose at least one meal';
      if (!start) e.start = 'Choose a start date';
    }
    // Allergies: must pick or type an allergen when "I have an allergy" is chosen
    if (step === 3 && allergy.status === 'HAS' && !allergy.allergens.length && !allergy.other.trim()) e.allergy = 'Tap at least one allergen or type it below';
    // Addresses: validate one (shared) or every meal's address
    if (step === 4) {
      for (const mt of sameAddr ? [orderedMeals[0]] : orderedMeals) {
        const ae = addressErrors(getAddr(mt));
        for (const [k, v] of Object.entries(ae)) e[`${addrKey(mt)}.${k}`] = v;
      }
    }
    return e;
  }

  // Go to the next step after validating; steps 1 and 3 save data to the API first
  async function next() {
    setMsg(null);
    const er = validate();
    setErrors(er);
    if (hasErrors(er)) return setMsg({ tone: 'bad', text: 'Please fix the highlighted fields.' });
    try {
      // Save profile (height converted from feet/inches to cm)
      if (step === 1) await api('/me/profile', { method: 'PATCH', body: { name: profile.name, email: profile.email || undefined, city: profile.city, gender: profile.gender || undefined, age: profile.age ? Number(profile.age) : undefined, weightKg: profile.weightKg ? Number(profile.weightKg) : undefined, heightCm: profile.ft ? Math.round((Number(profile.ft) * 12 + Number(profile.inch || 0)) * 2.54) : undefined } });
      // Save the allergy declaration
      if (step === 3) await api('/me/allergies', { method: 'PUT', body: allergy });
      setStep(step + 1);
    } catch (e: any) { setMsg({ tone: 'bad', text: e.message }); }
  }

  // Final step: create the subscription (checkout), then confirm the demo payment
  async function pay() {
    setBusy(true); setMsg(null);
    try {
      // Address per selected meal
      const addresses = Object.fromEntries(orderedMeals.map((m: string) => [m, getAddr(m)]));
      // Creates a pending subscription and payment on the server (price is recalculated there)
      const r = await api('/subscriptions/checkout', { body: { planSlug: plan.slug, days, mealTypes: orderedMeals, diet, startDate: start, perMealAddress: !sameAddr, addresses, coupon: coupon || undefined } });
      try {
        // Demo UPI payment: activates the plan and creates all meals
        await api(`/payments/${r.payment.code}/confirm`, { body: { method: 'UPI' } });
        // Done: go to the dashboard
        router.replace('/customer');
      } catch (e: any) {
        setMsg({ tone: 'warn', text: `Order ${r.subscription.code} created. ${e.message}` });
      }
    } catch (e: any) { setMsg({ tone: 'bad', text: e.message }); }
    finally { setBusy(false); }
  }

  // Wait for the catalog
  if (!cat) return <Loading error={error} loading={loading} />;
  // Update one profile field
  const setP = (k: string, v: any) => setProfile((p: any) => ({ ...p, [k]: v }));
  // Multi-meal saving % for the current selection
  const multi = cat.multiMeal[String(orderedMeals.length)] ?? 0;
  // Duration discount % for the chosen length
  const dur = cat.durations.find((d: any) => d.days === days)?.discount ?? 0;

  return (
    <>
      {/* Page title */}
      <PageHeader title="Tell us your goal" sub="We cook, schedule and deliver the meals." />
      {/* Progress indicator */}
      <div className="steps">{STEPS.map((s, i) => <span key={s} className={i === step ? 'on' : i < step ? 'done' : ''}>{i === 0 ? '' : `${i}. `}{s}</span>)}</div>

      {/* Step 0: choose a goal (clicking a goal moves to step 1) */}
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

      {/* Step 1: about you */}
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

      {/* Step 2: duration, meals, preference, start date and live price */}
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

      {/* Step 3: allergies */}
      {step === 3 && opts && (
        <Card title="Allergies and foods to avoid">
          <p className="muted">Anyone can have an allergy to any food. Tell us now and we pass it to the kitchen with every {plan.name} meal.</p>
          <AllergyForm value={allergy} options={opts.allergens} onChange={(v) => { setAllergy(v); setErrors((e) => ({ ...e, allergy: '' })); }} error={errors.allergy} />
          <p className="muted">You can change this later from Allergies &amp; Diet in your dashboard.</p>
        </Card>
      )}

      {/* Step 4: delivery addresses */}
      {step === 4 && (
        <Card title="Where should we deliver?">
          <p className="muted">Send every meal to one address, or give each its own. For example breakfast at home, lunch at the office, dinner at a parent&apos;s home.</p>
          <Segmented value={sameAddr ? 'one' : 'each'} onChange={(v) => setSameAddr(v === 'one')} options={[{ value: 'one', label: 'Yes, one address' }, { value: 'each', label: 'No, a different address per meal' }]} />
          {(sameAddr ? [orderedMeals[0]] : orderedMeals).map((mt: string) => (
            <div key={mt} style={{ marginTop: 16 }}>
              <h3>{sameAddr ? `All selected meals (${orderedMeals.map((m: string) => MEAL_LABEL[m]).join(', ')})` : MEAL_LABEL[mt]}</h3>
              <AddressPicker
                key={`${mt}-${me?.addresses?.length ?? 0}`}
                value={getAddr(mt)}
                onChange={(v) => setAddr((x) => ({ ...x, [addrKey(mt)]: v }))}
                saved={me?.addresses ?? []}
                onCheck={() => checkPin(mt)}
                status={svc[addrKey(mt)]}
                error={errors[`${addrKey(mt)}.line1`] || errors[`${addrKey(mt)}.city`]}
              />
            </div>
          ))}
          <Notice tone="info">Addresses are fixed once you pay. After payment, rescheduling changes dates only. There is no address editing in the dashboard.</Notice>
        </Card>
      )}

      {/* Step 5: review, coupon and pay */}
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

      {/* Error / info banner */}
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      {/* Previous / Next (or Pay) buttons */}
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
// Live price card: original vs final price, saving and upsell hint
function PricePanel({ quote, orderedMeals, cat, plan, days, compact }: { quote: any; orderedMeals: string[]; cat: any; plan: any; days: number; compact?: boolean }) {
  // Nothing to show until a price exists
  if (!quote) return null;
  // Saving % if the customer added one more meal a day
  const nextMulti = cat.multiMeal[String(orderedMeals.length + 1)] ?? 0;
  // Current multi-meal saving %
  const curMulti = cat.multiMeal[String(orderedMeals.length)] ?? 0;
  return (
    <div className="price-panel">
      {/* Price per day (original struck through when discounted) */}
      <div className="pp-row"><span>Price per day</span><span>{quote.savedPerDay > 0 && <span className="strike">{inr(quote.originalPerDay)}</span>}<strong>{inr(quote.pricePerDay)}</strong></span></div>
      {quote.savedPerDay > 0 && <p className="good-text">Save {inr(quote.savedPerDay)} a day. Flat {quote.discountPct}% applied.</p>}
      <div className="pp-row"><span>Effective price per meal</span><span>{quote.savedPerDay > 0 && <span className="strike">{inr(quote.originalPerMeal)}</span>}<strong>{inr(quote.effectivePerMeal)}</strong></span></div>
      {/* Upsell hint when adding a meal would save more */}
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
