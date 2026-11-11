'use client';
/** Public goal browser shown before login. */
import Link from 'next/link';
import { useApi, inr } from '@/lib/api';
import { Loading } from '@/components/ui';

/** Public goal browser (the prototype's "Skip for now and browse goals"). Subscribing needs a login. */
export default function GoalsPage() {
  const { data, error, loading } = useApi<any>('/catalog/plans');
  return (
    <div className="login-wrap" style={{ alignItems: 'start' }}>
      <div className="login-card" style={{ maxWidth: 900 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div className="brand big">The Healthy Pots<small>Meal subscriptions</small></div>
          <Link href="/login" className="btn primary">Log in to subscribe</Link>
        </div>
        <h1>Tell us your goal</h1>
        <p className="muted">We cook, schedule and deliver the meals. Choose a goal, then log in to pick your meals and delivery addresses.</p>
        {!data ? <Loading error={error} loading={loading} /> : (
          ['GOAL', 'HEALTH'].map((g) => (
            <div key={g}>
              <h2 style={{ marginTop: 18 }}>{g === 'GOAL' ? 'What is your goal?' : 'Health-condition goals'}</h2>
              <div className="choice-grid">
                {data.plans.filter((p: any) => p.group === g).map((p: any) => (
                  <Link key={p.slug} href={`/customer/subscribe?plan=${p.slug}`} className="choice">
                    <strong>{p.name}</strong><small>{p.description}</small>
                    <small>From {inr(Math.min(...(Object.values(p.rates) as number[])))} per meal</small>
                  </Link>
                ))}
              </div>
            </div>
          ))
        )}
        <h2 style={{ marginTop: 22 }}>How it works</h2>
        <ol className="muted">
          <li>Choose your goal. It is picked once, here.</li>
          <li>Tell us about you: contact details, age, weight and height.</li>
          <li>Pick days, meals per day, preference and start date. See the price live.</li>
          <li>Add any allergies. Send each meal to the same address or to three different ones.</li>
          <li>Pay once. Pause, resume or move meals until 5:00 PM IST the day before.</li>
        </ol>
      </div>
    </div>
  );
}
