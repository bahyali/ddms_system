import { z, ZodTypeAny } from 'zod';
import { fieldDefs } from '@ddms/db/schema';
import { InferSelectModel } from 'drizzle-orm';

// Drizzle's InferSelectModel gives us the type of a selected row.
export type FieldDef = InferSelectModel<typeof fieldDefs>;

// Schemas for the `validate` JSONB column, nested by field kind as per manifest
const textValidationSchema = z
  .object({
    minLen: z.number().optional(),
    maxLen: z.number().optional(),
    regex: z.string().optional(),
  })
  .optional();

const numberValidationSchema = z
  .object({
    min: z.number().optional(),
    max: z.number().optional(),
    integer: z.boolean().optional(),
  })
  .optional();

const dateValidationSchema = z
  .object({
    min: z.string().optional(),
    max: z.string().optional(),
  })
  .optional();

// Schemas for the `options` JSONB column
const selectOptionsSchema = z
  .object({
    enum: z.array(z.string()).min(1),
    multiselect: z.boolean().optional(),
  })
  .optional();

const relationOptionsSchema = z
  .object({
    relation: z.object({
      target_entity_type_id: z.string().uuid(),
      cardinality: z.enum(['one', 'many']).optional(),
    }),
  })
  .optional();

/**
 * Builds a Zod schema from a single field definition.
 * @param field - The field definition from the database.
 * @returns A Zod type for the given field.
 */
function buildZodTypeFromFieldDef(field: FieldDef): ZodTypeAny {
  let zodType: ZodTypeAny;

  switch (field.kind) {
    case 'text': {
      let type = z.string();
      const validationRules = z
        .object({ text: textValidationSchema })
        .optional()
        .parse(field.validate ?? {});
      const validate = validationRules?.text;

      if (validate?.minLen !== undefined) {
        type = type.min(validate.minLen);
      }
      if (validate?.maxLen !== undefined) {
        type = type.max(validate.maxLen);
      }
      if (validate?.regex) {
        type = type.regex(new RegExp(validate.regex));
      }
      zodType = type;
      break;
    }

    case 'number': {
      let type = z.number();
      const validationRules = z
        .object({ number: numberValidationSchema })
        .optional()
        .parse(field.validate ?? {});
      const validate = validationRules?.number;

      if (validate?.min !== undefined) {
        type = type.min(validate.min);
      }
      if (validate?.max !== undefined) {
        type = type.max(validate.max);
      }
      if (validate?.integer) {
        type = type.int();
      }
      zodType = type;
      break;
    }

    case 'date': {
      let type = z.string().datetime({ message: 'Invalid ISO 8601 date format' });
      const validationRules = z
        .object({ date: dateValidationSchema })
        .optional()
        .parse(field.validate ?? {});
      const validate = validationRules?.date;

      if (validate?.min) {
        type = type.refine((val) => new Date(val) >= new Date(validate!.min!), {
          message: `Date must be on or after ${validate.min}`,
        });
      }
      if (validate?.max) {
        type = type.refine((val) => new Date(val) <= new Date(validate!.max!), {
          message: `Date must be on or before ${validate.max}`,
        });
      }
      zodType = type;
      break;
    }

    case 'boolean': {
      zodType = z.boolean();
      break;
    }

    case 'select': {
      const options = selectOptionsSchema.parse(field.options ?? {});
      if (!options?.enum) {
        throw new Error(`'select' field '${field.key}' is missing enum options.`);
      }
      const enumType = z.enum(options.enum as [string, ...string[]]);
      if (options.multiselect) {
        zodType = z.array(enumType);
      } else {
        zodType = enumType;
      }
      break;
    }

    case 'relation': {
      const options = relationOptionsSchema.parse(field.options ?? {});
      const relationOptions = options?.relation;
      if (!relationOptions?.target_entity_type_id) {
        throw new Error(
          `'relation' field '${field.key}' is missing target_entity_type_id.`,
        );
      }
      const uuidType = z.string().uuid();
      if (relationOptions.cardinality === 'many') {
        zodType = z.array(uuidType);
      } else {
        zodType = uuidType;
      }
      break;
    }

    default:
      const exhaustiveCheck: never = field.kind;
      throw new Error(`Unsupported field kind: ${exhaustiveCheck}`);
  }

  if (!field.required) {
    return zodType.optional().nullable();
  }

  return zodType;
}

/**
 * The internal schema builder without memoization.
 * @param fields - An array of field definitions.
 * @returns A Zod object schema.
 */
function buildSchemaFromFieldDefs(fields: FieldDef[]): z.ZodObject<any> {
  const shape: Record<string, ZodTypeAny> = {};

  for (const field of fields) {
    shape[field.key] = buildZodTypeFromFieldDef(field);
  }

  return z.object(shape);
}

// Memoization cache
const schemaCache = new Map<string, z.ZodObject<any>>();

/**
 * Gets a Zod validation schema for a given set of field definitions.
 * The result is memoized based on the cacheKey.
 *
 * @param cacheKey - A unique key to identify this set of field definitions (e.g., entityTypeId).
 * @param fields - An array of field definitions.
 * @returns A memoized Zod object schema.
 */
export function getValidationSchema(
  cacheKey: string,
  fields: FieldDef[],
): z.ZodObject<any> {
  if (schemaCache.has(cacheKey)) {
    return schemaCache.get(cacheKey)!;
  }

  const newSchema = buildSchemaFromFieldDefs(fields);
  schemaCache.set(cacheKey, newSchema);

  return newSchema;
}