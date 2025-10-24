import { useMemo, useState } from 'react';
import type { components } from '@ddms/sdk';

type FieldDef = components['schemas']['FieldDef'];
type Filter = components['schemas']['Filter'];
type FieldKind = FieldDef['kind'];

interface FilterBuilderProps {
  fieldDefs: FieldDef[];
  onApplyFilter: (filter: Filter | null) => void;
}

interface FilterRule {
  id: string;
  fieldKey: string;
  operator: string;
  value: string;
}

const generateRuleId = () => {
  if (typeof crypto !== 'undefined') {
    if (typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    if (typeof crypto.getRandomValues === 'function') {
      const buffer = new Uint32Array(4);
      crypto.getRandomValues(buffer);
      return Array.from(buffer, (value) =>
        value.toString(16).padStart(8, '0'),
      ).join('-');
    }
  }
  return `rule-${Math.random().toString(36).slice(2, 10)}`;
};

const OPERATORS_BY_KIND: Record<
  NonNullable<FieldKind>,
  { value: string; label: string }[]
> = {
  text: [
    { value: 'eq', label: 'is' },
    { value: 'neq', label: 'is not' },
    { value: 'contains', label: 'contains' },
  ],
  number: [
    { value: 'eq', label: '=' },
    { value: 'neq', label: '!=' },
    { value: 'gt', label: '>' },
    { value: 'gte', label: '>=' },
    { value: 'lt', label: '<' },
    { value: 'lte', label: '<=' },
  ],
  date: [
    { value: 'eq', label: 'is on' },
    { value: 'neq', label: 'is not on' },
    { value: 'gt', label: 'is after' },
    { value: 'gte', label: 'is on or after' },
    { value: 'lt', label: 'is before' },
    { value: 'lte', label: 'is on or before' },
  ],
  select: [
    { value: 'eq', label: 'is' },
    { value: 'neq', label: 'is not' },
  ],
  boolean: [{ value: 'eq', label: 'is' }],
  relation: [
    { value: 'eq', label: 'is' },
    { value: 'neq', label: 'is not' },
  ],
};

export function FilterBuilder({
  fieldDefs,
  onApplyFilter,
}: FilterBuilderProps) {
  const [rules, setRules] = useState<FilterRule[]>([]);
  const fieldDefMap = useMemo(
    () => new Map(fieldDefs.map((fd) => [fd.key, fd])),
    [fieldDefs]
  );

  const handleAddRule = () => {
    setRules([
      ...rules,
      {
        id: generateRuleId(),
        fieldKey: fieldDefs[0]?.key || '',
        operator: '',
        value: '',
      },
    ]);
  };

  const handleRemoveRule = (id: string) => {
    setRules(rules.filter((rule) => rule.id !== id));
  };

  const handleRuleChange = (id: string, newRuleData: Partial<FilterRule>) => {
    setRules(
      rules.map((rule) => {
        if (rule.id === id) {
          const updatedRule = { ...rule, ...newRuleData };
          // If fieldKey changed, reset operator and value
          if ('fieldKey' in newRuleData) {
            updatedRule.operator = '';
            updatedRule.value = '';
          }
          return updatedRule;
        }
        return rule;
      })
    );
  };

  const handleApply = () => {
    if (rules.length === 0) {
      onApplyFilter(null);
      return;
    }

    const filters = rules
      .filter((rule) => {
        if (!rule.fieldKey || !rule.operator || rule.value === '') return false;
        const fieldDef = fieldDefMap.get(rule.fieldKey);
        if (fieldDef?.kind === 'number' && isNaN(parseFloat(rule.value))) {
          return false; // Don't apply filter with invalid number
        }
        return true;
      })
      .map((rule) => {
        const fieldDef = fieldDefMap.get(rule.fieldKey);
        let coercedValue: string | number | boolean = rule.value;
        if (fieldDef?.kind === 'number') {
          coercedValue = parseFloat(rule.value);
        } else if (fieldDef?.kind === 'boolean') {
          coercedValue = rule.value === 'true';
        }
        return {
          op: rule.operator,
          field: rule.fieldKey,
          value: coercedValue,
        };
      });

    if (filters.length === 0) {
      onApplyFilter(null);
      return;
    }

    const filterDsl: Filter = {
      op: 'and',
      filters: filters as Filter[],
    };
    onApplyFilter(filterDsl);
  };

  const handleClear = () => {
    setRules([]);
    onApplyFilter(null);
  };

  const renderValueInput = (rule: FilterRule) => {
    const fieldDef = fieldDefMap.get(rule.fieldKey);
    if (!fieldDef) return <input type="text" disabled />;

    switch (fieldDef.kind) {
      case 'number':
        return (
          <input
            type="number"
            value={rule.value}
            onChange={(e) => handleRuleChange(rule.id, { value: e.target.value })}
          />
        );
      case 'date':
        return (
          <input
            type="date"
            value={rule.value}
            onChange={(e) => handleRuleChange(rule.id, { value: e.target.value })}
          />
        );
      case 'boolean':
        return (
          <select
            value={rule.value}
            onChange={(e) => handleRuleChange(rule.id, { value: e.target.value })}
          >
            <option value="">Select...</option>
            <option value="true">True</option>
            <option value="false">False</option>
          </select>
        );
      case 'select':
        return (
          <select
            value={rule.value}
            onChange={(e) => handleRuleChange(rule.id, { value: e.target.value })}
          >
            <option value="">Select...</option>
            {fieldDef.options?.enum?.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        );
      case 'text':
      case 'relation':
      default:
        return (
          <input
            type="text"
            value={rule.value}
            onChange={(e) => handleRuleChange(rule.id, { value: e.target.value })}
          />
        );
    }
  };

  return (
    <div className="filter-builder">
      {rules.length === 0 && (
        <p className="helper-text">No filters applied yet. Add a condition to get started.</p>
      )}
      {rules.map((rule) => {
        const selectedFieldDef = fieldDefMap.get(rule.fieldKey);
        const operators =
          selectedFieldDef?.kind && OPERATORS_BY_KIND[selectedFieldDef.kind]
            ? OPERATORS_BY_KIND[selectedFieldDef.kind]
            : [];

        return (
          <div key={rule.id} className="filter-rule">
            <select
              value={rule.fieldKey}
              onChange={(e) =>
                handleRuleChange(rule.id, { fieldKey: e.target.value })
              }
            >
              {fieldDefs.map((fd) => (
                <option key={fd.key} value={fd.key}>
                  {fd.label}
                </option>
              ))}
            </select>
            <select
              value={rule.operator}
              onChange={(e) =>
                handleRuleChange(rule.id, { operator: e.target.value })
              }
              disabled={!rule.fieldKey}
            >
              <option value="">Select operator...</option>
              {operators.map((op) => (
                <option key={op.value} value={op.value}>
                  {op.label}
                </option>
              ))}
            </select>

            {renderValueInput(rule)}

            <button
              type="button"
              className="button secondary"
              onClick={() => handleRemoveRule(rule.id)}
              aria-label="Remove filter"
            >
              Remove
            </button>
          </div>
        );
      })}
      <div className="row row-wrap" style={{ marginTop: 'var(--space-3)' }}>
        <button
          type="button"
          className="button secondary"
          onClick={handleAddRule}
          disabled={fieldDefs.length === 0}
        >
          Add condition
        </button>
        <button type="button" onClick={handleApply}>
          Apply
        </button>
        <button type="button" className="button secondary" onClick={handleClear}>
          Reset
        </button>
      </div>
    </div>
  );
}
