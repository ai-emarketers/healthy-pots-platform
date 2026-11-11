'use client';
/** Production sheet view with allergen alerts and CSV export. */
import { useApi, fmtDate, fmtTime, MEAL_LABEL } from '@/lib/api';
import { Button, Card, Loading, Notice, StatusBadge, Table, Badge } from '@/components/ui';

/** Shows whether the sheet is a draft or final. */
export function SheetBanner({ s }: { s: any }) {
  return s.final ? (
    <Notice tone="good">Final production sheet. Locked at {fmtTime(s.lockedAt)}. {s.totals.meals} meals confirmed. Customer changes are now rejected for this date.</Notice>
  ) : (
    <Notice tone="warn">Draft. Customers can still change meals for {fmtDate(s.date)} until {fmtTime(s.lockedAt)}.</Notice>
  );
}

/** Allergen alerts and dish conflicts for the date. */
export function AllergenTable({ rows, notDeclared }: { rows: any[]; notDeclared: string[] }) {
  return (
    <Card title="Allergen alerts for this date">
      <Table head={['Customer', 'Meal', 'Dish', 'Allergy', 'Dish conflict', 'Notes']} empty={rows.length ? undefined : 'No allergy alerts for this date.'}>
        {rows.map((a) => (
          <tr key={a.mealId}>
            <td>{a.customer}<small>{a.code}</small></td>
            <td>{a.meal}</td>
            <td>{a.dish}</td>
            <td><Badge tone={a.severity === 'SEVERE' ? 'bad' : 'warn'}>{a.severity.toLowerCase()}</Badge> {a.allergens.join(', ')}</td>
            <td>{a.conflict ? <Badge tone="bad">Contains {a.conflict.join(', ')}. Admin to confirm swap</Badge> : <Badge tone="good">Clear</Badge>}</td>
            <td>{a.notes ?? '–'}</td>
          </tr>
        ))}
      </Table>
      {notDeclared.length > 0 && <Notice tone="warn">Allergy not declared yet: {notDeclared.join(', ')}. Confirm with the customer before delivery.</Notice>}
    </Card>
  );
}

/** Downloads the production sheet as a CSV file. */
function exportCsv(s: any) {
  const q = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = [['Date', 'Meal type', 'Meal ID', 'Dish', 'Diet', 'Customer']];
  for (const g of s.groups) for (const k of ['veg', 'nonVeg'] as const) for (const m of g[k]) rows.push([s.date, g.label, m.code, m.dish, k === 'veg' ? 'Veg' : 'Non-Veg', m.customer]);
  const blob = new Blob([rows.map((r) => r.map(q).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `production-sheet-${s.date}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

/** Meals grouped by type and Veg / Non-Veg. */
export function ProductionSheet({ date }: { date: string }) {
  const { data: s, error, loading } = useApi<any>(`/kitchen/sheet?date=${date}`);
  if (!s) return <Loading error={error} loading={loading} />;
  return (
    <>
      <SheetBanner s={s} />
      <div style={{ margin: '8px 0' }}><Button small kind="ghost" onClick={() => exportCsv(s)}>Export production sheet (CSV)</Button></div>
      {s.groups.map((g: any) => (
        <Card key={g.mealType} title={`${g.label} · ${g.count} meals`} action={<span className="muted">{g.window}</span>}>
          {g.count === 0 && <p className="muted">Nothing to prepare.</p>}
          {(['veg', 'nonVeg'] as const).map((k) =>
            g[k].length ? (
              <div key={k} style={{ marginBottom: 10 }}>
                <strong>{k === 'veg' ? 'Veg' : 'Non-Veg'} ({g[k].length})</strong>
                <Table head={['Meal ID', 'Dish', 'Customer']}>
                  {g[k].map((m: any) => (<tr key={m.code}><td>{m.code}</td><td>{m.dish}</td><td>{m.customer}</td></tr>))}
                </Table>
              </div>
            ) : null,
          )}
        </Card>
      ))}
      <AllergenTable rows={s.allergenAlerts} notDeclared={s.notDeclared} />
    </>
  );
}
