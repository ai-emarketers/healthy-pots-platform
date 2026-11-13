'use client';
/** Admin portal frame. */
import { ReactNode } from 'react';
import { Shell } from '@/components/Shell';
import { useApi } from '@/lib/api';

// Wraps all /admin/* pages in the sidebar frame
export default function AdminLayout({ children }: { children: ReactNode }) {
  // Current user (to know if super admin)
  const { data: me } = useApi<any>('/auth/me');
  // Overview numbers for sidebar badges
  const { data: ov } = useApi<any>('/admin/overview');
  // Some links and actions are super-admin only
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
        // Address correction link only for the super admin
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
