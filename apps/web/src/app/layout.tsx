/** Root layout and page metadata. */
// Global styles for the whole site
import './globals.css';
import type { Metadata, Viewport } from 'next';
import { ReactNode } from 'react';

// Browser tab title and description
export const metadata: Metadata = { title: 'The Healthy Pots', description: 'Prepaid healthy meal subscriptions' };
// Mobile viewport settings (responsive layout)
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };

// Wraps every page in <html><body>
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
