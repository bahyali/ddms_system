import type { components } from '@ddms/sdk';

type FieldDef = components['schemas']['FieldDef'];

export type FieldValidator = (value: unknown) => string | undefined;

export function buildValidator(fieldDef: FieldDef): FieldValidator {
  const validators: FieldValidator[] = [];

  if (fieldDef.required) {
    validators.push((value) => {
      if (
        value === '' ||
        value === null ||
        value === undefined ||
        (Array.isArray(value) && value.length === 0)
      ) {
        return 'This field is required';
      }
      return undefined;
    });
  }

  if (fieldDef.kind === 'text' && fieldDef.validate?.text) {
    const { minLen, maxLen, regex } = fieldDef.validate.text;
    validators.push((value) => {
      if (typeof value !== 'string' || value === '') return undefined;
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
    validators.push((value) => {
      if (value === null || value === undefined || value === '') return undefined;
      const numValue = Number(value);
      if (Number.isNaN(numValue)) return 'Must be a number';
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

  return (value) => {
    for (const validator of validators) {
      const error = validator(value);
      if (error) return error;
    }
    return undefined;
  };
}
