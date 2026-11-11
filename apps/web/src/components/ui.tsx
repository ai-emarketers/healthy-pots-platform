'use client';
/** Small shared UI pieces: cards, fields, buttons, notices, tables, badges. */
import { ReactNode } from 'react';

export const Card = ({ children, title, action }: { children: ReactNode; title?: string; action?: ReactNode }) => (
  <section className="card">
    {(title || action) && (
      <div className="card-head">
        <h3>{title}</h3>
        {action}
      </div>
    )}
    {children}
  </section>
);

export const Stat = ({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: string; tone?: 'warn' | 'bad' | 'good' }) => (
  <div className={`stat ${tone ?? ''}`}>
    <div className="stat-label">{label}</div>
    <div className="stat-value">{value}</div>
    {hint && <div className="stat-hint">{hint}</div>}
  </div>
);

export const Stats = ({ children }: { children: ReactNode }) => <div className="stats">{children}</div>;

export const Badge = ({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'info' }) => (
  <span className={`badge ${tone}`}>{children}</span>
);

const STATUS_TONE: Record<string, 'neutral' | 'good' | 'warn' | 'bad' | 'info'> = {
  ACTIVE: 'good', COMPLETED: 'neutral', DELIVERED: 'good', SUCCESS: 'good', RESOLVED: 'good', SCHEDULED: 'info', PAUSED: 'warn',
  PREPARING: 'info', READY: 'info', OUT_FOR_DELIVERY: 'info', ASSIGNED: 'neutral', PICKED_UP: 'info', EXCEPTION: 'bad', FAILED: 'bad',
  OPEN: 'bad', PENDING: 'warn', PENDING_PAYMENT: 'warn', SEVERE: 'bad', MODERATE: 'warn', MILD: 'info', NOT_DECLARED: 'warn', NONE: 'neutral',
};
export const StatusBadge = ({ status, label }: { status: string; label?: string }) => (
  <Badge tone={STATUS_TONE[status] ?? 'neutral'}>{label ?? status.replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase())}</Badge>
);

export const PageHeader = ({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) => (
  <header className="page-head">
    <div>
      <h1>{title}</h1>
      {sub && <p className="muted">{sub}</p>}
    </div>
    {action}
  </header>
);

export const Table = ({ head, children, empty }: { head: string[]; children: ReactNode; empty?: string }) => (
  <div className="table-wrap">
    <table>
      <thead>
        <tr>{head.map((h) => <th key={h}>{h}</th>)}</tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
    {empty && <p className="muted pad">{empty}</p>}
  </div>
);

export const Button = ({ children, onClick, kind = 'primary', disabled, type = 'button', small }: {
  children: ReactNode; onClick?: () => void; kind?: 'primary' | 'ghost' | 'danger'; disabled?: boolean; type?: 'button' | 'submit'; small?: boolean;
}) => (
  <button type={type} className={`btn ${kind} ${small ? 'small' : ''}`} onClick={onClick} disabled={disabled}>
    {children}
  </button>
);

export const Field = ({ label, children, hint, error }: { label: string; children: ReactNode; hint?: string; error?: string }) => (
  <label className={`field ${error ? 'has-error' : ''}`}>
    <span>{label}</span>
    {children}
    {error ? <small className="error-text" role="alert">{error}</small> : hint && <small className="muted">{hint}</small>}
  </label>
);

export const Notice = ({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warn' | 'bad' | 'good' }) => (
  <div className={`notice ${tone}`}>{children}</div>
);

export const Loading = ({ error, loading }: { error?: string; loading?: boolean }) =>
  error ? <Notice tone="bad">{error}</Notice> : loading ? <p className="muted pad">Loading…</p> : null;

export const Segmented = <T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) => (
  <div className="segmented">
    {options.map((o) => (
      <button key={o.value} type="button" className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>
        {o.label}
      </button>
    ))}
  </div>
);
