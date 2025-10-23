import Link from 'next/link';
import type { components } from '@ddms/sdk';

type FieldDef = components['schemas']['FieldDef'];

interface EntityTypeMeta {
  key: string;
  label: string;
}

interface FieldValueDisplayProps {
  fieldDef: FieldDef;
  value: unknown;
  entityTypesById?: Map<string, EntityTypeMeta>;
}

const defaultFormatter = (raw: unknown) => {
  if (raw === null || raw === undefined) {
    return '—';
  }
  if (typeof raw === 'string' && raw.trim().length === 0) {
    return '—';
  }
  if (Array.isArray(raw)) {
    if (raw.length === 0) return '—';
    return raw.map((item) => defaultFormatter(item)).join(', ');
  }
  return String(raw);
};

const formatDate = (raw: unknown) => {
  if (typeof raw !== 'string' || raw.length === 0) {
    return null;
  }
  const date = new Date(raw);
  if (Number.isNaN(date.valueOf())) {
    return null;
  }

  const hasTime = /[T\s]\d{2}:\d{2}/.test(raw);
  const formatter = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: hasTime ? 'short' : undefined,
  });
  return formatter.format(date);
};

const formatNumber = (raw: unknown) => {
  if (typeof raw !== 'number') {
    if (typeof raw === 'string' && raw.length > 0) {
      const parsed = Number(raw);
      if (!Number.isNaN(parsed)) {
        return new Intl.NumberFormat().format(parsed);
      }
    }
    return null;
  }
  return new Intl.NumberFormat().format(raw);
};

const truncate = (value: string, max = 32) => {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}…`;
};

export const FieldValueDisplay = ({
  fieldDef,
  value,
  entityTypesById,
}: FieldValueDisplayProps) => {
  if (value === null || value === undefined) {
    return <span className="helper-text">—</span>;
  }

  switch (fieldDef.kind) {
    case 'boolean': {
      const state = Boolean(value);
      return (
        <span className={`badge ${state ? 'positive' : 'warning'}`}>
          {state ? 'Yes' : 'No'}
        </span>
      );
    }
    case 'number': {
      const formatted = formatNumber(value);
      if (formatted === null) {
        return <span>{defaultFormatter(value)}</span>;
      }
      return <span className="value-strong">{formatted}</span>;
    }
    case 'date': {
      const formatted = formatDate(value);
      if (!formatted) {
        return <span>{defaultFormatter(value)}</span>;
      }
      return (
        <time dateTime={typeof value === 'string' ? value : undefined}>
          {formatted}
        </time>
      );
    }
    case 'select': {
      const renderedValues = Array.isArray(value) ? value : [value];
      if (!renderedValues.length) {
        return <span className="helper-text">—</span>;
      }
      return (
        <div className="chip-group">
          {renderedValues.map((item, index) => {
            const label =
              typeof item === 'string'
                ? item
                : defaultFormatter(item);
            return (
              <span
                className="chip chip--muted"
                key={`${fieldDef.key}-${index}-${label}`}
              >
                {label}
              </span>
            );
          })}
        </div>
      );
    }
    case 'relation': {
      const relationConfig = (fieldDef.options as {
        relation?: {
          target_entity_type_id?: string;
          cardinality?: 'one' | 'many';
        };
      })?.relation;

      const targetEntity =
        relationConfig?.target_entity_type_id
          ? entityTypesById?.get(relationConfig.target_entity_type_id)
          : undefined;

      const values = Array.isArray(value)
        ? value
        : typeof value === 'string' && value.length > 0
        ? [value]
        : [];

      if (values.length === 0) {
        return <span className="helper-text">—</span>;
      }

      return (
        <div className="stack-sm">
          {values.map((id) => {
            if (typeof id !== 'string') {
              return (
                <span key={String(id)} className="helper-text">
                  {defaultFormatter(id)}
                </span>
              );
            }

            const href =
              targetEntity?.key ? `/entities/${targetEntity.key}/${id}` : undefined;
            const label = truncate(id);
            return (
              href ? (
                <Link
                  key={id}
                  href={href}
                  className="chip chip--interactive"
                  title={id}
                >
                  {targetEntity?.label && (
                    <span className="chip-prefix">{targetEntity.label}</span>
                  )}
                  {label}
                </Link>
              ) : (
                <span className="chip chip--muted" key={id} title={id}>
                  {label}
                </span>
              )
            );
          })}
        </div>
      );
    }
    case 'text':
    default: {
      if (typeof value === 'string' && value.length > 160) {
        return (
          <span title={value}>
            {`${value.slice(0, 157)}…`}
          </span>
        );
      }
      return <span>{defaultFormatter(value)}</span>;
    }
  }
};
