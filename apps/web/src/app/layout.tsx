/** Root layout and page metadata. */
// Global styles for the whole site
import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Fraunces, Inter } from 'next/font/google';
import { ReactNode } from 'react';

// Fonts: display (stands in for SweetSans), accent (for Grenette), body/UI (Inter)
const display = Bricolage_Grotesque({ subsets: ['latin'], weight: '400', variable: '--font-display-face', display: 'swap' });
const accent = Fraunces({ subsets: ['latin'], weight: '300', variable: '--font-accent-face', display: 'swap' });
const inter = Inter({ subsets: ['latin'], weight: ['400', '700'], variable: '--font-inter', display: 'swap' });

// Browser tab title and description
export const metadata: Metadata = { title: 'The Healthy Pots', description: 'Prepaid healthy meal subscriptions' };
// Mobile viewport settings (responsive layout)
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };

// Wraps every page in <html><body>
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${accent.variable} ${inter.variable}`}>
      <body>{children}</body>
    </html>
  );
}
