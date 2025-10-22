import type { components } from '@ddms/sdk';
import { useForm } from '@tanstack/react-form';
import { buildValidators } from './validation';
import { FieldControl } from './FieldControl';

type FieldDef = components['schemas']['FieldDef'];

export interface DynamicFormProps<TData extends Record<string, any>> {
  fieldDefs: FieldDef[];
  onSubmit: (data: TData) => void;
  initialData?: TData;
  isLoading?: boolean;
  onCancel?: () => void;
  submitText?: string;
}

export function DynamicForm<TData extends Record<string, any>>({
  fieldDefs,
  onSubmit,
  initialData,
  isLoading,
  onCancel,
  submitText = 'Submit',
}: DynamicFormProps<TData>) {
  const form = useForm<TData>({
    defaultValues: initialData,
    onSubmit: async ({ value }) => {
      onSubmit(value);
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
    >
      {fieldDefs.map((fieldDef) => (
        <form.Field
          key={fieldDef.key}
          name={fieldDef.key as any}
          validators={buildValidators<TData>(fieldDef)}
        >
          {(field) => (
            <div>
              <label htmlFor={field.name}>{fieldDef.label}</label>
              <FieldControl field={field} fieldDef={fieldDef} />
              {field.state.meta.touchedErrors ? (
                <em style={{ color: '#d32f2f', fontSize: '0.875rem' }}>
                  {field.state.meta.touchedErrors.join(', ')}
                </em>
              ) : null}
            </div>
          )}
        </form.Field>
      ))}

      <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', flexDirection: 'row' }}>
        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Submitting...' : submitText}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} style={{ backgroundColor: '#666' }}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}