/**
 * JSON Schema Generation from Zod
 *
 * Generates tool/operation JSON schemas from Zod schemas.
 * This is for future tool integration, not used in current workflow execution.
 */

import { z } from 'zod';

/**
 * Generate JSON schema from Zod schema
 *
 * @param schema - Zod schema to convert
 * @returns JSON Schema object
 */
export function getToolSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  const jsonSchema = zodToJsonSchema(schema);

  return jsonSchema;
}

/**
 * Convert Zod schema to JSON Schema format
 * Simplified implementation - may use zod-to-json-schema for complex cases
 */
function zodToJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  const def = (schema as any)._def;

  // Handle ZodObject
  if (def.typeName === 'ZodObject') {
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const [key, field] of Object.entries(def.shape())) {
      const fieldSchema = field as z.ZodTypeAny;
      properties[key] = zodToJsonSchema(fieldSchema);

      // Check if field is required
      if (!isOptional(fieldSchema)) {
        required.push(key);
      }
    }

    return {
      type: 'object',
      properties,
      ...(required.length > 0 ? { required } : {}),
    };
  }

  // Handle ZodString
  if (def.typeName === 'ZodString') {
    return { type: 'string' };
  }

  // Handle ZodNumber
  if (def.typeName === 'ZodNumber') {
    return { type: 'number' };
  }

  // Handle ZodBoolean
  if (def.typeName === 'ZodBoolean') {
    return { type: 'boolean' };
  }

  // Handle ZodArray
  if (def.typeName === 'ZodArray') {
    return {
      type: 'array',
      items: zodToJsonSchema((def as any).type),
    };
  }

  // Handle ZodRecord
  if (def.typeName === 'ZodRecord') {
    return {
      type: 'object',
      additionalProperties: zodToJsonSchema((def as any).valueType),
    };
  }

  // Handle ZodUnion
  if (def.typeName === 'ZodUnion') {
    const options = (def as any).options.map((opt: z.ZodTypeAny) => zodToJsonSchema(opt));
    return {
      anyOf: options,
    };
  }

  // Handle ZodAny / ZodUnknown
  if (def.typeName === 'ZodAny' || def.typeName === 'ZodUnknown') {
    return {};
  }

  // Handle ZodLiteral
  if (def.typeName === 'ZodLiteral') {
    return {
      type: typeof (def as any).value,
      const: (def as any).value,
    };
  }

  // Handle ZodEnum
  if (def.typeName === 'ZodEnum') {
    return {
      type: typeof (def as any).values[0],
      enum: (def as any).values,
    };
  }

  // Handle ZodOptional
  if (def.typeName === 'ZodOptional') {
    return zodToJsonSchema((def as any).innerType);
  }

  // Handle ZodNullable
  if (def.typeName === 'ZodNullable') {
    return {
      anyOf: [
        zodToJsonSchema((def as any).innerType),
        { type: 'null' },
      ],
    };
  }

  // Handle ZodDefault
  if (def.typeName === 'ZodDefault') {
    const innerSchema = zodToJsonSchema((def as any).innerType);
    innerSchema.default = (def as any).defaultValue();
    return innerSchema;
  }

  // Fallback: treat as unknown
  return {};
}

/**
 * Check if schema is optional
 */
function isOptional(schema: z.ZodTypeAny): boolean {
  let current = schema;

  while (true) {
    const def = (current as any)._def;

    if (!def) break;

    if (def.typeName === 'ZodOptional') {
      return true;
    }

    if (def.typeName === 'ZodDefault' || def.typeName === 'ZodNullable') {
      current = def.innerType;
      continue;
    }

    break;
  }

  return false;
}
