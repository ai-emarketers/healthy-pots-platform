'use client';
/** App frame with the sidebar, header and logout for each portal. */
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';
import { api } from '@/lib/api';

// One sidebar link (badge is optional)
export interface NavItem { href: string; label: string; badge?: string | number }

/** Shared chrome for the three portals: sidebar, signed-in user, logout. */
// Layout shared by all portals
export function Shell({ portal, nav, children, roleSwitchLabel }: { portal: string; nav: NavItem[]; children: ReactNode; roleSwitchLabel?: boolean }) {
  // Current URL path (to highlight the active link)
  const path = usePathname();
  // Used to navigate after logout
  const router = useRouter();
  // Logged-in user shown in the sidebar
  const [me, setMe] = useState<{ name: string; role: string } | null>(null);

  // Load the current user once when the page opens
  useEffect(() => {
    api('/auth/me').then((r) => setMe(r.user)).catch(() => {});
  }, []);

  // Clear the cookie on the API, then go to the login page
  async function logout() {
    await api('/auth/logout', { method: 'POST', body: {} });
    router.replace('/login');
  }

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">The Healthy Pots<small>{portal}</small></div>
        <nav>
          {nav.map((n) => {
            // Exact match, or a sub-page of a section link
            const active = n.href === path || (n.href.split('/').length > 2 && path.startsWith(n.href));
            return (
              <Link key={n.href} href={n.href} className={active ? 'active' : ''}>
                {n.label}
                {n.badge ? <span className="pill">{n.badge}</span> : null}
              </Link>
            );
          })}
        </nav>
        {/* User name (links to profile) and logout button */}
        <div className="side-foot">
          {me && (
            <Link href="/profile" className="who" title="My profile">
              <strong>{me.name}</strong>
              <small>{me.role.replace('_', ' ').toLowerCase()} · My profile</small>
            </Link>
          )}
          <button className="btn ghost small" onClick={logout}>Log out</button>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
