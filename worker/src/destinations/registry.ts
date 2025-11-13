import type { DestinationAdapterDefinition, DestinationConfig } from '@shipsec/shared';
import type { ArtifactDestination, ArtifactRemoteUpload } from '@shipsec/shared';
import type { ExecutionContext } from '@shipsec/component-sdk';

export interface DestinationSaveInput {
  fileName: string;
  mimeType: string;
  buffer: Buffer;
  metadata?: Record<string, unknown>;
}

export interface DestinationSaveResult {
  artifactId?: string;
  destinations?: ArtifactDestination[];
  remoteUploads?: ArtifactRemoteUpload[];
  metadata?: Record<string, unknown>;
}

export interface DestinationAdapter {
  save(input: DestinationSaveInput, context: ExecutionContext): Promise<DestinationSaveResult>;
}

export type DestinationAdapterFactory = (
  config: Record<string, unknown> | undefined,
) => DestinationAdapter;

export interface DestinationAdapterRegistration extends DestinationAdapterDefinition {
  create: DestinationAdapterFactory;
}

class DestinationRegistry {
  private adapters = new Map<string, DestinationAdapterRegistration>();

  register(registration: DestinationAdapterRegistration) {
    if (this.adapters.has(registration.id)) {
      throw new Error(`Destination adapter ${registration.id} is already registered`);
    }
    this.adapters.set(registration.id, registration);
  }

  create(config: DestinationConfig): DestinationAdapter {
    const registration = this.adapters.get(config.adapterId);
    if (!registration) {
      throw new Error(`Destination adapter ${config.adapterId} is not registered`);
    }
    return registration.create(config.config ?? {});
  }

  list(): DestinationAdapterRegistration[] {
    return Array.from(this.adapters.values());
  }

  get(id: string): DestinationAdapterRegistration | undefined {
    return this.adapters.get(id);
  }
}

export const destinationRegistry = new DestinationRegistry();

export function registerDestinationAdapter(registration: DestinationAdapterRegistration) {
  destinationRegistry.register(registration);
}

export function createDestinationAdapter(config: DestinationConfig): DestinationAdapter {
  return destinationRegistry.create(config);
}

export function listDestinationAdapters(): DestinationAdapterRegistration[] {
  return destinationRegistry.list();
}
