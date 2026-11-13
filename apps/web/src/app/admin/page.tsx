'use client';
/** Admin overview: key numbers, alerts and recent audit entries. */
import { useApi, fmtDate, fmtTime, inr } from '@/lib/api';
import { Card, Loading, Notice, PageHeader, Stat, Stats, Table } from '@/components/ui';

// Admin home dashboard
export default function AdminOverview() {
  // Load numbers from /admin/overview
  const { data: o, error, loading } = useApi<any>('/admin/overview');
  // Wait for data
  if (!o) return <Loading error={error} loading={loading} />;
  return (
    <>
      {/* Title with today's date in IST */}
      <PageHeader title="Overview" sub={fmtDate(new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10))} />
      {/* KPI tiles: allergies, conflicts, subscriptions, customers, meals, exceptions, payments */}
      <Stats>
        <Stat label="Customers with allergies" value={o.customersWithAllergies} hint={`${o.allergyNotDeclared} not declared`} tone="warn" />
        <Stat label="Dish conflicts" value={o.dishConflicts} hint="Upcoming, no swap agreed" tone={o.dishConflicts ? 'bad' : undefined} />
        <Stat label="Active subscriptions" value={o.activeSubscriptions} hint={`${o.totalSubscriptions} total`} />
        <Stat label="Customers" value={o.customers} />
        <Stat label="Meals today" value={o.mealsToday} hint={`${o.deliveredToday} delivered`} />
        <Stat label="Open exceptions" value={o.openExceptions} hint="Needs a decision" tone={o.openExceptions ? 'bad' : undefined} />
        <Stat label="Failed payments" value={o.failedPayments} hint={inr(o.failedAmount)} tone={o.failedPayments ? 'warn' : undefined} />
        <Stat label="Collected" value={inr(o.collected)} hint="All time" tone="good" />
      </Stats>
      {/* When the next sheet locks */}
      <Notice tone="info">Next production sheet: {fmtDate(o.nextSheet.date)}. Locks at {fmtTime(o.nextSheet.lockAt)}. {o.nextSheet.meals} meals so far · {o.nextSheet.paused} paused excluded.</Notice>
      {/* Open delivery exceptions */}
      <Card title="Open alerts">
        {o.alerts.length ? o.alerts.map((a: any) => <p key={a.id}>{a.text} <span className="muted">{fmtTime(a.at)}</span></p>) : <p className="muted">Nothing needs attention.</p>}
      </Card>
      {/* Latest 5 audit log rows */}
      <Card title="Recent audit entries">
        <Table head={['Time', 'Who', 'Action', 'Target', 'Reason']}>
          {o.recentAudit.map((a: any) => (<tr key={a.id}><td>{fmtTime(a.at)}</td><td>{a.actorLabel}</td><td>{a.action}</td><td>{a.target}</td><td>{a.reason ?? '–'}</td></tr>))}
        </Table>
      </Card>
    </>
  );
}
