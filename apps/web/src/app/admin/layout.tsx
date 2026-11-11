'use client';
/** Admin portal frame. */
import { ReactNode } from 'react';
import { Shell } from '@/components/Shell';
import { useApi } from '@/lib/api';

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { data: me } = useApi<any>('/auth/me');
  const { data: ov } = useApi<any>('/admin/overview');
  const superAdmin = me?.user?.role === 'SUPER_ADMIN';
  return (
    <Shell
      portal={superAdmin ? 'Admin · Super admin' : 'Admin · Ops admin'}
      nav={[
        { href: '/admin', label: 'Overview' },
        { href: '/admin/customers', label: 'Customers' },
        { href: '/admin/subscriptions', label: 'Subscriptions' },
        { href: '/admin/allergies', label: 'Allergies', badge: ov?.dishConflicts || undefined },
        { href: '/admin/schedule', label: 'Schedule' },
        { href: '/admin/kitchen', label: 'Kitchen' },
        { href: '/admin/delivery', label: 'Delivery', badge: ov?.openExceptions || undefined },
        ...(superAdmin ? [{ href: '/admin/address-correction', label: 'Address correction' }] : []),
        { href: '/admin/audit', label: 'Audit log' },
        { href: '/admin/notifications', label: 'Notifications' },
        { href: '/admin/finance', label: 'Finance' },
        { href: '/admin/integrations', label: 'Integrations and rules' },
        { href: '/admin/settings', label: 'Settings' },
      ]}
    >
      {children}
    </Shell>
  );
}
