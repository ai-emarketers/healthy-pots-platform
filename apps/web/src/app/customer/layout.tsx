'use client';
/** Customer portal frame. */
import { ReactNode } from 'react';
import { Shell } from '@/components/Shell';

// Wraps all /customer/* pages in the sidebar frame
export default function CustomerLayout({ children }: { children: ReactNode }) {
  return (
    <Shell portal="Customer portal" nav={[{ href: '/customer', label: 'My dashboard' }, { href: '/customer/subscribe', label: 'New subscription' }]}>
      {children}
    </Shell>
  );
}
