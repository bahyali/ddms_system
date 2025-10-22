import { useState, useEffect } from 'react';
import type { components } from '@ddms/sdk';

type FieldDef = components['schemas']['FieldDef'];
type FieldDefCreate = components['schemas']['FieldDefCreate'];
type FieldDefUpdate = components['schemas']['FieldDefUpdate'];

// A simplified local state that can hold all possible values
interface FormState {
  key: string;
  label: string;
  kind: FieldDefCreate['kind'];
  required: boolean;
  // text validation
  minLen?: number;
  maxLen?: number;
  regex?: string;
  // number validation
  min?: number;
  max?: number;
  integer?: boolean;
  // select options
  enum?: string; // Stored as a newline-separated string in the form
  multiselect?: boolean;
}

const KINDS: FieldDefCreate['kind'][] = [
  'text',
  'number',
  'date',
  'select',
  'relation',
  'boolean',
];

const initialFormState: FormState = {
  key: '',
  label: '',
  kind: 'text',
  required: false,
  minLen: undefined,
  maxLen: undefined,
  regex: '',
  min: undefined,
  max: undefined,
  integer: false,
  enum: '',
  multiselect: false,
};

interface FieldDefFormProps {
  initialData?: FieldDef | null;
  onSubmit: (data: FieldDefCreate | FieldDefUpdate) => void;
  isLoading: boolean;
  onCancel: () => void;
}

export const FieldDefForm = ({
  initialData,
  onSubmit,
  isLoading,
  onCancel,
}: FieldDefFormProps) => {
  const [formState, setFormState] = useState<FormState>(initialFormState);

  const isEditMode = !!initialData;

  useEffect(() => {
    if (initialData) {
      setFormState({
        key: initialData.key,
        label: initialData.label,
        kind: initialData.kind,
        required: initialData.required ?? false,
        minLen: initialData.validate?.text?.minLen,
        maxLen: initialData.validate?.text?.maxLen,
        regex: initialData.validate?.text?.regex,
        min: initialData.validate?.number?.min,
        max: initialData.validate?.number?.max,
        integer: initialData.validate?.number?.integer,
        enum: initialData.options?.enum?.join('\n') ?? '',
        multiselect: initialData.options?.multiselect,
      });
    } else {
      setFormState(initialFormState);
    }
  }, [initialData]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    const isCheckbox = type === 'checkbox';
    const checked = isCheckbox ? (e.target as HTMLInputElement).checked : undefined;

    setFormState((prev) => ({
      ...prev,
      [name]: isCheckbox ? checked : value,
    }));
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormState((prev) => ({
      ...prev,
      [name]: value === '' ? undefined : Number(value),
    }));
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Build the payload
    const payload: Partial<FieldDefCreate | FieldDefUpdate> = {
      label: formState.label,
      required: formState.required,
    };

    if (!isEditMode) {
      (payload as FieldDefCreate).key = formState.key;
      (payload as FieldDefCreate).kind = formState.kind;
    }

    // Add kind-specific options and validations
    if (formState.kind === 'text') {
      payload.validate = {
        text: {
          minLen: formState.minLen,
          maxLen: formState.maxLen,
          regex: formState.regex || undefined,
        },
      };
    } else if (formState.kind === 'number') {
      payload.validate = {
        number: {
          min: formState.min,
          max: formState.max,
          integer: formState.integer,
        },
      };
    } else if (formState.kind === 'select') {
      payload.options = {
        enum: formState.enum?.split('\n').filter(Boolean).map(s => s.trim()),
        multiselect: formState.multiselect,
      };
    }

    onSubmit(payload as FieldDefCreate | FieldDefUpdate);
  };

  return (
    <form onSubmit={handleSubmit} style={{ border: 'none', padding: 0 }}>
      {/* Using a simple modal-like structure */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', zIndex: 1000
      }}>
        <div style={{ background: 'white', padding: '2rem', borderRadius: '8px', width: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
          <h2>{isEditMode ? 'Edit Field' : 'Add New Field'}</h2>
          
          <div>
            <label htmlFor="key">Key</label>
            <input
              id="key"
              name="key"
              type="text"
              value={formState.key}
              onChange={handleChange}
              required
              disabled={isEditMode}
              pattern="^[a-z0-9_]+$"
              title="Key must be lowercase letters, numbers, and underscores only."
            />
            {isEditMode && <small>Key cannot be changed after creation.</small>}
          </div>

          <div>
            <label htmlFor="label">Label</label>
            <input
              id="label"
              name="label"
              type="text"
              value={formState.label}
              onChange={handleChange}
              required
            />
          </div>

          <div>
            <label htmlFor="kind">Kind</label>
            <select
              id="kind"
              name="kind"
              value={formState.kind}
              onChange={handleChange}
              disabled={isEditMode}
            >
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
            {isEditMode && <small>Kind cannot be changed after creation.</small>}
          </div>

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'normal' }}>
              <input
                name="required"
                type="checkbox"
                checked={formState.required}
                onChange={handleChange}
              />
              Required
            </label>
          </div>

          {/* Conditional Fields */}
          {formState.kind === 'text' && (
            <fieldset style={{ border: '1px solid #ccc', padding: '1rem', borderRadius: '4px', marginTop: '1rem' }}>
              <legend>Text Validation</legend>
              <div>
                <label htmlFor="minLen">Min Length</label>
                <input id="minLen" name="minLen" type="number" value={formState.minLen ?? ''} onChange={handleNumberChange} />
              </div>
              <div>
                <label htmlFor="maxLen">Max Length</label>
                <input id="maxLen" name="maxLen" type="number" value={formState.maxLen ?? ''} onChange={handleNumberChange} />
              </div>
              <div>
                <label htmlFor="regex">Regex Pattern</label>
                <input id="regex" name="regex" type="text" value={formState.regex ?? ''} onChange={handleChange} />
              </div>
            </fieldset>
          )}

          {formState.kind === 'number' && (
            <fieldset style={{ border: '1px solid #ccc', padding: '1rem', borderRadius: '4px', marginTop: '1rem' }}>
              <legend>Number Validation</legend>
              <div>
                <label htmlFor="min">Min Value</label>
                <input id="min" name="min" type="number" value={formState.min ?? ''} onChange={handleNumberChange} />
              </div>
              <div>
                <label htmlFor="max">Max Value</label>
                <input id="max" name="max" type="number" value={formState.max ?? ''} onChange={handleNumberChange} />
              </div>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'normal' }}>
                  <input name="integer" type="checkbox" checked={formState.integer ?? false} onChange={handleChange} />
                  Must be an integer
                </label>
              </div>
            </fieldset>
          )}

          {formState.kind === 'select' && (
            <fieldset style={{ border: '1px solid #ccc', padding: '1rem', borderRadius: '4px', marginTop: '1rem' }}>
              <legend>Select Options</legend>
              <div>
                <label htmlFor="enum">Options (one per line)</label>
                <textarea id="enum" name="enum" value={formState.enum ?? ''} onChange={handleChange} />
              </div>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'normal' }}>
                  <input name="multiselect" type="checkbox" checked={formState.multiselect ?? false} onChange={handleChange} />
                  Allow multiple selections
                </label>
              </div>
            </fieldset>
          )}

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', flexDirection: 'row' }}>
            <button type="submit" disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Save Field'}
            </button>
            <button type="button" onClick={onCancel} style={{ backgroundColor: '#666' }}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </form>
  );
};