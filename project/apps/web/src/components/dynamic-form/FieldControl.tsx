import type { components } from '@ddms/sdk';

type FieldDef = components['schemas']['FieldDef'];

interface FieldControlProps {
  fieldKey: string;
  fieldDef: FieldDef;
  value: unknown;
  error?: string;
  onChange: (value: unknown) => void;
  onBlur: () => void;
}

export function FieldControl({
  fieldKey,
  fieldDef,
  value,
  error,
  onChange,
  onBlur,
}: FieldControlProps) {
  const commonInputProps = {
    id: fieldKey,
    name: fieldKey,
    onBlur,
    'aria-invalid': Boolean(error),
    'aria-describedby': error ? `${fieldKey}-error` : undefined,
  } as const;

  switch (fieldDef.kind) {
    case 'text':
      return (
        <input
          {...commonInputProps}
          type="text"
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(event.target.value)}
        />
      );

    case 'number':
      return (
        <input
          {...commonInputProps}
          type="number"
          value={typeof value === 'number' || value === '' ? value ?? '' : ''}
          onChange={(event) => {
            const nextValue = event.target.value;
            onChange(nextValue === '' ? '' : Number(nextValue));
          }}
        />
      );

    case 'date':
      return (
        <input
          {...commonInputProps}
          type="date"
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(event.target.value)}
        />
      );

    case 'boolean':
      return (
        <input
          {...commonInputProps}
          type="checkbox"
          checked={Boolean(value)}
          onChange={(event) => onChange(event.target.checked)}
          style={{ alignSelf: 'flex-start', width: 'auto' }}
        />
      );

    case 'select': {
      const isMultiselect = Boolean(fieldDef.options?.multiselect);
      const selectProps = {
        ...commonInputProps,
        multiple: isMultiselect,
        value: isMultiselect
          ? Array.isArray(value)
            ? value
            : []
          : typeof value === 'string'
          ? value
          : '',
        onChange: (event: React.ChangeEvent<HTMLSelectElement>) => {
          if (isMultiselect) {
            const selectedValues = Array.from(
              event.target.selectedOptions,
              (option) => option.value,
            );
            onChange(selectedValues);
          } else {
            onChange(event.target.value);
          }
        },
      };

      return (
        <select {...selectProps}>
          {!isMultiselect && <option value="">Select…</option>}
          {fieldDef.options?.enum?.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
    }

    case 'relation':
      return (
        <input
          {...commonInputProps}
          type="text"
          placeholder="Enter related record ID"
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(event.target.value)}
        />
      );

    default:
      return <p>Unsupported field kind: {fieldDef.kind}</p>;
  }
}
