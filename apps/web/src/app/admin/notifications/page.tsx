'use client';
/** Notifications sent to customers, admins and the kitchen. */
import { useApi, fmtTime } from '@/lib/api';
import { Card, Loading, PageHeader, Table } from '@/components/ui';

export default function NotificationsPage() {
  const { data, error, loading } = useApi<any[]>('/admin/notifications');
  return (
    <>
      <PageHeader title="Notifications" sub="Messages sent to customers, admin and kitchen. Customer messages use approved WhatsApp, SMS and email templates once the vendor confirms them." />
      {!data ? <Loading error={error} loading={loading} /> : (
        <Card>
          <Table head={['Time', 'To', 'Channel', 'Template', 'Message']} empty={data.length ? undefined : 'No notifications yet.'}>
            {data.map((n) => (<tr key={n.id}><td>{fmtTime(n.at)}</td><td>{n.audience}</td><td>{n.channels.join(', ')}</td><td>{n.template}</td><td>{n.message}</td></tr>))}
          </Table>
        </Card>
      )}
    </>
  );
}
