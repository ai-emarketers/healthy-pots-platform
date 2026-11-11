'use client';
/** System responsibilities, webhook endpoints and vendor confirmations. */
import { useState } from 'react';
import { api, useApi } from '@/lib/api';
import { Badge, Button, Card, Loading, Notice, PageHeader, Table } from '@/components/ui';

/** Integration overview with vendor confirmations. */
export default function IntegrationsPage() {
  const { data, error, loading, reload } = useApi<any>('/admin/integrations');
  const [err, setErr] = useState('');
  const toggle = async (vendor: string, confirmed: boolean) => { setErr(''); try { await api(`/admin/integrations/confirmations/${encodeURIComponent(vendor)}`, { body: { confirmed } }); await reload(); } catch (e: any) { setErr(e.message); } };
  if (!data) return <Loading error={error} loading={loading} />;
  return (
    <>
      <PageHeader title="Integrations and rules" sub="How the systems fit together, and what vendors must confirm" />
      <Notice tone="warn">Do not assume Petpooja or delivery-partner capabilities until each vendor confirms the required endpoints and webhook events. Build the backend and the individual meal entitlement engine first, then connect Shopify checkout, dashboards, kitchen workflow and delivery tracking.</Notice>
      <Card title="System responsibilities">
        {data.flow.map(([name, text]: string[], i: number) => (<p key={name}>{i > 0 && '↓ '}<strong>{name}</strong><br /><span className="muted">{text}</span></p>))}
      </Card>
      <Card title="Webhook endpoints">
        {Object.entries(data.endpoints).map(([k, v]) => (<p key={k}><strong>{k}</strong><br /><code>{String(v)}</code></p>))}
      </Card>
      <Card title={`Vendor confirmations before development (${data.vendorConfirmations.filter((v: any) => v.confirmed).length} of ${data.vendorConfirmations.length} confirmed)`}>
        {err && <Notice tone="bad">{err}</Notice>}
        <Table head={['Vendor', 'What must be confirmed', 'Status', '']}>
          {data.vendorConfirmations.map((v: any) => (<tr key={v.vendor}><td>{v.vendor}</td><td>{v.item}</td><td><Badge tone={v.confirmed ? 'good' : 'warn'}>{v.status}</Badge></td><td><Button small kind="ghost" onClick={() => toggle(v.vendor, !v.confirmed)}>{v.confirmed ? 'Reopen' : 'Mark confirmed'}</Button></td></tr>))}
        </Table>
      </Card>
    </>
  );
}
