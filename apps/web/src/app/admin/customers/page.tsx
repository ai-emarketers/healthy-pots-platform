'use client';
/** Customer list. */
import { useApi, SEVERITY_LABEL } from '@/lib/api';
import { Card, Loading, PageHeader, StatusBadge, Table } from '@/components/ui';

// Customer list for admins
export default function CustomersPage() {
  // Load customers
  const { data, error, loading } = useApi<any[]>('/admin/customers');
  return (
    <>
      <PageHeader title="Customers" sub="Profiles and contact details" />
      {/* Loading state or the table (allergy badge shows severity + allergens) */}
      {!data ? <Loading error={error} loading={loading} /> : (
        <Card>
          <Table head={['ID', 'Name', 'Mobile', 'Email', 'Subscriptions', 'Allergies (default)']}>
            {data.map((c) => (
              <tr key={c.id}>
                <td>{c.code}</td><td>{c.name}</td><td>{c.phone}</td><td>{c.email ?? '–'}</td><td>{c.subscriptions.join(', ') || '–'}</td>
                <td><StatusBadge status={c.allergy} label={c.allergens.length ? `${SEVERITY_LABEL[c.allergy]}: ${c.allergens.join(', ')}` : SEVERITY_LABEL[c.allergy]} /></td>
              </tr>
            ))}
          </Table>
        </Card>
      )}
    </>
  );
}
