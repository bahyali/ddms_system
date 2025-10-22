// 1. Type Definitions
type Comparator = 'eq' | 'neq' | 'lt' | 'lte' | 'gt' | 'gte';
type Logic = 'and' | 'or';

export type ComparisonFilter = {
  op: Comparator;
  field: string;
  value: unknown;
};

export type InFilter = {
  op: 'in';
  field: string;
  values: unknown[];
};

export type ContainsFilter = {
  op: 'contains';
  field: string;
  value: string;
};

export type FulltextFilter = {
  op: 'fulltext';
  query: string;
};

export type LogicalFilter = {
  op: Logic;
  filters: Filter[];
};

export type Filter =
  | LogicalFilter
  | ComparisonFilter
  | InFilter
  | ContainsFilter
  | FulltextFilter;

export type CompiledFilter = {
  sql: string;
  params: unknown[];
};

type ProcessedNode = {
  sql: string;
  params: unknown[];
  nextParamIndex: number;
};

const OPERATOR_MAP: Record<Comparator, string> = {
  eq: '=',
  neq: '!=',
  gt: '>',
  gte: '>=',
  lt: '<',
  lte: '<=',
};

// 3. Recursive Helper
function processNode(node: Filter, paramIndex: number): ProcessedNode {
  switch (node.op) {
    // 4. Logical Operators
    case 'and':
    case 'or': {
      if (node.filters.length === 0) {
        return { sql: 'TRUE', params: [], nextParamIndex: paramIndex };
      }

      let currentIndex = paramIndex;
      const childResults = node.filters.map((filter) => {
        const result = processNode(filter, currentIndex);
        currentIndex = result.nextParamIndex;
        return result;
      });

      const sqlFragments = childResults.map((r) => r.sql);
      const allParams = childResults.flatMap((r) => r.params);
      const joiner = ` ${node.op.toUpperCase()} `;

      return {
        sql: `(${sqlFragments.join(joiner)})`,
        params: allParams,
        nextParamIndex: currentIndex,
      };
    }

    // 5. Comparison Operators
    case 'eq':
    case 'neq':
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte': {
      const sqlOp = OPERATOR_MAP[node.op];
      return {
        sql: `(data->>'${node.field}') ${sqlOp} $${paramIndex}`,
        params: [node.value],
        nextParamIndex: paramIndex + 1,
      };
    }

    case 'in': {
      return {
        sql: `(data->>'${node.field}') = ANY($${paramIndex})`,
        params: [node.values],
        nextParamIndex: paramIndex + 1,
      };
    }

    case 'contains': {
      return {
        sql: `(data->>'${node.field}') ILIKE $${paramIndex}`,
        params: [`%${node.value}%`],
        nextParamIndex: paramIndex + 1,
      };
    }

    case 'fulltext': {
      return {
        sql: `fts @@ plainto_tsquery('simple', $${paramIndex})`,
        params: [node.query],
        nextParamIndex: paramIndex + 1,
      };
    }

    default: {
      const exhaustiveCheck: never = node;
      throw new Error(
        `Unsupported filter operator: ${(exhaustiveCheck as { op: string }).op}`,
      );
    }
  }
}

// 2. Main Compiler Function
/**
 * Compiles a Filter DSL object into a parameterized SQL WHERE clause.
 * @param filter - The Filter DSL object.
 * @returns An object containing the SQL string and parameters array.
 */
export function compileFilter(filter: Filter | null | undefined): CompiledFilter {
  if (!filter) {
    return { sql: 'TRUE', params: [] };
  }

  const result = processNode(filter, 1);
  return {
    sql: result.sql,
    params: result.params,
  };
}