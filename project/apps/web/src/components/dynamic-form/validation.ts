import type { components } from '@ddms/sdk';
import type { FieldOptions } from '@tanstack/react-form';

type FieldDef = components['schemas']['FieldDef'];

// A validator builder that translates our FieldDef validation rules
// into a format that TanStack Form can understand.
export function buildValidators<TData>(
  fieldDef: FieldDef
): FieldOptions<TData, any, any, any>['validators'] {
  const validators: FieldOptions<TData, any, any, any>['validators'] = {};

  const allValidators: any[] = [];

  // Required validator
  if (fieldDef.required) {
    allValidators.push(({ value }: { value: any }) => {
      if (value === '' || value === null || value === undefined) {
        return 'This field is required';
      }
      if (Array.isArray(value) && value.length === 0) {
        return 'This field is required';
      }
      return undefined;
    });
  }

  // Kind-specific validators
  if (fieldDef.kind === 'text' && fieldDef.validate?.text) {
    const { minLen, maxLen, regex } = fieldDef.validate.text;
    allValidators.push(({ value }: { value: any }) => {
      if (typeof value !== 'string' || value === '') return; // Don't validate if not a string or empty
      if (minLen && value.length < minLen) {
        return `Must be at least ${minLen} characters`;
      }
      if (maxLen && value.length > maxLen) {
        return `Must be at most ${maxLen} characters`;
      }
      if (regex && !new RegExp(regex).test(value)) {
        return 'Invalid format';
      }
      return undefined;
    });
  }

  if (fieldDef.kind === 'number' && fieldDef.validate?.number) {
    const { min, max, integer } = fieldDef.validate.number;
    allValidators.push(({ value }: { value: any }) => {
      if (value === null || value === undefined || value === '') return; // Don't validate if empty
      const numValue = Number(value);
      if (isNaN(numValue)) return 'Must be a number';
      if (min !== undefined && numValue < min) {
        return `Must be at least ${min}`;
      }
      if (max !== undefined && numValue > max) {
        return `Must be at most ${max}`;
      }
      if (integer && !Number.isInteger(numValue)) {
        return 'Must be an integer';
      }
      return undefined;
    });
  }

  if (allValidators.length > 0) {
    validators.onChange = (props: { value: any }) => {
      for (const validator of allValidators) {
        const error = validator(props);
        if (error) return error;
      }
      return undefined;
    };
  }

  return validators;
}