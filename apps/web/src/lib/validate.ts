/** Client-side rules. They mirror apps/api/src/common/validators.ts; the API re-checks everything. */
export const PHONE_RE = /^(\+?91[\s-]?)?[6-9]\d{9}$/;
export const PINCODE_RE = /^[1-9]\d{5}$/;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export type Errors = Record<string, string>;

export const phoneError = (v: string) => (!v.trim() ? 'Enter your mobile number' : PHONE_RE.test(v.trim()) ? '' : 'Enter a valid 10-digit mobile number');
export const emailError = (v: string, required = false) => (!v.trim() ? (required ? 'Enter your email' : '') : EMAIL_RE.test(v.trim()) ? '' : 'Enter a valid email address');
export const nameError = (v: string) => (v.trim().length < 2 ? 'Enter your full name (at least 2 characters)' : v.length > 80 ? 'Name is too long' : '');
export const otpError = (v: string) => (/^\d{6}$/.test(v.trim()) ? '' : 'Enter the 6-digit OTP');
/** Pincode has no rule any more: it is optional free text. */
export const pincodeError = (_v: string) => '';

export function numberError(v: string | number, label: string, min: number, max: number, required = false) {
  if (v === '' || v == null) return required ? `Enter ${label.toLowerCase()}` : '';
  const n = Number(v);
  if (!Number.isFinite(n)) return `${label} must be a number`;
  return n < min || n > max ? `${label} must be between ${min} and ${max}` : '';
}

export function addressErrors(a: { line1?: string; city?: string; pincode?: string }): Errors {
  const e: Errors = {};
  if ((a.line1 ?? '').trim().length < 5) e.line1 = 'Enter the house or flat number and street';
  if ((a.city ?? '').trim().length < 2) e.city = 'Enter the city';
  return e;
}

export const hasErrors = (e: Errors) => Object.values(e).some(Boolean);
