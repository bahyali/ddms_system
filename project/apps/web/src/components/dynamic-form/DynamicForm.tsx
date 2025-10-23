import { useEffect, useMemo, useState } from 'react';
import type { components } from '@ddms/sdk';
import { FieldControl } from './FieldControl';
import { buildValidator, type FieldValidator } from './validation';

type FieldDef = components['schemas']['FieldDef'];
type ValidationError = components['schemas']['ValidationErrorDetail'];

type FormState = Record<string, unknown>;
type FormErrors = Record<string, string | undefined>;
type FormTouched = Record<string, boolean>;

export interface DynamicFormProps<TData extends Record<string, unknown>> {
  fieldDefs: FieldDef[];
  onSubmit: (data: TData) => void;
  initialData?: TData;
  isLoading?: boolean;
  onCancel?: () => void;
  submitText?: string;
  serverErrors?: ValidationError[] | null;
  entityTypesById?: Map<string, { key: string; label: string }>;
}

function initialValueForField(fieldDef: FieldDef, existingValue: unknown) {
  if (existingValue !== undefined && existingValue !== null) {
    return existingValue;
  }
  switch (fieldDef.kind) {
    case 'boolean':
      return false;
    case 'select':
      return fieldDef.options?.multiselect ? [] : '';
    case 'number':
      return '';
    case 'relation': {
      const relationOptions = (fieldDef.options as { relation?: { cardinality?: string } })?.relation;
      return relationOptions?.cardinality === 'many' ? [] : '';
    }
    default:
      return '';
  }
}

export function DynamicForm<TData extends Record<string, unknown>>({
  fieldDefs,
  onSubmit,
  initialData,
  isLoading,
  onCancel,
  submitText = 'Submit',
  serverErrors,
  entityTypesById,
}: DynamicFormProps<TData>) {
  const [formValues, setFormValues] = useState<FormState>({ ...initialData });
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<FormTouched>({});

  useEffect(() => {
    setFormValues({ ...initialData });
    setErrors({});
    setTouched({});
  }, [initialData]);

  const validators = useMemo(() => {
    const map = new Map<string, FieldValidator>();
    fieldDefs.forEach((fieldDef) => {
      map.set(fieldDef.key, buildValidator(fieldDef));
    });
    return map;
  }, [fieldDefs]);

  useEffect(() => {
    if (!serverErrors || serverErrors.length === 0) return;
    setErrors((previous) => {
      const next = { ...previous };
      serverErrors.forEach((error) => {
        if (error.path) {
          next[error.path] = error.message;
        }
      });
      return next;
    });
    setTouched((previous) => {
      const next = { ...previous };
      serverErrors.forEach((error) => {
        if (error.path) {
          next[error.path] = true;
        }
      });
      return next;
    });
  }, [serverErrors]);

  const fieldDefMap = useMemo(() => {
    const map = new Map<string, FieldDef>();
    fieldDefs.forEach((fieldDef) => map.set(fieldDef.key, fieldDef));
    return map;
  }, [fieldDefs]);

  const handleFieldChange = (fieldKey: string, value: unknown) => {
    setFormValues((previous) => ({
      ...previous,
      [fieldKey]: value,
    }));

    const validator = validators.get(fieldKey);
    if (validator) {
      const error = validator(value);
      setErrors((previous) => ({
        ...previous,
        [fieldKey]: error,
      }));
    }
  };

  const handleFieldBlur = (fieldKey: string) => {
    setTouched((previous) => ({
      ...previous,
      [fieldKey]: true,
    }));

    const validator = validators.get(fieldKey);
    if (validator) {
      const fieldDef = fieldDefMap.get(fieldKey);
      const currentValue =
        formValues[fieldKey] !== undefined
          ? formValues[fieldKey]
          : fieldDef
          ? initialValueForField(fieldDef, formValues[fieldKey])
          : formValues[fieldKey];
      const error = validator(currentValue);
      setErrors((previous) => ({
        ...previous,
        [fieldKey]: error,
      }));
    }
  };

  const runValidation = (): boolean => {
    const nextErrors: FormErrors = {};
    fieldDefs.forEach((fieldDef) => {
      const validator = validators.get(fieldDef.key);
      if (!validator) return;
      const currentValue =
        formValues[fieldDef.key] !== undefined
          ? formValues[fieldDef.key]
          : initialValueForField(fieldDef, formValues[fieldDef.key]);
      const error = validator(currentValue);
      if (error) {
        nextErrors[fieldDef.key] = error;
      }
    });
    setErrors(nextErrors);
    setTouched((previous) => ({
      ...previous,
      ...fieldDefs.reduce<FormTouched>((accumulator, fieldDef) => {
        accumulator[fieldDef.key] = true;
        return accumulator;
      }, {}),
    }));
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (!runValidation()) {
      return;
    }

    const payload: FormState = {};
    for (const fieldDef of fieldDefs) {
      const rawValue = formValues[fieldDef.key];
      const value =
        rawValue !== undefined
          ? rawValue
          : initialValueForField(fieldDef, rawValue);

      const isEmptyString = typeof value === 'string' && value.trim() === '';
      const isEmptyArray = Array.isArray(value) && value.length === 0;
      const isNullish = value === null || value === undefined;

      if (fieldDef.kind === 'relation') {
        if (isNullish || isEmptyString || isEmptyArray) {
          if (fieldDef.required) {
            payload[fieldDef.key] = value;
          }
          continue;
        }
        payload[fieldDef.key] = value;
        continue;
      }

      if (isNullish || isEmptyString || isEmptyArray) {
        if (fieldDef.required) {
          payload[fieldDef.key] = value;
        }
        continue;
      }

      payload[fieldDef.key] = value;
    }

    onSubmit(payload as TData);
  };

  return (
    <form onSubmit={handleSubmit} className="stack">
      {fieldDefs.map((fieldDef) => {
        const fieldKey = fieldDef.key;
        const value = initialValueForField(fieldDef, formValues[fieldKey]);
        const error = errors[fieldKey];
        const isTouched = touched[fieldKey];

        return (
          <div className="field-group" key={fieldKey}>
            <label htmlFor={fieldKey}>{fieldDef.label}</label>
            <FieldControl
              fieldKey={fieldKey}
              fieldDef={fieldDef}
              value={value}
              error={isTouched ? error : undefined}
              onChange={(nextValue) => handleFieldChange(fieldKey, nextValue)}
              onBlur={() => handleFieldBlur(fieldKey)}
              entityTypesById={entityTypesById}
            />
            {isTouched && error && (
              <em id={`${fieldKey}-error`} style={{ color: '#d32f2f', fontSize: '0.875rem' }}>
                {error}
              </em>
            )}
          </div>
        );
      })}

      <div className="row row-wrap" style={{ marginTop: 'var(--space-4)' }}>
        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Submitting…' : submitText}
        </button>
        {onCancel && (
          <button type="button" className="button secondary" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
