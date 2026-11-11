/** Root layout and page metadata. */
import './globals.css';
import type { Metadata, Viewport } from 'next';
import { ReactNode } from 'react';

export const metadata: Metadata = { title: 'The Healthy Pots', description: 'Prepaid healthy meal subscriptions' };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
