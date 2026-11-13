'use client';
/** The single login page for customers (OTP) and staff (email and password). */
import Link from 'next/link';
import { FormEvent, Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { emailError, Errors, hasErrors, nameError, otpError, phoneError } from '@/lib/validate';
import { Button, Field, Notice, Segmented } from '@/components/ui';

/** Login form for customers (OTP) and staff. */
// All login logic and UI (customer OTP flow + staff password flow)
function LoginForm() {
  // Used to navigate after login
  const router = useRouter();
  // Optional ?next= page to return to after login
  const next = useSearchParams().get('next');
  // Which login type is shown: customer or staff
  const [who, setWho] = useState<'customer' | 'staff'>('customer');
  // Customer tab: log in or create a profile
  const [tab, setTab] = useState<'login' | 'create'>('login');
  // Customer step: enter phone, then enter OTP
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  // All form field values
  const [f, setF] = useState({ phone: '', otp: '', name: '', email: '', staffEmail: '', password: '' });
  // True if the API says this phone has no account yet
  const [isNew, setIsNew] = useState(false);
  // Field-level validation messages
  const [errors, setErrors] = useState<Errors>({});
  // Server error message
  const [error, setError] = useState('');
  // Disables buttons while a request runs
  const [busy, setBusy] = useState(false);
  // Update a field and clear its error
  const set = (k: string, v: string) => { setF((p) => ({ ...p, [k]: v })); setErrors((e) => ({ ...e, [k]: '' })); };

  // After login: open the page they wanted (if inside their portal) or their home portal
  const go = (r: { redirectTo: string }) => router.replace(next && next.startsWith(r.redirectTo) ? next : r.redirectTo);
  // Wrapper: sets busy, catches errors and shows them
  async function run(fn: () => Promise<void>) {
    setBusy(true); setError('');
    try { await fn(); } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }

  // Step 1: validate phone (and name/email when creating), ask the API to send an OTP
  const requestOtp = (e: FormEvent) => {
    e.preventDefault();
    // Validate before calling the API
    const er: Errors = { phone: phoneError(f.phone) };
    if (tab === 'create') { er.name = nameError(f.name); er.email = emailError(f.email, true); }
    setErrors(er);
    if (hasErrors(er)) return;
    run(async () => {
      const r = await api('/auth/otp/request', { body: { phone: f.phone.trim() } });
      // Unknown number while logging in: switch to "Create profile"
      if (tab === 'login' && r.isNew) { setTab('create'); setError('We could not find that number. Add your name and email to create your profile.'); return; }
      setIsNew(r.isNew);
      // OTP disabled (dev OTP_MODE=off): log in straight away
      if (r.otpRequired === false) {
        // OTP is switched off (development): log in with the mobile number alone
        go(await api('/auth/otp/verify', { body: { phone: f.phone.trim(), ...(r.isNew ? { name: f.name.trim(), email: f.email.trim() || undefined } : {}) } }));
        return;
      }
      // Move to the OTP entry step
      setStep('otp');
    });
  };
  // Step 2: send the OTP to the API and log in
  const verify = (e: FormEvent) => {
    e.preventDefault();
    const er: Errors = { otp: otpError(f.otp) };
    setErrors(er);
    if (hasErrors(er)) return;
    run(async () => go(await api('/auth/otp/verify', { body: { phone: f.phone.trim(), otp: f.otp.trim(), ...(isNew ? { name: f.name.trim(), email: f.email.trim() || undefined } : {}) } })));
  };
  // Staff: email + password login
  const staffLogin = (e: FormEvent) => {
    e.preventDefault();
    const er: Errors = { staffEmail: emailError(f.staffEmail, true), password: f.password.length < 6 ? 'Enter your password' : '' };
    setErrors(er);
    if (hasErrors(er)) return;
    run(async () => go(await api('/auth/login', { body: { email: f.staffEmail.trim(), password: f.password } })));
  };

  return (
    <div className="login-wrap">
      {/* (login card content follows) */}
      <div className="login-card">
        <div className="brand big">The Healthy Pots<small>Meal subscriptions</small></div>
        <h1>Welcome</h1>
        <p className="muted">Log in or create your profile to get started. Then choose your goal.</p>
        {/* Switch between Customer and Staff */}
        <Segmented value={who} onChange={(m) => { setWho(m); setError(''); setErrors({}); }} options={[{ value: 'customer', label: 'Customer' }, { value: 'staff', label: 'Staff' }]} />

        {/* Customer step 1: phone number form */}
        {who === 'customer' && step === 'phone' && (
          <>
            <div style={{ marginTop: 12 }}><Segmented value={tab} onChange={(t) => { setTab(t); setError(''); setErrors({}); }} options={[{ value: 'login', label: 'Log in' }, { value: 'create', label: 'Create profile' }]} /></div>
            <form onSubmit={requestOtp} className="stack" noValidate>
              {tab === 'create' && <Field label="Full name" error={errors.name}><input autoComplete="name" value={f.name} onChange={(e) => set('name', e.target.value)} maxLength={80} /></Field>}
              <Field label="Mobile number" error={errors.phone}><input inputMode="numeric" autoComplete="tel" placeholder="10-digit mobile number" value={f.phone} onChange={(e) => set('phone', e.target.value)} maxLength={16} /></Field>
              {tab === 'create' && <Field label="Email" error={errors.email}><input type="email" autoComplete="email" value={f.email} onChange={(e) => set('email', e.target.value)} maxLength={120} /></Field>}
              <Button type="submit" disabled={busy}>{tab === 'create' ? 'Create profile and continue' : 'Send OTP'}</Button>
            </form>
            <div className="link-row"><Link href="/goals">Skip for now and browse goals</Link></div>
          </>
        )}
        {/* Customer step 2: OTP form */}
        {who === 'customer' && step === 'otp' && (
          <form onSubmit={verify} className="stack" noValidate>
            <p className="muted">We sent a 6-digit OTP to {f.phone}.</p>
            <Field label="One-time password" error={errors.otp}><input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={f.otp} onChange={(e) => set('otp', e.target.value)} /></Field>
            <Button type="submit" disabled={busy}>Verify and continue</Button>
            <Button kind="ghost" onClick={() => { setStep('phone'); set('otp', ''); setError(''); }}>Use a different number</Button>
          </form>
        )}
        {/* Staff email + password form */}
        {who === 'staff' && (
          <form onSubmit={staffLogin} className="stack" noValidate>
            <Field label="Email" error={errors.staffEmail}><input type="email" autoComplete="username" value={f.staffEmail} onChange={(e) => set('staffEmail', e.target.value)} /></Field>
            <Field label="Password" error={errors.password}><input type="password" autoComplete="current-password" value={f.password} onChange={(e) => set('password', e.target.value)} /></Field>
            <Button type="submit" disabled={busy}>Log in</Button>
          </form>
        )}
        {/* Server error banner */}
        {error && <Notice tone="bad">{error}</Notice>}
      </div>
    </div>
  );
}

/** Wraps the form in Suspense because it reads search params. */
// Page component; Suspense is needed because the form reads the URL query (useSearchParams)
export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
