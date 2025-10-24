import { useMemo, useState, type ChangeEvent } from 'react';
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

function useRelationOptions(
  entityTypeKey?: string,
  entityTypeId?: string,
  selectedIds: string[] = [],
) {
  return useQuery<RelationOption[]>({
    queryKey: ['relation-options', entityTypeKey, [...selectedIds].sort().join(',')],
    enabled: Boolean(entityTypeKey),
    queryFn: async () => {
      if (!entityTypeKey) return [];

      const [fieldsResponse, recordsResponse] = await Promise.all([
        entityTypeId
          ? api.GET('/entity-types/{entityTypeId}/fields', {
              params: { path: { entityTypeId } },
            })
          : Promise.resolve({ data: [] as components['schemas']['FieldDef'][] }),
        api.POST('/entities/{entityTypeKey}/search', {
          params: { path: { entityTypeKey } },
          body: { limit: 50 },
        }),
      ]);

      if (fieldsResponse.error) {
        throw fieldsResponse.error;
      }
      if (recordsResponse.error) {
        throw recordsResponse.error;
      }

      const fieldDefs = (fieldsResponse.data ?? []) as components['schemas']['FieldDef'][];
      const records =
        (recordsResponse.data?.rows as components['schemas']['Record'][] | undefined) ?? [];

      const recordsById = new Map<string, components['schemas']['Record']>();
      records.forEach((record) => {
        recordsById.set(record.id, record);
      });

      const missingSelectedIds = selectedIds.filter((id) => !recordsById.has(id));
      if (missingSelectedIds.length > 0) {
        const additionalRecords = await Promise.all(
          missingSelectedIds.map(async (recordId) => {
            const { data, error } = await api.GET('/entities/{entityTypeKey}/{recordId}', {
              params: { path: { entityTypeKey, recordId } },
            });
            if (error || !data) {
              return null;
            }
            return data as components['schemas']['Record'];
          }),
        );
        additionalRecords
          .filter((record): record is components['schemas']['Record'] => Boolean(record))
          .forEach((record) => {
            recordsById.set(record.id, record);
          });
      }

      return Array.from(recordsById.values()).map((record) => ({
        id: record.id,
        label: deriveRelationLabel(record, fieldDefs),
      }));
    },
  });
}

function deriveRelationLabel(
  record: components['schemas']['Record'],
  fieldDefs: components['schemas']['FieldDef'][],
) {
  if (typeof record.label === 'string' && record.label.trim().length > 0) {
    return record.label;
  }

  const sortedFields = [...fieldDefs].sort(
    (a, b) => (a.position ?? 0) - (b.position ?? 0),
  );
  const candidateFields = sortedFields.filter((field) => field.kind !== 'relation');

  const data = (record.data ?? {}) as Record<string, unknown>;

  const tryValue = (value: unknown): string | null => {
    if (value === null || value === undefined) return null;
    if (Array.isArray(value)) {
      const normalized = value
        .map((item) => {
          if (typeof item === 'string') return item.trim();
          if (typeof item === 'number' || typeof item === 'boolean') return String(item);
          if (item && typeof item === 'object') {
            const label = (item as { label?: unknown }).label;
            if (typeof label === 'string' && label.trim().length > 0) {
              return label.trim();
            }
            const name = (item as { name?: unknown }).name;
            if (typeof name === 'string' && name.trim().length > 0) {
              return name.trim();
            }
            const valueProperty = (item as { value?: unknown }).value;
            if (typeof valueProperty === 'string' && valueProperty.trim().length > 0) {
              return valueProperty.trim();
            }
          }
          return null;
        })
        .filter((entry): entry is string => Boolean(entry && entry.length > 0));
      if (normalized.length > 0) {
        return normalized.join(', ');
      }
      return null;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    if (value && typeof value === 'object') {
      const label = (value as { label?: unknown }).label;
      if (typeof label === 'string' && label.trim().length > 0) {
        return label.trim();
      }
      const name = (value as { name?: unknown }).name;
      if (typeof name === 'string' && name.trim().length > 0) {
        return name.trim();
      }
    }
    return null;
  };

  for (const field of candidateFields) {
    const maybeValue = tryValue(data[field.key]);
    if (maybeValue) {
      return maybeValue;
    }
  }

  return record.id;
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

  const selectedIds = useMemo(() => {
    if (relationOptions?.cardinality === 'many') {
      if (Array.isArray(value)) {
        return (value as unknown[])
          .map((item) => (typeof item === 'string' ? item : null))
          .filter((item): item is string => Boolean(item));
      }
      if (typeof value === 'string' && value.trim().length > 0) {
        return [value.trim()];
      }
      return [];
    }
    if (typeof value === 'string' && value.trim().length > 0) {
      return [value.trim()];
    }
    return [];
  }, [relationOptions?.cardinality, value]);

  const { data: options = [], isLoading: isLoadingOptions } = useRelationOptions(
    entityTypeKey,
    targetEntityTypeId,
    selectedIds,
  );
  const optionLookup = useMemo(
    () => new Map(options.map((option) => [option.id, option])),
    [options],
  );
  const [searchTerm, setSearchTerm] = useState('');
  const normalizedSearch = useMemo(
    () => searchTerm.trim().toLowerCase(),
    [searchTerm],
  );
  const multiSelectedValues = useMemo(() => {
    if (relationOptions?.cardinality === 'many') {
      return selectedIds;
    }
    return [];
  }, [relationOptions?.cardinality, selectedIds]);
  const selectedDescriptors = useMemo(
    () =>
      multiSelectedValues.map((id) => ({
        id,
        label: optionLookup.get(id)?.label ?? id,
      })),
    [multiSelectedValues, optionLookup],
  );
  const filteredOptions = useMemo(() => {
    if (relationOptions?.cardinality !== 'many') {
      return options;
    }
    if (!normalizedSearch) {
      return options;
    }
    const matches = options.filter((option) => {
      const haystack = `${option.label} ${option.id}`.toLowerCase();
      return haystack.includes(normalizedSearch);
    });
    const presentIds = new Set(matches.map((option) => option.id));
    selectedDescriptors.forEach((descriptor) => {
      if (!presentIds.has(descriptor.id)) {
        const option = optionLookup.get(descriptor.id);
        if (option) {
          matches.unshift(option);
          presentIds.add(option.id);
        }
      }
    });
    return matches;
  }, [
    normalizedSearch,
    optionLookup,
    options,
    relationOptions?.cardinality,
    selectedDescriptors,
  ]);

  const helperText = targetEntity
    ? `Select or paste a ${targetEntity.label} record ID.`
    : 'Paste the related record UUID.';

  if (relationOptions?.cardinality === 'many') {
    const handleMultiChange = (event: ChangeEvent<HTMLSelectElement>) => {
      const selected = Array.from(event.target.selectedOptions, (option) => option.value);
      onChange(selected);
    };

    return (
      <div className="stack-sm">
        <input
          type="search"
          placeholder={targetEntity ? `Search ${targetEntity.label}` : 'Search records'}
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          aria-label="Filter relation options"
        />
        {isLoadingOptions && <span className="helper-text">Loading options…</span>}
        <select
          id={fieldKey}
          name={fieldKey}
          multiple
          value={multiSelectedValues}
          onChange={handleMultiChange}
          onBlur={onBlur}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${fieldKey}-error` : undefined}
          aria-busy={isLoadingOptions}
          style={{ minHeight: '140px' }}
        >
          {filteredOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        {filteredOptions.length === 0 && !isLoadingOptions && (
          <span className="helper-text">No matches. Try another search or paste IDs below.</span>
        )}
        {selectedDescriptors.length > 0 && (
          <div className="chip-group">
            {selectedDescriptors.map((item) => (
              <span key={item.id} className="chip">
                {item.label}
              </span>
            ))}
          </div>
        )}
        <input
          type="text"
          placeholder="Add IDs separated by commas"
          onBlur={(event) => {
            const manualValues = event.target.value
              .split(',')
              .map((item) => item.trim())
              .filter(Boolean);
            if (manualValues.length > 0) {
              const merged = Array.from(new Set([...multiSelectedValues, ...manualValues]));
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
