import type { ComponentDefinition } from './types';
import { ConfigurationError } from './errors';
import { z } from 'zod';
import { extractPorts, deriveConnectionType } from './zod-ports';
import { validateComponentSchema } from './schema-validation';

type AnyComponentDefinition = ComponentDefinition<any, any, any>;

export interface CachedComponentMetadata {
  definition: AnyComponentDefinition;
  inputs: any[];
  outputs: any[];
  connectionTypes: Record<string, any>;
}

export class ComponentRegistry {
  private components = new Map<string, CachedComponentMetadata>();

  register<I, O, P = Record<string, unknown>>(definition: ComponentDefinition<I, O, P>): void {
    if (this.components.has(definition.id)) {
      throw new ConfigurationError(`Component ${definition.id} is already registered`, {
        configKey: 'componentId',
        details: { componentId: definition.id },
      });
    }

    // Validate component schemas against ShipSec typing rules
    if (definition.inputSchema._def?.typeName === 'ZodObject') {
      const validation = validateComponentSchema(definition.inputSchema);
      if (!validation.valid) {
        throw new ConfigurationError(
          `Component ${definition.id} has invalid input schema: ${validation.errors.join(', ')}`,
          {
            configKey: 'inputSchema',
            details: { componentId: definition.id, errors: validation.errors },
          }
        );
      }
    }

    if (definition.outputSchema._def?.typeName === 'ZodObject') {
      const validation = validateComponentSchema(definition.outputSchema);
      if (!validation.valid) {
        throw new ConfigurationError(
          `Component ${definition.id} has invalid output schema: ${validation.errors.join(', ')}`,
          {
            configKey: 'outputSchema',
            details: { componentId: definition.id, errors: validation.errors },
          }
        );
      }
    }

    // Compute derived ports and connection types
    const inputPorts = definition.inputSchema._def?.typeName === 'ZodObject'
      ? extractPorts(definition.inputSchema as z.ZodObject<any, any, any, any, any>)
      : [];

    const outputPorts = definition.outputSchema._def?.typeName === 'ZodObject'
      ? extractPorts(definition.outputSchema as z.ZodObject<any, any, any, any, any>)
      : [];

    const connectionTypes: Record<string, any> = {};
    for (const port of [...inputPorts, ...outputPorts]) {
      connectionTypes[port.id] = deriveConnectionType(
        (definition.inputSchema as any).shape?.[port.id] ??
        (definition.outputSchema as any).shape?.[port.id]
      );
    }

    this.components.set(definition.id, {
      definition: definition as AnyComponentDefinition,
      inputs: inputPorts,
      outputs: outputPorts,
      connectionTypes,
    });
  }

  get<I, O>(id: string): ComponentDefinition<I, O> | undefined {
    const cached = this.components.get(id);
    return cached?.definition as ComponentDefinition<I, O> | undefined;
  }

  getMetadata(id: string): CachedComponentMetadata | undefined {
    return this.components.get(id);
  }

  list(): Array<AnyComponentDefinition> {
    return Array.from(this.components.values()).map((c) => c.definition);
  }

  listMetadata(): Array<CachedComponentMetadata> {
    return Array.from(this.components.values());
  }

  has(id: string): boolean {
    return this.components.has(id);
  }

  clear(): void {
    this.components.clear();
  }
}

export const componentRegistry = new ComponentRegistry();
