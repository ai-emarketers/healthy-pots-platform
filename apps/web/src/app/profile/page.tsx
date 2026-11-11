'use client';
/** "My profile": every role can see and edit their own details; staff can also change their password. */
import { useEffect, useState } from 'react';
import { Shell } from '@/components/Shell';
import { Button, Card, Field, Loading, Notice, PageHeader } from '@/components/ui';
import { api, useApi } from '@/lib/api';
import { emailError, hasErrors, nameError, numberError, Errors } from '@/lib/validate';

const NAV: Record<string, { portal: string; nav: { href: string; label: string }[] }> = {
  CUSTOMER: { portal: 'Customer', nav: [{ href: '/customer', label: 'My plan' }, { href: '/profile', label: 'My profile' }] },
  OPERATIONS: { portal: 'Operations', nav: [{ href: '/operations', label: 'Operations' }, { href: '/profile', label: 'My profile' }] },
  OPS_ADMIN: { portal: 'Admin', nav: [{ href: '/admin', label: 'Admin' }, { href: '/profile', label: 'My profile' }] },
  SUPER_ADMIN: { portal: 'Admin', nav: [{ href: '/admin', label: 'Admin' }, { href: '/profile', label: 'My profile' }] },
};

export default function ProfilePage() {
  const { data, error, loading, reload } = useApi<any>('/profile');
  const [f, setF] = useState<Record<string, string>>({});
  const [errs, setErrs] = useState<Errors>({});
  const [msg, setMsg] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null);
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const [pwMsg, setPwMsg] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null);

  /** Fill the form once the profile has loaded. */
  useEffect(() => {
    if (!data) return;
    const c = data.customer;
    setF({
      name: data.name ?? '', email: data.email ?? '', city: c?.city ?? '', gender: c?.gender ?? '',
      age: c?.age != null ? String(c.age) : '', weightKg: c?.weightKg != null ? String(c.weightKg) : '', heightCm: c?.heightCm != null ? String(c.heightCm) : '',
    });
  }, [data]);

  const set = (k: string) => (e: any) => setF((p) => ({ ...p, [k]: e.target.value }));
  const shell = NAV[data?.role ?? 'CUSTOMER'];

  async function save() {
    const e: Errors = { name: nameError(f.name ?? ''), email: emailError(f.email ?? '') };
    if (data?.customer) {
      e.age = numberError(f.age, 'Age', 10, 100);
      e.weightKg = numberError(f.weightKg, 'Weight', 20, 300);
      e.heightCm = numberError(f.heightCm, 'Height', 80, 250);
    }
    setErrs(e);
    if (hasErrors(e)) return;
    const body: any = { name: f.name.trim(), email: f.email.trim() || undefined };
    if (data?.customer) {
      body.city = f.city; body.gender = f.gender;
      if (f.age) body.age = Number(f.age);
      if (f.weightKg) body.weightKg = Number(f.weightKg);
      if (f.heightCm) body.heightCm = Number(f.heightCm);
    }
    try {
      await api('/profile', { method: 'PATCH', body });
      setMsg({ tone: 'good', text: 'Profile saved.' });
      reload();
    } catch (x: any) { setMsg({ tone: 'bad', text: x.message }); }
  }

  async function changePassword() {
    try {
      await api('/profile/password', { method: 'POST', body: pw });
      setPw({ currentPassword: '', newPassword: '' });
      setPwMsg({ tone: 'good', text: 'Password changed.' });
    } catch (x: any) { setPwMsg({ tone: 'bad', text: x.message }); }
  }

  return (
    <Shell portal={shell.portal} nav={shell.nav}>
      <PageHeader title="My profile" sub="Your details, visible only to you and the Healthy Pots team." />
      <Loading error={error} loading={loading} />
      {data && (
        <>
          <Card title="Account">
            <div className="grid2">
              <Field label="Role"><input value={data.role.replace('_', ' ').toLowerCase()} disabled /></Field>
              {data.customer && <Field label="Customer ID"><input value={data.customer.code} disabled /></Field>}
              {data.phone && <Field label="Mobile" hint="Your login number cannot be changed here."><input value={data.phone} disabled /></Field>}
              <Field label="Member since"><input value={new Date(data.memberSince).toLocaleDateString('en-IN')} disabled /></Field>
            </div>
          </Card>
          <Card title="Personal details">
            <div className="grid2">
              <Field label="Full name" error={errs.name}><input value={f.name ?? ''} onChange={set('name')} /></Field>
              <Field label="Email" error={errs.email}><input value={f.email ?? ''} onChange={set('email')} type="email" /></Field>
              {data.customer && (
                <>
                  <Field label="City"><input value={f.city ?? ''} onChange={set('city')} /></Field>
                  <Field label="Gender">
                    <select value={f.gender ?? ''} onChange={set('gender')}>
                      <option value="">Prefer not to say</option><option>Female</option><option>Male</option><option>Other</option>
                    </select>
                  </Field>
                  <Field label="Age" error={errs.age}><input value={f.age ?? ''} onChange={set('age')} inputMode="numeric" /></Field>
                  <Field label="Weight (kg)" error={errs.weightKg}><input value={f.weightKg ?? ''} onChange={set('weightKg')} inputMode="decimal" /></Field>
                  <Field label="Height (cm)" error={errs.heightCm}><input value={f.heightCm ?? ''} onChange={set('heightCm')} inputMode="decimal" /></Field>
                </>
              )}
            </div>
            {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
            <Button onClick={save}>Save changes</Button>
          </Card>
          {data.role !== 'CUSTOMER' && (
            <Card title="Change password">
              <div className="grid2">
                <Field label="Current password"><input type="password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} /></Field>
                <Field label="New password" hint="10+ characters with upper case, lower case and a digit."><input type="password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} /></Field>
              </div>
              {pwMsg && <Notice tone={pwMsg.tone}>{pwMsg.text}</Notice>}
              <Button onClick={changePassword} disabled={!pw.currentPassword || !pw.newPassword}>Change password</Button>
            </Card>
          )}
        </>
      )}
    </Shell>
  );
}
