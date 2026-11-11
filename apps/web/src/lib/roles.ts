/** Which portal each role belongs to and what it may open. */
export type Role = 'CUSTOMER' | 'OPERATIONS' | 'OPS_ADMIN' | 'SUPER_ADMIN';

export const COOKIE_NAME = 'hp_token';

/** The one place that decides which portal each role lands in. Keep in sync with API `homeFor`. */
export function homeFor(role: Role): string {
  if (role === 'CUSTOMER') return '/customer';
  if (role === 'OPERATIONS') return '/operations';
  return '/admin';
}

/** Which roles may open which portal. */
export function canAccess(role: Role, pathname: string): boolean {
  if (pathname.startsWith('/customer')) return role === 'CUSTOMER';
  if (pathname.startsWith('/operations')) return role === 'OPERATIONS' || role === 'OPS_ADMIN' || role === 'SUPER_ADMIN';
  if (pathname.startsWith('/admin')) return role === 'OPS_ADMIN' || role === 'SUPER_ADMIN';
  return true;
}
