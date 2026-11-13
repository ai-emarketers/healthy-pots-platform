/** Client-side rules. They mirror apps/api/src/common/validators.ts; the API re-checks everything. */
// Indian mobile number (same rule as the API)
export const PHONE_RE = /^(\+?91[\s-]?)?[6-9]\d{9}$/;
// 6-digit pincode (kept for reference)
export const PINCODE_RE = /^[1-9]\d{5}$/;
// Basic email format
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Map of field name -> error message
export type Errors = Record<string, string>;

// Returns an error message, or '' when the phone is fine
export const phoneError = (v: string) => (!v.trim() ? 'Enter your mobile number' : PHONE_RE.test(v.trim()) ? '' : 'Enter a valid 10-digit mobile number');
// Email check; empty is fine unless required
export const emailError = (v: string, required = false) => (!v.trim() ? (required ? 'Enter your email' : '') : EMAIL_RE.test(v.trim()) ? '' : 'Enter a valid email address');
// Name must be 2 to 80 characters
export const nameError = (v: string) => (v.trim().length < 2 ? 'Enter your full name (at least 2 characters)' : v.length > 80 ? 'Name is too long' : '');
// OTP must be exactly 6 digits
export const otpError = (v: string) => (/^\d{6}$/.test(v.trim()) ? '' : 'Enter the 6-digit OTP');
/** Pincode has no rule any more: it is optional free text. */
// No rule: pincode is optional free text
export const pincodeError = (_v: string) => '';

// Checks a number is inside min..max (and present if required)
export function numberError(v: string | number, label: string, min: number, max: number, required = false) {
  if (v === '' || v == null) return required ? `Enter ${label.toLowerCase()}` : '';
  const n = Number(v);
  if (!Number.isFinite(n)) return `${label} must be a number`;
  return n < min || n > max ? `${label} must be between ${min} and ${max}` : '';
}

// Checks the required address fields
export function addressErrors(a: { line1?: string; city?: string; pincode?: string }): Errors {
  const e: Errors = {};
  if ((a.line1 ?? '').trim().length < 5) e.line1 = 'Enter the house or flat number and street';
  if ((a.city ?? '').trim().length < 2) e.city = 'Enter the city';
  return e;
}

// True if any message in the map is non-empty
export const hasErrors = (e: Errors) => Object.values(e).some(Boolean);
