/** @type {import('next').NextConfig} */
// Address of the NestJS API (from API_URL in apps/web/.env.local, default localhost:4000)
const API_URL = process.env.API_URL || 'http://localhost:4000';

// Next.js settings
const nextConfig = {
  // Extra development checks (components render twice in dev on purpose)
  reactStrictMode: true,
  // The browser only ever talks to the Next.js origin; /backend/* is proxied to the NestJS API.
  // That keeps the auth cookie first-party and avoids CORS in the browser.
  // Proxy rule: any browser call to /backend/... is forwarded server-side to the API
  async rewrites() {
    // /backend/auth/login -> http://localhost:4000/api/auth/login
    return [{ source: '/backend/:path*', destination: `${API_URL}/api/:path*` }];
  },
};

// Hand the config to Next.js
export default nextConfig;
