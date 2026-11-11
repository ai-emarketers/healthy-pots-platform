'use client';
/** Operations portal frame. */
import { ReactNode } from 'react';
import { Shell } from '@/components/Shell';
import { useApi } from '@/lib/api';

export default function OperationsLayout({ children }: { children: ReactNode }) {
  const { data } = useApi<any[]>('/delivery/exceptions?status=OPEN');
  return (
    <Shell
      portal="Kitchen & Delivery"
      nav={[
        { href: '/operations', label: 'Overview' },
        { href: '/operations/production', label: 'Production sheet' },
        { href: '/operations/board', label: 'Kitchen board' },
        { href: '/operations/delivery', label: 'Delivery jobs' },
        { href: '/operations/exceptions', label: 'Exceptions', badge: data?.length || undefined },
        { href: '/operations/alerts', label: 'Kitchen alerts' },
      ]}
    >
      {children}
    </Shell>
  );
}
