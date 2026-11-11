/** @type {import('next').NextConfig} */
const API_URL = process.env.API_URL || 'http://localhost:4000';

const nextConfig = {
  reactStrictMode: true,
  // The browser only ever talks to the Next.js origin; /backend/* is proxied to the NestJS API.
  // That keeps the auth cookie first-party and avoids CORS in the browser.
  async rewrites() {
    return [{ source: '/backend/:path*', destination: `${API_URL}/api/:path*` }];
  },
};

export default nextConfig;
