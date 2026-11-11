'use client';
/**
 * Delivery address picker in the style of food-delivery apps: saved-address cards, a
 * "Delivering to" summary, and an "Add new address" bottom sheet with Home / Work / Other tags.
 * The value keeps the API shape { line1, landmark, city, pincode } so nothing else changes.
 */
import { useState } from 'react';
import { api } from '@/lib/api';
import { mapUrl } from '@/lib/maps';
import { Errors, hasErrors } from '@/lib/validate';

export interface Addr { line1: string; landmark: string; city: string; pincode: string; mapLink?: string }
interface Saved extends Addr { id: string; label: string }

const CITIES = ['Kolkata', 'Delhi NCR', 'Bangalore', 'Mumbai', 'Pune', 'Hyderabad'];
const TAGS = ['Home', 'Work', 'Other'] as const;
const ICON: Record<string, string> = { Home: '🏠', Work: '🏢', Other: '📍' };
const iconFor = (label: string) => ICON[label] ?? ICON.Other;

const blank = { flat: '', floor: '', building: '', street: '', landmark: '', city: 'Kolkata', pincode: '', mapLink: '', tag: 'Home' as string, other: '', save: true };

export function AddressPicker({ value, onChange, saved, onCheck, status, error }: {
  value: Addr; onChange: (a: Addr) => void; saved: Saved[]; onCheck?: () => void; status?: string; error?: string;
}) {
  const [list, setList] = useState<Saved[]>(saved);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ ...blank });
  const [errs, setErrs] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState('');

  const chosen = value.line1.trim().length > 0;
  const same = (a: Addr) => a.line1 === value.line1 && a.city === value.city && (a.pincode ?? '') === (value.pincode ?? '');
  const set = (k: string, v: any) => setF((p) => ({ ...p, [k]: v }));
  const text = (a: Addr) => [a.line1, a.landmark, `${a.city}${a.pincode ? ' ' + a.pincode : ''}`].filter(Boolean).join(', ');

  /** Validates the sheet, optionally saves for next time, then selects the address. */
  async function submit() {
    const e: Errors = {
      flat: f.flat.trim() ? '' : 'Enter the flat / house number',
      street: f.street.trim().length >= 3 ? '' : 'Enter the street or area',
      city: f.city.trim() ? '' : 'Choose a city',
      other: f.tag === 'Other' && f.other.trim().length < 2 ? 'Name this address (e.g. Parents)' : '',
    };
    if (f.mapLink.trim() && !/^https?:\/\/\S{3,}$/i.test(f.mapLink.trim())) e.mapLink = 'Paste a web link that starts with http:// or https://';
    setErrs(e);
    if (hasErrors(e)) return;
    const line1 = [f.flat.trim(), f.floor.trim() && `Floor ${f.floor.trim()}`, f.building.trim(), f.street.trim()].filter(Boolean).join(', ');
    const a: Addr = { line1, landmark: f.landmark.trim(), city: f.city, pincode: f.pincode.trim(), mapLink: f.mapLink.trim() };
    const label = f.tag === 'Other' ? f.other.trim() : f.tag;
    setBusy(true); setFail('');
    try {
      if (f.save) {
        const s = await api('/me/addresses', { body: { label, ...a, mapLink: a.mapLink || undefined } });
        setList((l) => [...l, { ...a, id: s.id, label }]);
      }
      onChange(a);
      setOpen(false); setF({ ...blank });
    } catch (x: any) { setFail(x.message); } finally { setBusy(false); }
  }

  return (
    <div className="addr-picker">
      {chosen && (
        <div className="addr-now">
          <span className="addr-pin">📍</span>
          <div><strong>Delivering to</strong><div className="muted">{text(value)}</div></div>
          <a className="btn small ghost" href={mapUrl(value)} target="_blank" rel="noopener noreferrer">View on map</a>
          {onCheck && <button type="button" className="btn small ghost" onClick={onCheck}>Check area</button>}
        </div>
      )}
      {status && <div className="muted addr-status">{status}</div>}
      {error && <small className="error-text" role="alert">{error}</small>}

      <div className="addr-cards">
        {list.map((a) => (
          <button key={a.id} type="button" className={`addr-card ${same(a) ? 'on' : ''}`} onClick={() => onChange({ line1: a.line1, landmark: a.landmark ?? '', city: a.city, pincode: a.pincode ?? '', mapLink: a.mapLink ?? '' })}>
            <span className="addr-ic">{iconFor(a.label)}</span>
            <span className="addr-tx"><strong>{a.label}</strong><small>{text(a)}</small></span>
            <span className="addr-radio" aria-hidden />
          </button>
        ))}
        <button type="button" className="addr-card add" onClick={() => setOpen(true)}>
          <span className="addr-ic">＋</span>
          <span className="addr-tx"><strong>Add new address</strong><small>Flat, street, landmark and a label</small></span>
        </button>
      </div>

      {open && (
        <div className="sheet-back" onClick={() => !busy && setOpen(false)}>
          <div className="sheet" role="dialog" aria-label="Add new address" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head"><h3>Add new address</h3><button type="button" className="sheet-x" onClick={() => setOpen(false)} aria-label="Close">×</button></div>
            <div className="sheet-body">
              <div className="chips">
                {TAGS.map((t) => <button key={t} type="button" className={`chip ${f.tag === t ? 'on' : ''}`} onClick={() => set('tag', t)}>{ICON[t]} {t}</button>)}
              </div>
              {f.tag === 'Other' && <label className={`field ${errs.other ? 'has-error' : ''}`}><span>Save as</span><input placeholder="e.g. Parents, Gym" value={f.other} onChange={(e) => set('other', e.target.value)} />{errs.other && <small className="error-text">{errs.other}</small>}</label>}
              <div className="grid2">
                <label className={`field ${errs.flat ? 'has-error' : ''}`}><span>Flat / house no. *</span><input value={f.flat} onChange={(e) => set('flat', e.target.value)} />{errs.flat && <small className="error-text">{errs.flat}</small>}</label>
                <label className="field"><span>Floor (optional)</span><input value={f.floor} onChange={(e) => set('floor', e.target.value)} /></label>
              </div>
              <label className="field"><span>Building / apartment name (optional)</span><input value={f.building} onChange={(e) => set('building', e.target.value)} /></label>
              <label className={`field ${errs.street ? 'has-error' : ''}`}><span>Street / area *</span><input value={f.street} onChange={(e) => set('street', e.target.value)} />{errs.street && <small className="error-text">{errs.street}</small>}</label>
              <label className="field"><span>Nearby landmark (optional)</span><input placeholder="e.g. Opposite City Mall" value={f.landmark} onChange={(e) => set('landmark', e.target.value)} /></label>
              <div className="grid2">
                <label className="field"><span>City *</span><select value={f.city} onChange={(e) => set('city', e.target.value)}>{CITIES.map((c) => <option key={c}>{c}</option>)}</select></label>
                <label className="field"><span>Pincode (optional)</span><input maxLength={12} inputMode="numeric" value={f.pincode} onChange={(e) => set('pincode', e.target.value)} /></label>
              </div>
              <label className={`field ${errs.mapLink ? 'has-error' : ''}`}>
                <span>Google Maps link (optional)</span>
                <input placeholder="Paste a link from Google Maps" value={f.mapLink} onChange={(e) => set('mapLink', e.target.value)} />
                {errs.mapLink ? <small className="error-text">{errs.mapLink}</small> : <small className="muted">Helps the rider find you. <a href="https://www.google.com/maps" target="_blank" rel="noopener noreferrer">Open Google Maps</a>, drop a pin, tap Share, then paste the link here.</small>}
              </label>
              <label className="check-item"><input type="checkbox" checked={f.save} onChange={(e) => set('save', e.target.checked)} /> Save this address for next time</label>
              {fail && <small className="error-text" role="alert">{fail}</small>}
            </div>
            <div className="sheet-foot"><button type="button" className="btn primary block" disabled={busy} onClick={submit}>{busy ? 'Saving…' : 'Save and deliver here'}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
