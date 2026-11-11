/** Route protection: checks the login cookie and sends each role to its own portal. */
import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { canAccess, COOKIE_NAME, homeFor, Role } from '@/lib/roles';

async function roleFrom(req: NextRequest): Promise<Role | null> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token || !process.env.JWT_SECRET) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET));
    return (payload.role as Role) ?? null;
  } catch {
    return null;
  }
}

/** Single login page: everything except /login needs a valid cookie, and each portal is role-gated. */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const role = await roleFrom(req);

  if (pathname === '/goals') return NextResponse.next(); // public: browse goals before logging in

  if (pathname === '/login') {
    return role ? NextResponse.redirect(new URL(homeFor(role), req.url)) : NextResponse.next();
  }
  if (!role) {
    const url = new URL('/login', req.url);
    if (pathname !== '/') url.searchParams.set('next', pathname);
    const res = NextResponse.redirect(url);
    if (req.cookies.get(COOKIE_NAME)) res.cookies.delete(COOKIE_NAME); // stale or invalid token
    return res;
  }
  if (pathname === '/') return NextResponse.redirect(new URL(homeFor(role), req.url));
  if (!canAccess(role, pathname)) return NextResponse.redirect(new URL(homeFor(role), req.url));
  return NextResponse.next();
}

export const config = { matcher: ['/((?!_next/|backend/|favicon.ico).*)'] };
