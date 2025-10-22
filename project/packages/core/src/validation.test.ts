import { describe, it } from 'node:test';
import assert from 'node:assert';
import { getValidationSchema, FieldDef } from './validation';
import { ZodError } from 'zod';

const baseFieldDef: Omit<FieldDef, 'key' | 'kind'> = {
  id: 'uuid-id',
  tenantId: 'uuid-tenant',
  entityTypeId: 'uuid-entity-type',
  label: 'Test Field',
  required: false,
  uniqueWithinType: false,
  searchable: true,
  indexed: false,
  options: {},
  validate: {},
  acl: {},
  position: 0,
  active: true,
};

describe('getValidationSchema', () => {
  it('should handle required and optional text fields', () => {
    const fields: FieldDef[] = [
      { ...baseFieldDef, key: 'name', kind: 'text', required: true },
      { ...baseFieldDef, key: 'description', kind: 'text', required: false },
    ];
    const schema = getValidationSchema('text-test', fields);

    assert.doesNotThrow(() => schema.parse({ name: 'test' }));
    assert.throws(() => schema.parse({}), ZodError);
    assert.doesNotThrow(() => schema.parse({ name: 'test', description: null }));
    assert.doesNotThrow(() =>
      schema.parse({ name: 'test', description: 'desc' }),
    );
  });

  it('should handle text validation rules (minLen, maxLen, regex)', () => {
    const fields: FieldDef[] = [
      {
        ...baseFieldDef,
        key: 'code',
        kind: 'text',
        required: true,
        validate: { text: { minLen: 3, maxLen: 5, regex: '^[A-Z]+$' } },
      },
    ];
    const schema = getValidationSchema('text-validation-test', fields);

    assert.doesNotThrow(() => schema.parse({ code: 'ABCDE' }));
    assert.throws(
      () => schema.parse({ code: 'AB' }),
      ZodError,
      'minLen failed',
    );
    assert.throws(
      () => schema.parse({ code: 'ABCDEF' }),
      ZodError,
      'maxLen failed',
    );
    assert.throws(
      () => schema.parse({ code: 'abc' }),
      ZodError,
      'regex failed',
    );
  });

  it('should handle number validation rules (min, max, integer)', () => {
    const fields: FieldDef[] = [
      {
        ...baseFieldDef,
        key: 'amount',
        kind: 'number',
        required: true,
        validate: { number: { min: 0, max: 100, integer: true } },
      },
    ];
    const schema = getValidationSchema('number-validation-test', fields);

    assert.doesNotThrow(() => schema.parse({ amount: 50 }));
    assert.throws(
      () => schema.parse({ amount: -1 }),
      ZodError,
      'min failed',
    );
    assert.throws(
      () => schema.parse({ amount: 101 }),
      ZodError,
      'max failed',
    );
    assert.throws(
      () => schema.parse({ amount: 50.5 }),
      ZodError,
      'integer failed',
    );
  });

  it('should handle date validation', () => {
    const fields: FieldDef[] = [
      {
        ...baseFieldDef,
        key: 'eventDate',
        kind: 'date',
        required: true,
      },
    ];
    const schema = getValidationSchema('date-validation-test', fields);

    assert.doesNotThrow(() =>
      schema.parse({ eventDate: new Date().toISOString() }),
    );
    assert.throws(() => schema.parse({ eventDate: 'not a date' }), ZodError);
  });

  it('should handle boolean fields', () => {
    const fields: FieldDef[] = [
      { ...baseFieldDef, key: 'isActive', kind: 'boolean', required: true },
    ];
    const schema = getValidationSchema('boolean-test', fields);

    assert.doesNotThrow(() => schema.parse({ isActive: true }));
    assert.throws(() => schema.parse({ isActive: 'true' }), ZodError);
    assert.throws(() => schema.parse({}), ZodError);
  });

  it('should handle single-select fields', () => {
    const fields: FieldDef[] = [
      {
        ...baseFieldDef,
        key: 'status',
        kind: 'select',
        required: true,
        options: { enum: ['open', 'closed'] },
      },
    ];
    const schema = getValidationSchema('select-single-test', fields);

    assert.doesNotThrow(() => schema.parse({ status: 'open' }));
    assert.throws(() => schema.parse({ status: 'pending' }), ZodError);
  });

  it('should handle multi-select fields', () => {
    const fields: FieldDef[] = [
      {
        ...baseFieldDef,
        key: 'tags',
        kind: 'select',
        required: false,
        options: { enum: ['a', 'b', 'c'], multiselect: true },
      },
    ];
    const schema = getValidationSchema('select-multi-test', fields);

    assert.doesNotThrow(() => schema.parse({ tags: ['a', 'c'] }));
    assert.throws(() => schema.parse({ tags: ['a', 'd'] }), ZodError);
    assert.doesNotThrow(() => schema.parse({}));
  });

  it('should handle relation fields (one and many)', () => {
    const userEntityTypeId = 'a1b2c3d4-e5f6-7890-1234-567890abcdef';
    const projectEntityTypeId = 'f0e9d8c7-b6a5-4321-fedc-ba9876543210';
    const fields: FieldDef[] = [
      {
        ...baseFieldDef,
        key: 'ownerId',
        kind: 'relation',
        required: true,
        options: { relation: { target_entity_type_id: userEntityTypeId } }, // cardinality 'one' is default
      },
      {
        ...baseFieldDef,
        key: 'projectIds',
        kind: 'relation',
        required: false,
        options: {
          relation: {
            target_entity_type_id: projectEntityTypeId,
            cardinality: 'many',
          },
        },
      },
    ];
    const schema = getValidationSchema('relation-test', fields);
    const validUUID = '123e4567-e89b-12d3-a456-426614174000';

    assert.doesNotThrow(() => schema.parse({ ownerId: validUUID }));
    assert.throws(() => schema.parse({ ownerId: 'not-a-uuid' }), ZodError);
    assert.doesNotThrow(() =>
      schema.parse({ ownerId: validUUID, projectIds: [validUUID] }),
    );
    assert.throws(
      () => schema.parse({ ownerId: validUUID, projectIds: ['not-a-uuid'] }),
      ZodError,
    );
  });

  it('should use memoized schema on subsequent calls', () => {
    const fields: FieldDef[] = [
      { ...baseFieldDef, key: 'name', kind: 'text', required: true },
    ];
    const schema1 = getValidationSchema('memo-test', fields);
    const schema2 = getValidationSchema('memo-test', fields);

    assert.strictEqual(schema1, schema2);
  });
});