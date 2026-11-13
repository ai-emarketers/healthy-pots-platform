/** Which portal each role belongs to and what it may open. */
// Same roles as the API
export type Role = 'CUSTOMER' | 'OPERATIONS' | 'OPS_ADMIN' | 'SUPER_ADMIN';

// Login cookie name (must match the API)
export const COOKIE_NAME = 'hp_token';

/** The one place that decides which portal each role lands in. Keep in sync with API `homeFor`. */
// Landing portal per role
export function homeFor(role: Role): string {
  if (role === 'CUSTOMER') return '/customer';
  if (role === 'OPERATIONS') return '/operations';
  return '/admin';
}

/** Which roles may open which portal. */
// Portal access rules used by the middleware
export function canAccess(role: Role, pathname: string): boolean {
  // Customer portal: customers only
  if (pathname.startsWith('/customer')) return role === 'CUSTOMER';
  // Operations portal: kitchen staff and both admin roles
  if (pathname.startsWith('/operations')) return role === 'OPERATIONS' || role === 'OPS_ADMIN' || role === 'SUPER_ADMIN';
  // Admin portal: admin roles only
  if (pathname.startsWith('/admin')) return role === 'OPS_ADMIN' || role === 'SUPER_ADMIN';
  // Other pages (login, profile, goals) are open to everyone who passes the login check
  return true;
}
