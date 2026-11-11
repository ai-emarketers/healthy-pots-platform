'use client';
/** Kitchen alerts for pauses, resumes and schedule changes. */
import { useApi, fmtTime } from '@/lib/api';
import { Card, Loading, PageHeader, Table } from '@/components/ui';

export default function AlertsPage() {
  const { data, error, loading } = useApi<any[]>('/kitchen/alerts');
  return (
    <>
      <PageHeader title="Kitchen alerts" sub="Every customer or admin change that touches the kitchen schedule" />
      {!data ? <Loading error={error} loading={loading} /> : (
        <Card>
          <Table head={['Time', 'Alert', 'Subscription']} empty={data.length ? undefined : 'No alerts yet. Pauses, resumes, reschedules and allergy changes appear here.'}>
            {data.map((a) => (<tr key={a.id}><td>{fmtTime(a.at)}</td><td>{a.message}</td><td>{a.subscriptionCode}</td></tr>))}
          </Table>
        </Card>
      )}
    </>
  );
}
