'use client';
/** Payments, GST invoices and revenue. */
import { api, useApi, inr } from '@/lib/api';
import { Card, Loading, PageHeader, Stat, Stats, StatusBadge, Table, Button } from '@/components/ui';

export default function FinancePage() {
  const { data: f, error, loading } = useApi<any>('/admin/finance');
  if (!f) return <Loading error={error} loading={loading} />;
  const viewInvoice = async (number: string) => {
    const i = await api(`/invoice?number=${encodeURIComponent(number)}`);
    window.alert(`${i.number}\n${i.customer} · ${i.subscription}\nTaxable ${inr(i.taxable)}\nGST ${inr(i.gst)}\nTotal ${inr(i.total)}`);
  };
  return (
    <>
      <PageHeader title="Finance" sub="Payment records, GST invoices and reports" />
      <Stats>
        <Stat label="Collected" value={inr(f.collected)} hint={`${f.payments} payments`} tone="good" />
        <Stat label="GST in invoices" value={inr(f.gstTotal)} hint={`${f.invoices} invoices`} />
        <Stat label="Failed payments" value={f.failedCount} hint={inr(f.failedAmount)} tone={f.failedCount ? 'warn' : undefined} />
        <Stat label="Average order" value={inr(f.averageOrder)} />
      </Stats>
      <Card title="Revenue by plan">
        <Table head={['Plan', 'Revenue']}>{f.revenueByPlan.map((r: any) => (<tr key={r.plan}><td>{r.plan}</td><td>{inr(r.amount)}</td></tr>))}</Table>
      </Card>
      <Card title="Payments">
        <Table head={['Date', 'Payment', 'Customer', 'Subscription', 'Method', 'Shopify order', 'Amount', 'Status']}>
          {f.paymentRows.map((p: any) => (<tr key={p.code}><td>{p.date}</td><td>{p.code}<small>{p.gatewayRef}</small></td><td>{p.customer}</td><td>{p.subscription ?? '–'}</td><td>{p.method ?? '–'}</td><td>{p.shopifyOrder ?? '–'}</td><td>{inr(p.amount)}</td><td><StatusBadge status={p.status} /></td></tr>))}
        </Table>
      </Card>
      <Card title="GST invoices">
        <Table head={['Invoice', 'Date', 'Subscription', 'Taxable', 'GST', 'Total', '']}>
          {f.invoiceRows.map((i: any) => (<tr key={i.number}><td>{i.number}</td><td>{i.date}</td><td>{i.subscription}</td><td>{inr(i.taxable)}</td><td>{inr(i.gst)}</td><td>{inr(i.total)}</td><td><Button small kind="ghost" onClick={() => viewInvoice(i.number)}>View</Button></td></tr>))}
        </Table>
      </Card>
    </>
  );
}
