'use client';
/** Allergy and diet form made of checkboxes and radio buttons. Used by the subscription builder and the customer dashboard. */
import { Field } from '@/components/ui';
import { SEVERITY_LABEL } from '@/lib/api';

export interface AllergyValue {
  status: 'NONE' | 'HAS' | 'SKIP';
  allergens: string[];
  other: string;
  severity: string;
  dislikes: string;
  notes: string;
}

export const emptyAllergy: AllergyValue = { status: 'SKIP', allergens: [], other: '', severity: 'MODERATE', dislikes: '', notes: '' };

const STATUS: [AllergyValue['status'], string][] = [
  ['HAS', 'I have an allergy or intolerance'],
  ['NONE', 'No allergies'],
  ['SKIP', 'Skip for now'],
];

export function AllergyForm({ value, options, onChange, error }: { value: AllergyValue; options: string[]; onChange: (v: AllergyValue) => void; error?: string }) {
  const set = (patch: Partial<AllergyValue>) => onChange({ ...value, ...patch });
  const toggle = (a: string) => set({ allergens: value.allergens.includes(a) ? value.allergens.filter((x) => x !== a) : [...value.allergens, a] });
  return (
    <div className="allergy-form">
      <fieldset className="check-group">
        <legend>Do you have any food allergies?</legend>
        {STATUS.map(([v, label]) => (
          <label key={v} className="check-item"><input type="radio" name="allergy-status" checked={value.status === v} onChange={() => set({ status: v })} /> {label}</label>
        ))}
      </fieldset>

      {value.status === 'HAS' && (
        <>
          <fieldset className="check-group">
            <legend>Tick everything you react to</legend>
            <div className="check-grid">
              {options.map((a) => (
                <label key={a} className="check-item"><input type="checkbox" checked={value.allergens.includes(a)} onChange={() => toggle(a)} /> {a}</label>
              ))}
            </div>
            {error && <small className="error-text" role="alert">{error}</small>}
          </fieldset>
          <Field label="Any other food, ingredient or additive" hint="Separate with commas. For example: prawns, kiwi, MSG.">
            <input value={value.other} maxLength={200} onChange={(e) => set({ other: e.target.value })} />
          </Field>
          <fieldset className="check-group">
            <legend>How strong is the reaction?</legend>
            {['MILD', 'MODERATE', 'SEVERE'].map((s) => (
              <label key={s} className="check-item"><input type="radio" name="allergy-severity" checked={value.severity === s} onChange={() => set({ severity: s })} /> {SEVERITY_LABEL[s]}</label>
            ))}
          </fieldset>
        </>
      )}

      <Field label="Foods you simply prefer to avoid" hint="Dislikes and diet choices, not allergies.">
        <input value={value.dislikes} maxLength={300} onChange={(e) => set({ dislikes: e.target.value })} />
      </Field>
      <Field label="Anything else the kitchen should know" hint="For example cross-contact, a separate bag, or an emergency medicine you carry.">
        <textarea rows={2} value={value.notes} maxLength={500} onChange={(e) => set({ notes: e.target.value })} />
      </Field>
    </div>
  );
}
