'use client';
/** Kitchen status board: start, ready and bulk actions. */
import { useState } from 'react';
import { api, useApi, MEAL_LABEL } from '@/lib/api';
import { Badge, Button, Card, Loading, Notice, StatusBadge } from '@/components/ui';

export function KitchenBoard({ date }: { date: string }) {
  const [meal, setMeal] = useState('');
  const { data, error, loading, reload } = useApi<any>(`/kitchen/board?date=${date}${meal ? `&mealType=${meal}` : ''}`);
  const [err, setErr] = useState('');
  const act = async (fn: () => Promise<any>) => { setErr(''); try { await fn(); await reload(); } catch (e: any) { setErr(e.message); } };
  if (!data) return <Loading error={error} loading={loading} />;
  const counts = data.meals.reduce((a: any, m: any) => ({ ...a, [m.status]: (a[m.status] ?? 0) + 1 }), {});

  return (
    <>
      <div className="tabs">
        {[['', 'All meals'], ['BREAKFAST', 'Breakfast'], ['LUNCH', 'Lunch'], ['SNACK', 'Snack'], ['DINNER', 'Dinner']].map(([v, l]) => (
          <button key={v} className={meal === v ? 'on' : ''} onClick={() => setMeal(v)}>{l}</button>
        ))}
      </div>
      <div className="row" style={{ marginBottom: 12 }}>
        {['BREAKFAST', 'LUNCH', 'SNACK', 'DINNER'].map((mt) => (
          <span key={mt} className="row">
            <Button small kind="ghost" onClick={() => act(() => api('/kitchen/bulk', { body: { date: date || 'today', mealType: mt, status: 'PREPARING' } }))}>Start all {MEAL_LABEL[mt].toLowerCase()}</Button>
            <Button small kind="ghost" onClick={() => act(() => api('/kitchen/bulk', { body: { date: date || 'today', mealType: mt, status: 'READY' } }))}>Mark all {MEAL_LABEL[mt].toLowerCase()} ready</Button>
          </span>
        ))}
      </div>
      {err && <Notice tone="bad">{err}</Notice>}
      <div className="row" style={{ marginBottom: 10 }}>
        {Object.entries(counts).map(([k, v]) => (<span key={k} className="muted">{k.replace(/_/g, ' ').toLowerCase()} {String(v)}</span>))}
      </div>
      <div className="choice-grid">
        {data.meals.map((m: any) => (
          <Card key={m.id}>
            <div className="row" style={{ justifyContent: 'space-between' }}><Badge tone="info">{MEAL_LABEL[m.mealType]}</Badge><StatusBadge status={m.status} /></div>
            <strong style={{ display: 'block', marginTop: 8 }}>{m.dish}</strong>
            <small className="muted">{m.customer} · {m.code}</small>
            {m.allergy && <div style={{ marginTop: 6 }}><Badge tone={m.allergy.startsWith('Allergy not') ? 'warn' : 'bad'}>{m.allergy}</Badge></div>}
            {m.contains?.length > 0 && <Notice tone="bad">CONTAINS {m.contains.join(', ')}</Notice>}
            <div className="row" style={{ marginTop: 8 }}>
              {m.status === 'SCHEDULED' && <Button small onClick={() => act(() => api(`/kitchen/meals/${m.id}/status`, { body: { status: 'PREPARING' } }))}>Start preparing</Button>}
              {(m.status === 'SCHEDULED' || m.status === 'PREPARING') && <Button small kind="ghost" onClick={() => act(() => api(`/kitchen/meals/${m.id}/status`, { body: { status: 'READY' } }))}>Mark ready</Button>}
            </div>
          </Card>
        ))}
      </div>
      {data.meals.length === 0 && <p className="muted">No meals for this date.</p>}
    </>
  );
}
