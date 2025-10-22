import { describe, it } from 'node:test';
import assert from 'node:assert';
import { compileFilter, Filter } from './filter-compiler';

describe('compileFilter', () => {
  it('should handle null or empty filter', () => {
    const result = compileFilter(null);
    assert.deepStrictEqual(result, { sql: 'TRUE', params: [] });
  });

  // Simple comparison operators
  it('should compile an "eq" filter', () => {
    const filter: Filter = { op: 'eq', field: 'status', value: 'active' };
    const result = compileFilter(filter);
    assert.deepStrictEqual(result, {
      sql: `(data->>'status') = $1`,
      params: ['active'],
    });
  });

  it('should compile a "neq" filter', () => {
    const filter: Filter = { op: 'neq', field: 'name', value: 'John' };
    const result = compileFilter(filter);
    assert.deepStrictEqual(result, {
      sql: `(data->>'name') != $1`,
      params: ['John'],
    });
  });

  it('should compile a "gt" filter for a number', () => {
    const filter: Filter = { op: 'gt', field: 'age', value: 30 };
    const result = compileFilter(filter);
    assert.deepStrictEqual(result, {
      sql: `(data->>'age') > $1`,
      params: [30],
    });
  });

  it('should compile a "gte" filter', () => {
    const filter: Filter = { op: 'gte', field: 'budget', value: 1000 };
    const result = compileFilter(filter);
    assert.deepStrictEqual(result, {
      sql: `(data->>'budget') >= $1`,
      params: [1000],
    });
  });

  it('should compile an "lt" filter', () => {
    const filter: Filter = { op: 'lt', field: 'price', value: 99.99 };
    const result = compileFilter(filter);
    assert.deepStrictEqual(result, {
      sql: `(data->>'price') < $1`,
      params: [99.99],
    });
  });

  it('should compile an "lte" filter', () => {
    const filter: Filter = { op: 'lte', field: 'stock', value: 0 };
    const result = compileFilter(filter);
    assert.deepStrictEqual(result, {
      sql: `(data->>'stock') <= $1`,
      params: [0],
    });
  });

  // Special operators
  it('should compile an "in" filter', () => {
    const filter: Filter = {
      op: 'in',
      field: 'category',
      values: ['A', 'B', 'C'],
    };
    const result = compileFilter(filter);
    assert.deepStrictEqual(result, {
      sql: `(data->>'category') = ANY($1)`,
      params: [['A', 'B', 'C']],
    });
  });

  it('should compile a "contains" filter', () => {
    const filter: Filter = { op: 'contains', field: 'title', value: 'roadmap' };
    const result = compileFilter(filter);
    assert.deepStrictEqual(result, {
      sql: `(data->>'title') ILIKE $1`,
      params: ['%roadmap%'],
    });
  });

  it('should compile a "fulltext" filter', () => {
    const filter: Filter = { op: 'fulltext', query: 'agile development' };
    const result = compileFilter(filter);
    assert.deepStrictEqual(result, {
      sql: `fts @@ plainto_tsquery('simple', $1)`,
      params: ['agile development'],
    });
  });

  // Logical operators
  it('should compile an "and" filter with multiple conditions', () => {
    const filter: Filter = {
      op: 'and',
      filters: [
        { op: 'eq', field: 'status', value: 'active' },
        { op: 'gte', field: 'budget', value: 5000 },
      ],
    };
    const result = compileFilter(filter);
    assert.deepStrictEqual(result, {
      sql: `((data->>'status') = $1 AND (data->>'budget') >= $2)`,
      params: ['active', 5000],
    });
  });

  it('should compile an "or" filter with multiple conditions', () => {
    const filter: Filter = {
      op: 'or',
      filters: [
        { op: 'eq', field: 'priority', value: 'high' },
        { op: 'gt', field: 'overdue_days', value: 10 },
      ],
    };
    const result = compileFilter(filter);
    assert.deepStrictEqual(result, {
      sql: `((data->>'priority') = $1 OR (data->>'overdue_days') > $2)`,
      params: ['high', 10],
    });
  });

  it('should handle an empty "and" filter', () => {
    const filter: Filter = { op: 'and', filters: [] };
    const result = compileFilter(filter);
    assert.deepStrictEqual(result, { sql: 'TRUE', params: [] });
  });

  // Nested logical operators
  it('should compile a nested filter: (A AND B) OR C', () => {
    const filter: Filter = {
      op: 'or',
      filters: [
        {
          op: 'and',
          filters: [
            { op: 'eq', field: 'type', value: 'A' },
            { op: 'gt', field: 'value', value: 100 },
          ],
        },
        { op: 'eq', field: 'owner', value: 'admin' },
      ],
    };
    const result = compileFilter(filter);
    assert.deepStrictEqual(result, {
      sql: `(((data->>'type') = $1 AND (data->>'value') > $2) OR (data->>'owner') = $3)`,
      params: ['A', 100, 'admin'],
    });
  });

  it('should compile a nested filter: A AND (B OR C)', () => {
    const filter: Filter = {
      op: 'and',
      filters: [
        { op: 'eq', field: 'status', value: 'active' },
        {
          op: 'or',
          filters: [
            { op: 'eq', field: 'priority', value: 'high' },
            { op: 'in', field: 'tags', values: ['urgent', 'critical'] },
          ],
        },
      ],
    };
    const result = compileFilter(filter);
    assert.deepStrictEqual(result, {
      sql: `((data->>'status') = $1 AND ((data->>'priority') = $2 OR (data->>'tags') = ANY($3)))`,
      params: ['active', 'high', ['urgent', 'critical']],
    });
  });

  it('should throw an error for an unknown operator', () => {
    const filter = { op: 'unknown', field: 'test', value: 1 } as any;
    assert.throws(
      () => compileFilter(filter),
      new Error('Unsupported filter operator: unknown'),
    );
  });
});