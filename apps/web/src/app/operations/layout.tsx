'use client';
/** Operations portal frame. */
import { ReactNode } from 'react';
import { Shell } from '@/components/Shell';
import { useApi } from '@/lib/api';

// Wraps all /operations/* pages in the sidebar frame
export default function OperationsLayout({ children }: { children: ReactNode }) {
  // Open delivery exceptions: used for the red badge on the "Exceptions" link
  const { data } = useApi<any[]>('/delivery/exceptions?status=OPEN');
  return (
    <Shell
      portal="Kitchen & Delivery"
      nav={[
        { href: '/operations', label: 'Overview' },
        { href: '/operations/production', label: 'Production sheet' },
        { href: '/operations/board', label: 'Kitchen board' },
        { href: '/operations/delivery', label: 'Delivery jobs' },
        // Badge shows how many exceptions are open
        { href: '/operations/exceptions', label: 'Exceptions', badge: data?.length || undefined },
        { href: '/operations/alerts', label: 'Kitchen alerts' },
      ]}
    >
      {children}
    </Shell>
  );
}
