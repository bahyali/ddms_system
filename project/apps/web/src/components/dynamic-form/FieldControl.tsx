import type { ChangeEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { components } from '@ddms/sdk';
import api from '~/lib/api';

type FieldDef = components['schemas']['FieldDef'];

interface FieldControlProps {
  fieldKey: string;
  fieldDef: FieldDef;
  value: unknown;
  error?: string;
  onChange: (value: unknown) => void;
  onBlur: () => void;
  entityTypesById?: Map<string, { key: string; label: string }>;
}

export function FieldControl({
  fieldKey,
  fieldDef,
  value,
  error,
  onChange,
  onBlur,
  entityTypesById,
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
        <DateInput
          {...commonInputProps}
          value={value}
          onChange={onChange}
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
        onChange: (event: ChangeEvent<HTMLSelectElement>) => {
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
        <RelationPicker
          fieldKey={fieldKey}
          fieldDef={fieldDef}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          entityTypesById={entityTypesById}
          error={error}
        />
      );

    default:
      return <p>Unsupported field kind: {fieldDef.kind}</p>;
  }
}

type RelationOption = {
  id: string;
  label: string;
};

function useRelationOptions(entityTypeKey?: string) {
  return useQuery<RelationOption[]>({
    queryKey: ['relation-options', entityTypeKey],
    enabled: Boolean(entityTypeKey),
    queryFn: async () => {
      if (!entityTypeKey) return [];
      const { data, error } = await api.POST('/entities/{entityTypeKey}/search', {
        params: { path: { entityTypeKey } },
        body: { limit: 20 },
      });
      if (error || !data) {
        return [];
      }

      return data.rows.map((record) => {
        const rawData = record.data as Record<string, unknown> | undefined;
        const labelCandidate = rawData
          ? (['name', 'label', 'title']
              .map((key) => rawData[key])
              .find((val): val is string => typeof val === 'string' && val.length > 0) ?? null)
          : null;
        return {
          id: record.id,
          label: labelCandidate ?? record.id,
        };
      });
    },
  });
}

interface RelationPickerProps {
  fieldKey: string;
  fieldDef: FieldDef;
  value: unknown;
  onChange: (value: unknown) => void;
  onBlur: () => void;
  entityTypesById?: Map<string, { key: string; label: string }>;
  error?: string;
}

function RelationPicker({
  fieldKey,
  fieldDef,
  value,
  onChange,
  onBlur,
  entityTypesById,
  error,
}: RelationPickerProps) {
  const relationOptions = (fieldDef.options as { relation?: { target_entity_type_id?: string; cardinality?: 'one' | 'many' } })?.relation;
  const targetEntityTypeId = relationOptions?.target_entity_type_id;
  const targetEntity = targetEntityTypeId
    ? entityTypesById?.get(targetEntityTypeId)
    : undefined;
  const entityTypeKey = targetEntity?.key;

  const { data: options = [] } = useRelationOptions(entityTypeKey);

  const helperText = targetEntity
    ? `Select or paste a ${targetEntity.label} record ID.`
    : 'Paste the related record UUID.';

  if (relationOptions?.cardinality === 'many') {
    const selectedValues = Array.isArray(value)
      ? (value as string[])
      : typeof value === 'string' && value
      ? [value]
      : [];

    const handleMultiChange = (event: ChangeEvent<HTMLSelectElement>) => {
      const selected = Array.from(event.target.selectedOptions, (option) => option.value);
      onChange(selected);
    };

    return (
      <div className="stack-sm">
        <select
          id={fieldKey}
          name={fieldKey}
          multiple
          value={selectedValues}
          onChange={handleMultiChange}
          onBlur={onBlur}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${fieldKey}-error` : undefined}
          style={{ minHeight: '120px' }}
        >
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Add IDs separated by commas"
          onBlur={(event) => {
            const manualValues = event.target.value
              .split(',')
              .map((item) => item.trim())
              .filter(Boolean);
            if (manualValues.length > 0) {
              const merged = Array.from(new Set([...selectedValues, ...manualValues]));
              onChange(merged);
              event.target.value = '';
              onBlur();
            }
          }}
        />
        <span className="helper-text">{helperText}</span>
      </div>
    );
  }

  return (
    <div className="stack-sm">
      <input
        id={fieldKey}
        name={fieldKey}
        list={`${fieldKey}-relation-options`}
        value={typeof value === 'string' ? value : ''}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${fieldKey}-error` : undefined}
      />
      <datalist id={`${fieldKey}-relation-options`}>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </datalist>
      <span className="helper-text">{helperText}</span>
    </div>
  );
}

interface DateInputProps {
  id: string;
  name: string;
  value: unknown;
  onChange: (value: unknown) => void;
  onBlur: () => void;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
}

function DateInput({ value, onChange, ...props }: DateInputProps) {
  const isoDateTimeRegex = /^\d{4}-\d{2}-\d{2}T/;
  const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
  const europeanRegex = /^(\d{2})\.(\d{2})\.(\d{4})$/;

  const displayValue = (() => {
    if (typeof value !== 'string' || value.length === 0) {
      return '';
    }
    if (isoDateTimeRegex.test(value)) {
      return value.slice(0, 10);
    }
    if (isoDateRegex.test(value)) {
      return value;
    }
    const euMatch = value.match(europeanRegex);
    if (euMatch) {
      const [, day, month, year] = euMatch;
      return `${year}-${month}-${day}`;
    }
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.valueOf())) {
      return parsed.toISOString().slice(0, 10);
    }
    return '';
  })();

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value;
    if (!raw) {
      onChange('');
      return;
    }
    if (isoDateRegex.test(raw)) {
      onChange(new Date(`${raw}T00:00:00.000Z`).toISOString());
      return;
    }
    const euMatch = raw.match(europeanRegex);
    if (euMatch) {
      const [, day, month, year] = euMatch;
      onChange(new Date(`${year}-${month}-${day}T00:00:00.000Z`).toISOString());
      return;
    }
    const asDate = event.target.valueAsDate;
    if (asDate && !Number.isNaN(asDate.valueOf())) {
      onChange(asDate.toISOString());
      return;
    }
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.valueOf())) {
      onChange(parsed.toISOString());
      return;
    }
    onChange(raw);
  };

  return (
    <input
      {...props}
      type="date"
      value={displayValue}
      onChange={handleChange}
    />
  );
}
