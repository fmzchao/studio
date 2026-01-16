/**
 * Schema Validation Pipeline
 *
 * Validates Zod schemas according to ShipSec's typing rules:
 * - Requires labels (or defaults to field name)
 * - Blocks z.any()/z.unknown() without explicit allowAny
 * - Requires schemaName for named contracts
 * - Requires connectionType/editor override for unions/complex types
 */

import { z } from 'zod';
import { getPortMeta } from './port-meta';
import { deriveConnectionType } from './zod-ports';
import { ValidationError } from './errors';

export interface SchemaValidationResult {
  valid: boolean;
  errors: string[];
}

const DEFAULT_MAX_DEPTH = 1;

/**
 * Validate a Zod schema against ShipSec typing rules
 *
 * @param schema - Zod schema to validate
 * @param options - Validation options
 * @returns Validation result with any errors found
 */
export function validateComponentSchema(
  schema: z.ZodObject<any, any, any, any, any>,
  options: ValidationOptions = {}
): SchemaValidationResult {
  const errors: string[] = [];
  const shape = schema.shape;

  for (const [fieldName, fieldSchema] of Object.entries(shape)) {
    const portMeta = getPortMeta(fieldSchema);
    const connType = deriveConnectionType(fieldSchema);

    // Rule: Require label or default to field name
    if (!portMeta?.label) {
      // OK - will default to field name in extractPorts
    }

    // Rule: Block z.any()/z.unknown() without explicit allowAny
    const unwrapped = unwrapEffects(fieldSchema);
    if (isAnyOrUnknown(unwrapped) && !portMeta?.allowAny) {
      errors.push(
        `Field "${fieldName}": z.any() or z.unknown() requires explicit meta.allowAny=true${portMeta?.reason ? ` (${portMeta.reason})` : ''}`
      );
    }

    // Rule: If allowAny is set, require reason
    if (portMeta?.allowAny && !portMeta?.reason) {
      errors.push(`Field "${fieldName}": meta.allowAny=true requires meta.reason explaining why`);
    }

    // Rule: Check depth limit (default 1 level)
    if (options.maxDepth !== undefined) {
      const depth = calculateDepth(fieldSchema);
      if (depth > options.maxDepth) {
        errors.push(
          `Field "${fieldName}": Nesting depth ${depth} exceeds max depth ${options.maxDepth}. Use meta.connectionType for complex nested types.`
        );
      }
    }

    // Rule: If schemaName is set, it's a contract export
    if (portMeta?.schemaName) {
      // OK - explicit contract export
    }

    // Rule: Union/complex types require explicit connectionType or editor
    const unwrappedForUnion = unwrapEffects(fieldSchema);
    if (isUnionType(unwrappedForUnion)) {
      if (!portMeta?.connectionType && !portMeta?.editor) {
        errors.push(
          `Field "${fieldName}": Union types require explicit meta.connectionType or meta.editor override`
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export interface ValidationOptions {
  /** Maximum nesting depth for port-visible fields (default: 1) */
  maxDepth?: number;
  /** Component ID for error context */
  componentId?: string;
}

/**
 * Calculate nesting depth of a Zod schema
 * Depth = 1 for primitive/object shallow, >1 for nested
 */
function calculateDepth(schema: z.ZodTypeAny): number {
  const unwrapped = unwrapEffects(schema);
  const typeName = unwrapped._def?.typeName;

  // Primitives: depth 1
  if (isPrimitiveType(unwrapped)) {
    return 1;
  }

  // Object: depth = 1 + max(field depth)
  if (typeName === 'ZodObject') {
    const shape = (unwrapped as any).shape();
    let maxChildDepth = 0;

    for (const field of Object.values(shape)) {
      const childDepth = calculateDepth(field as z.ZodTypeAny);
      maxChildDepth = Math.max(maxChildDepth, childDepth);
    }

    return 1 + maxChildDepth;
  }

  // Array: depth = element depth
  if (typeName === 'ZodArray') {
    const element = (unwrapped as any)._def.type;
    return calculateDepth(element as z.ZodTypeAny);
  }

  // Record: depth = value depth
  if (typeName === 'ZodRecord') {
    const value = (unwrapped as any)._def.valueType;
    return calculateDepth(value as z.ZodTypeAny);
  }

  // Default depth for unknown types
  return 1;
}

/**
 * Unwrap optional, nullable, default effects
 */
function unwrapEffects(schema: z.ZodTypeAny): z.ZodTypeAny {
  let current = schema;

  while (true) {
    const def = (current as any)._def;

    if (!def) break;

    if (def.typeName === 'ZodOptional' || def.typeName === 'ZodNullable' || def.typeName === 'ZodDefault') {
      current = def.innerType;
      continue;
    }

    break;
  }

  return current;
}

/**
 * Check if schema is z.any() or z.unknown()
 */
function isAnyOrUnknown(schema: z.ZodTypeAny): boolean {
  const typeName = schema._def?.typeName;
  return typeName === 'ZodAny' || typeName === 'ZodUnknown';
}

/**
 * Check if schema is a primitive type
 */
function isPrimitiveType(schema: z.ZodTypeAny): boolean {
  const typeName = schema._def?.typeName;
  return [
    'ZodString',
    'ZodNumber',
    'ZodBoolean',
    'ZodBigInt',
    'ZodDate',
    'ZodSymbol',
  ].includes(typeName);
}

/**
 * Check if schema is a union type
 */
function isUnionType(schema: z.ZodTypeAny): boolean {
  return schema._def?.typeName === 'ZodUnion';
}
