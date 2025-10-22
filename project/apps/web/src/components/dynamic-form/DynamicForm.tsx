import type { components } from '@ddms/sdk';
import { useForm } from '@tanstack/react-form';
import { buildValidators } from './validation';
import { FieldControl } from './FieldControl';
import { useEffect } from 'react';

type FieldDef = components['schemas']['FieldDef'];
type ValidationError = components['schemas']['ValidationErrorDetail'];

export interface DynamicFormProps<TData extends Record<string, unknown>> {
  fieldDefs: FieldDef[];
  onSubmit: (data: TData) => void;
  initialData?: TData;
  isLoading?: boolean;
  onCancel?: () => void;
  submitText?: string;
  serverErrors?: ValidationError[] | null;
}

export function DynamicForm<TData extends Record<string, unknown>>({
  fieldDefs,
  onSubmit,
  initialData,
  isLoading,
  onCancel,
  submitText = 'Submit',
  serverErrors,
}: DynamicFormProps<TData>) {
  const form = useForm<TData>({
    defaultValues: initialData,
    onSubmit: async ({ value }) => {
      onSubmit(value);
    },
  });

  useEffect(() => {
    if (serverErrors) {
      serverErrors.forEach((error) => {
        if (error.path) {
          form.setFieldError(error.path as never, error.message);
        }
      });
    }
  }, [serverErrors, form]);

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
          name={fieldDef.key as keyof TData}
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