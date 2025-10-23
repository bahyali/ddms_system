import test from 'node:test';
import assert from 'node:assert/strict';
import type { fieldDefs } from '@ddms/db';
import { FieldIndexer } from './indexer';

type FieldDefRow = typeof fieldDefs.$inferSelect;

const baseField: FieldDefRow = {
  id: '00000000-0000-0000-0000-000000000000',
  tenantId: '11111111-1111-1111-1111-111111111111',
  entityTypeId: '22222222-2222-2222-2222-222222222222',
  key: 'example',
  label: 'Example',
  kind: 'text',
  required: false,
  uniqueWithinType: false,
  searchable: true,
  indexed: true,
  options: {},
  validate: {},
  acl: {},
  position: 0,
  active: true,
};

test('FieldIndexer.buildIndexExpression handles numeric fields', () => {
  const numericField: FieldDefRow = { ...baseField, kind: 'number', key: 'budget' };
  const expression = FieldIndexer.buildIndexExpression(numericField);
  assert.equal(expression, "((data ->> 'budget')::numeric)");
});

test('FieldIndexer.buildIndexExpression handles relation fields', () => {
  const relationField: FieldDefRow = { ...baseField, kind: 'relation', key: 'owner' };
  const expression = FieldIndexer.buildIndexExpression(relationField);
  assert.equal(expression, "((data ->> 'owner')::uuid)");
});

test('FieldIndexer.buildIndexName removes hyphens and truncates', () => {
  const fieldId = '12345678-90ab-cdef-1234-567890abcdef';
  const indexName = FieldIndexer.buildIndexName(fieldId);
  assert.equal(indexName, 'idx_records_field_1234567890abcdef1234567890abcdef');
  assert.ok(indexName.length <= 60);
});
