import { componentRegistry, extractPorts, type ComponentPortMetadata } from '@shipsec/component-sdk';

type RegisteredComponent = NonNullable<ReturnType<typeof componentRegistry.get>>;

/**
 * Masks values based on a list of secret port definitions.
 */
function maskSecretPorts(
  secretPorts: Array<{ id: string }>,
  data: unknown
): unknown {
  if (secretPorts.length === 0) {
    return data;
  }

  if (secretPorts.some((port) => port.id === '__self__')) {
    return '***';
  }

  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const clone = { ...(data as Record<string, unknown>) };
    for (const port of secretPorts) {
      if (Object.prototype.hasOwnProperty.call(clone, port.id)) {
        clone[port.id] = '***';
      }
    }
    return clone;
  }

  return '***';
}

/**
 * Identifies secret ports from a list of port definitions.
 */
function getSecretPorts(
  ports: ComponentPortMetadata[]
): Array<{ id: string }> {
  return ports.filter((port) => {
    const connType = port.connectionType;
    if (!connType) {
      return false;
    }
    if (connType.kind === 'primitive') {
      return connType.name === 'secret';
    }
    if (connType.kind === 'contract') {
      return Boolean(connType.credential);
    }
    return false;
  });
}

/**
 * Masks inputs containing sensitive information (secrets) based on component port schemas.
 */
export function maskSecretInputs(component: RegisteredComponent, input: unknown): unknown {
  const inputPorts = extractPorts(component.inputs);
  const secretPorts = getSecretPorts(inputPorts);
  return maskSecretPorts(secretPorts, input);
}

/**
 * Masks outputs containing sensitive information (secrets) based on component port schemas.
 */
export function maskSecretOutputs(component: RegisteredComponent, output: unknown): unknown {
  const outputPorts = extractPorts(component.outputs);
  const secretPorts = getSecretPorts(outputPorts);
    
  if (secretPorts.length === 0) {
    return output;
  }

  if (secretPorts.some((port) => port.id === '__self__')) {
    return '***';
  }

  if (output && typeof output === 'object' && !Array.isArray(output)) {
    const clone = { ...(output as Record<string, unknown>) };
    for (const port of secretPorts) {
      if (Object.prototype.hasOwnProperty.call(clone, port.id)) {
        clone[port.id] = '***';
      }
    }
    return clone;
  }

  return '***';
}

/**
 * Creates a lightweight summary of component output for trace events.
 * This avoids sending huge payloads over Kafka.
 */
export function createLightweightSummary(component: RegisteredComponent, output: unknown): Record<string, unknown> {
  const summary: Record<string, unknown> = {};

  if (output && typeof output === 'object' && !Array.isArray(output)) {
    const obj = output as Record<string, unknown>;
    
    // Copy summary field if it exists
    if (obj.summary) {
      summary.summary = obj.summary;
    }

    // Capture array lengths (common for findings)
    for (const [key, value] of Object.entries(obj)) {
      if (Array.isArray(value)) {
        summary[`${key}Count`] = value.length;
      }
    }

    // Add explicit truncated flag
    summary._truncated = true;
  }

  return summary;
}
