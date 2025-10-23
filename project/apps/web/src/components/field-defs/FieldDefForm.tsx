import { useEffect, useState } from 'react';
import type { components } from '@ddms/sdk';

type FieldDef = components['schemas']['FieldDef'];
type FieldDefCreate = components['schemas']['FieldDefCreate'];
type FieldDefUpdate = components['schemas']['FieldDefUpdate'];

interface FormState {
  key: string;
  label: string;
  kind: FieldDefCreate['kind'];
  required: boolean;
  minLen?: number;
  maxLen?: number;
  regex?: string;
  min?: number;
  max?: number;
  integer?: boolean;
  enum?: string;
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

const INITIAL_FORM_STATE: FormState = {
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
  const [formState, setFormState] = useState<FormState>(INITIAL_FORM_STATE);
  const isEditMode = Boolean(initialData);

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
      setFormState(INITIAL_FORM_STATE);
    }
  }, [initialData]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    const { name, value, type, checked } = e.target;
    setFormState((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormState((prev) => ({
      ...prev,
      [name]: value === '' ? undefined : Number(value),
    }));
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const payload: Partial<FieldDefCreate | FieldDefUpdate> = {
      label: formState.label,
      required: formState.required,
    };

    if (!isEditMode) {
      (payload as FieldDefCreate).key = formState.key;
      (payload as FieldDefCreate).kind = formState.kind;
    }

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
        enum:
          formState.enum
            ?.split('\n')
            .map((option) => option.trim())
            .filter(Boolean) ?? [],
        multiselect: formState.multiselect,
      };
    }

    onSubmit(payload as FieldDefCreate | FieldDefUpdate);
  };

  const renderKindSpecificFields = () => {
    switch (formState.kind) {
      case 'text':
        return (
          <div className="surface-card surface-card--muted stack">
            <h4 style={{ margin: 0 }}>Text validation</h4>
            <div className="field-group">
              <label htmlFor="minLen">Minimum length</label>
              <input
                id="minLen"
                name="minLen"
                type="number"
                value={formState.minLen ?? ''}
                onChange={handleNumberChange}
              />
            </div>
            <div className="field-group">
              <label htmlFor="maxLen">Maximum length</label>
              <input
                id="maxLen"
                name="maxLen"
                type="number"
                value={formState.maxLen ?? ''}
                onChange={handleNumberChange}
              />
            </div>
            <div className="field-group">
              <label htmlFor="regex">Regex</label>
              <input
                id="regex"
                name="regex"
                type="text"
                value={formState.regex ?? ''}
                placeholder="^PROJ-"
                onChange={handleChange}
              />
              <span className="helper-text">Optional. Use for key prefixes or patterns.</span>
            </div>
          </div>
        );
      case 'number':
        return (
          <div className="surface-card surface-card--muted stack">
            <h4 style={{ margin: 0 }}>Number validation</h4>
            <div className="field-group">
              <label htmlFor="min">Minimum</label>
              <input
                id="min"
                name="min"
                type="number"
                value={formState.min ?? ''}
                onChange={handleNumberChange}
              />
            </div>
            <div className="field-group">
              <label htmlFor="max">Maximum</label>
              <input
                id="max"
                name="max"
                type="number"
                value={formState.max ?? ''}
                onChange={handleNumberChange}
              />
            </div>
            <label className="row" style={{ justifyContent: 'flex-start' }}>
              <input
                name="integer"
                type="checkbox"
                checked={formState.integer ?? false}
                onChange={handleChange}
              />
              <span className="helper-text">Restrict to integers only</span>
            </label>
          </div>
        );
      case 'select':
        return (
          <div className="surface-card surface-card--muted stack">
            <h4 style={{ margin: 0 }}>Select options</h4>
            <div className="field-group">
              <label htmlFor="enum">Enum values (one per line)</label>
              <textarea
                id="enum"
                name="enum"
                value={formState.enum ?? ''}
                onChange={handleChange}
              />
            </div>
            <label className="row" style={{ justifyContent: 'flex-start' }}>
              <input
                name="multiselect"
                type="checkbox"
                checked={formState.multiselect ?? false}
                onChange={handleChange}
              />
              <span className="helper-text">Allow multiple selections</span>
            </label>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <form className="modal-panel stack" onSubmit={handleSubmit}>
        <div className="modal-header">
          <div className="stack-sm">
            <h2 style={{ margin: 0 }}>{isEditMode ? 'Edit field' : 'Add field'}</h2>
            <p className="helper-text">
              Configure field metadata, validation, dependencies, and indexing.
            </p>
          </div>
          <button type="button" className="button secondary" onClick={onCancel}>
            Close
          </button>
        </div>

        <div className="stack">
          <div className="field-group">
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
            {isEditMode && (
              <span className="helper-text">Key cannot be changed after creation.</span>
            )}
          </div>

          <div className="field-group">
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

          <div className="field-group">
            <label htmlFor="kind">Kind</label>
            <select
              id="kind"
              name="kind"
              value={formState.kind}
              onChange={handleChange}
              disabled={isEditMode}
            >
              {KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {kind}
                </option>
              ))}
            </select>
            {isEditMode && (
              <span className="helper-text">Kind cannot be changed after creation.</span>
            )}
          </div>

          <label className="row" style={{ justifyContent: 'flex-start' }}>
            <input
              name="required"
              type="checkbox"
              checked={formState.required}
              onChange={handleChange}
            />
            <span className="helper-text">Mark as required for contributors</span>
          </label>

          {renderKindSpecificFields()}
        </div>

        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" disabled={isLoading}>
            {isLoading
              ? 'Saving…'
              : isEditMode
              ? 'Save changes'
              : 'Create field'}
          </button>
        </div>
      </form>
    </div>
  );
};
