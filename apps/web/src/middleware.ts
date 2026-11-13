/** Route protection: checks the login cookie and sends each role to its own portal. */
import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { canAccess, COOKIE_NAME, homeFor, Role } from '@/lib/roles';

// Reads the role from the login cookie
async function roleFrom(req: NextRequest): Promise<Role | null> {
  // JWT stored in the cookie
  const token = req.cookies.get(COOKIE_NAME)?.value;
  // No cookie or no secret = not logged in
  if (!token || !process.env.JWT_SECRET) return null;
  try {
    // Verifies the signature with the same JWT_SECRET as the API (works in the Edge runtime via jose)
    const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET));
    return (payload.role as Role) ?? null;
  // Invalid or expired token = not logged in
  } catch {
    return null;
  }
}

/** Single login page: everything except /login needs a valid cookie, and each portal is role-gated. */
// Runs before every page request
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  // null when not logged in
  const role = await roleFrom(req);

  // The goals page is public
  if (pathname === '/goals') return NextResponse.next(); // public: browse goals before logging in

  // Logged-in users skip the login page
  if (pathname === '/login') {
    return role ? NextResponse.redirect(new URL(homeFor(role), req.url)) : NextResponse.next();
  }
  // Not logged in: send to /login and remember the page they wanted (?next=)
  if (!role) {
    const url = new URL('/login', req.url);
    if (pathname !== '/') url.searchParams.set('next', pathname);
    const res = NextResponse.redirect(url);
    // Remove a stale/invalid cookie
    if (req.cookies.get(COOKIE_NAME)) res.cookies.delete(COOKIE_NAME); // stale or invalid token
    return res;
  }
  // Root URL: go to the user's own portal
  if (pathname === '/') return NextResponse.redirect(new URL(homeFor(role), req.url));
  // Wrong portal for this role: send them home
  if (!canAccess(role, pathname)) return NextResponse.redirect(new URL(homeFor(role), req.url));
  // Allowed
  return NextResponse.next();
}

// Run on every route except Next internals, the /backend proxy and the favicon
export const config = { matcher: ['/((?!_next/|backend/|favicon.ico).*)'] };
