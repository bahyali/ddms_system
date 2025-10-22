import type { FieldApi } from '@tanstack/react-form';
import type { components } from '@ddms/sdk';

type FieldDef = components['schemas']['FieldDef'];

interface FieldControlProps {
  field: FieldApi<Record<string, unknown>, string, unknown, unknown>;
  fieldDef: FieldDef;
}

export function FieldControl({ field, fieldDef }: FieldControlProps) {
  const commonProps = {
    id: field.name,
    name: field.name,
    value: field.state.value ?? '',
    onBlur: field.handleBlur,
  };

  switch (fieldDef.kind) {
    case 'text':
      return (
        <input
          {...commonProps}
          type="text"
          onChange={(e) => field.handleChange(e.target.value)}
        />
      );
    case 'number':
      return (
        <input
          {...commonProps}
          type="number"
          onChange={(e) =>
            field.handleChange(e.target.value === '' ? null : e.target.valueAsNumber)
          }
        />
      );
    case 'date':
      return (
        <input
          {...commonProps}
          type="date"
          onChange={(e) => field.handleChange(e.target.value)}
        />
      );
    case 'boolean':
      return (
        <input
          id={field.name}
          name={field.name}
          type="checkbox"
          checked={!!field.state.value}
          onBlur={field.handleBlur}
          onChange={(e) => field.handleChange(e.target.checked)}
          style={{ alignSelf: 'flex-start', width: 'auto', height: '1.5rem' }}
        />
      );
    case 'select':
      return (
        <select
          {...commonProps}
          multiple={fieldDef.options?.multiselect}
          onChange={(e) => {
            if (fieldDef.options?.multiselect) {
              const selected = Array.from(
                e.target.selectedOptions,
                (option) => option.value
              );
              field.handleChange(selected);
            } else {
              field.handleChange(e.target.value);
            }
          }}
        >
          {!fieldDef.options?.multiselect && <option value="">Select...</option>}
          {fieldDef.options?.enum?.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
    // 'relation' kind is treated as a text input for now.
    // A more advanced implementation would use an async search picker.
    case 'relation':
      return (
        <input
          {...commonProps}
          type="text"
          placeholder="Enter related record ID"
          onChange={(e) => field.handleChange(e.target.value)}
        />
      );
    default:
      return <p>Unsupported field kind: {fieldDef.kind}</p>;
  }
}