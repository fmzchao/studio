/**
 * Zod Port Extraction and Connection Types
 *
 * Derives port metadata and connection types from Zod schemas.
 * This replaces the legacy PortDataType system with Zod-first derivation.
 */

import { z } from 'zod';
import type { ComponentPortMetadata } from './types';
import { getPortMeta, mergePortMeta, type PortMeta } from './port-meta';

export interface ConnectionType {
  kind: 'primitive' | 'contract' | 'list' | 'map' | 'any';
  name?: string; // primitive name or contract name
  element?: ConnectionType; // for list/map
  credential?: boolean; // for contract ports
}

export interface ValidationResult {
  ok: boolean;
  error?: string;
}

const CONNECTION_TYPE_SYMBOL = Symbol('shipsec.connectionType');

/**
 * Extract port metadata from a Zod schema (object keys)
 *
 * @param schema - Zod object schema to extract from
 * @param defaultLabelPrefix - Prefix for default labels (defaults to field name)
 * @returns Array of ComponentPortMetadata derived from schema keys
 */
export function extractPorts(
  schema: z.ZodObject<any, any, any, any, any>,
  defaultLabelPrefix: string = ''
): ComponentPortMetadata[] {
  const ports: ComponentPortMetadata[] = [];
  const shape = schema.shape;

  for (const [fieldName, fieldSchema] of Object.entries(shape)) {
    const portMeta = getPortMeta(fieldSchema);
    const connectionType = deriveConnectionType(fieldSchema);
    const isRequired = !isOptional(fieldSchema);

    const metadata: PortMeta = portMeta || {};
    const label = metadata.label || fieldName;

    ports.push({
      id: fieldName,
      label,
      dataType: toLegacyPortDataType(connectionType),
      required: isRequired,
      description: metadata.description,
      valuePriority: metadata.valuePriority,
      isBranching: metadata.isBranching,
      branchColor: metadata.branchColor,
    });
  }

  return ports;
}

/**
 * Derive connection type from Zod schema
 *
 * @param schema - Zod schema to analyze
 * @returns ConnectionType derived from schema
 */
export function deriveConnectionType(schema: z.ZodTypeAny): ConnectionType {
  // Check for explicit connection type override in metadata
  const portMeta = getPortMeta(schema);
  if (portMeta?.connectionType) {
    return {
      kind: 'contract',
      name: portMeta.connectionType,
    };
  }

  // Unwrap optional, nullable, default effects
  const unwrapped = unwrapEffects(schema);

  // Handle explicit any/unknown with allowAny flag
  if (unwrapped._def?.typeName === 'ZodAny' || unwrapped._def?.typeName === 'ZodUnknown') {
    if (portMeta?.allowAny) {
      return { kind: 'any' };
    }
    throw new Error(
      `z.any() or z.unknown() requires explicit allowAny=true${portMeta?.reason ? `: ${portMeta.reason}` : ''}`
    );
  }

  // Primitive types
  if (isPrimitiveType(unwrapped)) {
    return {
      kind: 'primitive',
      name: getPrimitiveTypeName(unwrapped),
    };
  }

  // Array types
  if (unwrapped._def?.typeName === 'ZodArray') {
    const element = deriveConnectionType((unwrapped as any)._def.type);
    return {
      kind: 'list',
      element,
    };
  }

  // Record types
  if (unwrapped._def?.typeName === 'ZodRecord') {
    const value = deriveConnectionType((unwrapped as any)._def.valueType);
    return {
      kind: 'map',
      element: value,
    };
  }

  // Union types - require explicit connectionType override
  if (unwrapped._def?.typeName === 'ZodUnion') {
    if (portMeta?.connectionType) {
      return {
        kind: 'contract',
        name: portMeta.connectionType,
      };
    }
    throw new Error(
      'Union types require explicit meta.connectionType override to define compatibility'
    );
  }

  // Check for schemaName (named contract)
  if (portMeta?.schemaName) {
    return {
      kind: 'contract',
      name: portMeta.schemaName,
      credential: portMeta.isCredential,
    };
  }

  // Default: treat as any with error (developer should be explicit)
  throw new Error(
    `Cannot derive connection type for schema. Use meta.connectionType or meta.schemaName for complex types.`
  );
}

/**
 * Check if two connection types are compatible
 *
 * @param source - Source connection type
 * @param target - Target connection type
 * @returns true if compatible, false otherwise
 */
export function canConnect(source: ConnectionType, target: ConnectionType): boolean {
  // Wildcard: any accepts anything and anything accepts any
  if (source.kind === 'any' || target.kind === 'any') {
    return true;
  }

  // Primitive to primitive: check coercion rules
  if (source.kind === 'primitive' && target.kind === 'primitive') {
    return source.name === target.name || canCoercePrimitive(source.name!, target.name!);
  }

  // Contract to contract: strict name match
  if (source.kind === 'contract' && target.kind === 'contract') {
    return source.name === target.name && source.credential === target.credential;
  }

  // List to list: recursive element check
  if (source.kind === 'list' && target.kind === 'list') {
    return canConnect(source.element!, target.element!);
  }

  // Map to map: recursive value check
  if (source.kind === 'map' && target.kind === 'map') {
    return canConnect(source.element!, target.element!);
  }

  return false;
}

/**
 * Unwrap optional, nullable, and default effects to get inner type
 */
function unwrapEffects(schema: z.ZodTypeAny): z.ZodTypeAny {
  let current = schema;

  while (true) {
    const def = (current as any)._def;

    if (!def) break;

    // ZodOptional: z.optional()
    if (def.typeName === 'ZodOptional') {
      current = def.innerType;
      continue;
    }

    // ZodNullable: z.nullable()
    if (def.typeName === 'ZodNullable') {
      current = def.innerType;
      continue;
    }

    // ZodDefault: z.default()
    if (def.typeName === 'ZodDefault') {
      current = def.innerType;
      continue;
    }

    break;
  }

  return current;
}

/**
 * Check if schema is optional (has optional effect)
 */
function isOptional(schema: z.ZodTypeAny): boolean {
  const unwrapped = unwrapEffects(schema);
  const def = (unwrapped as any)._def;

  // Check if wrapped in optional
  let current = schema;
  while (true) {
    const currentDef = (current as any)._def;
    if (currentDef?.typeName === 'ZodOptional') {
      return true;
    }
    if (currentDef?.typeName === 'ZodDefault' || currentDef?.typeName === 'ZodNullable') {
      current = currentDef.innerType;
      continue;
    }
    break;
  }

  return false;
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
 * Get primitive type name
 */
function getPrimitiveTypeName(schema: z.ZodTypeAny): string {
  const typeName = schema._def?.typeName;

  switch (typeName) {
    case 'ZodString':
      return 'text';
    case 'ZodNumber':
      return 'number';
    case 'ZodBoolean':
      return 'boolean';
    case 'ZodBigInt':
      return 'number';
    case 'ZodDate':
      return 'text';
    case 'ZodSymbol':
      return 'text';
    default:
      return 'any';
  }
}

/**
 * Check if primitive can coerce from source to target
 */
function canCoercePrimitive(source: string, target: string): string {
  // Number and boolean can be coerced to text
  if (target === 'text') {
    return ['number', 'boolean', 'text'].includes(source);
  }

  // Text can be coerced to number or boolean if parseable
  if (target === 'number' || target === 'boolean') {
    return source === 'text';
  }

  return false;
}

/**
 * Convert ConnectionType to legacy PortDataType format
 * (Temporary helper during migration - will be removed in Phase 6)
 */
function toLegacyPortDataType(connType: ConnectionType): any {
  if (connType.kind === 'primitive') {
    return { kind: 'primitive', name: connType.name };
  }

  if (connType.kind === 'contract') {
    return {
      kind: 'contract',
      name: connType.name,
      credential: connType.credential,
    };
  }

  if (connType.kind === 'list') {
    return {
      kind: 'list',
      element: toLegacyPortDataType(connType.element!),
    };
  }

  if (connType.kind === 'map') {
    return {
      kind: 'map',
      value: toLegacyPortDataType(connType.element!),
    };
  }

  if (connType.kind === 'any') {
    return { kind: 'primitive', name: 'any' };
  }

  throw new Error(`Unknown connection type: ${connType.kind}`);
}
