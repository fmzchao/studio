import { z } from 'zod';
import { componentRegistry, ComponentDefinition, port } from '@shipsec/component-sdk';
import { DestinationConfigSchema, type DestinationConfig } from '@shipsec/shared';

const credentialObjectSchema = z.object({
  accessKeyId: z.string(),
  secretAccessKey: z.string(),
  sessionToken: z.string().optional(),
  region: z.string().optional(),
});

const credentialsInputSchema = z.union([credentialObjectSchema, z.string().min(1)]);

const inputSchema = z.object({
  bucket: z.string().min(1, 'Bucket is required'),
  region: z.string().optional(),
  pathPrefix: z.string().optional(),
  objectKey: z.string().optional(),
  endpoint: z.string().optional(),
  forcePathStyle: z.boolean().default(false),
  publicUrl: z.string().optional(),
  credentials: credentialsInputSchema,
  label: z.string().optional(),
  description: z.string().optional(),
});

type Input = z.infer<typeof inputSchema>;

const outputSchema = z.object({
  destination: DestinationConfigSchema,
});

type Output = z.infer<typeof outputSchema>;

const definition: ComponentDefinition<Input, Output> = {
  id: 'core.destination.s3',
  label: 'S3 Destination',
  category: 'output',
  runner: { kind: 'inline' },
  inputSchema,
  outputSchema,
  docs: 'Produces a destination configuration that uploads files to an S3 bucket (or compatible storage).',
  metadata: {
    slug: 'destination-s3',
    version: '1.0.0',
    type: 'process',
    category: 'output',
    description: 'Configure uploads to S3 buckets for downstream writer components.',
    icon: 'CloudUpload',
    inputs: [
      {
        id: 'credentials',
        label: 'AWS credentials (JSON)',
        dataType: port.secret(),
        required: true,
        description:
          'Connect a secret or credential provider that outputs a JSON object with accessKeyId, secretAccessKey, (optional) sessionToken + region.',
      },
    ],
    outputs: [
      {
        id: 'destination',
        label: 'Destination',
        dataType: port.contract('destination.writer'),
        description: 'Connect to writer components to upload artifacts to S3.',
      },
    ],
    parameters: [
      { id: 'bucket', label: 'Bucket', type: 'text', required: true },
      { id: 'region', label: 'Region', type: 'text' },
      { id: 'pathPrefix', label: 'Path prefix', type: 'text' },
      { id: 'objectKey', label: 'Explicit object key', type: 'text' },
      { id: 'endpoint', label: 'Custom endpoint', type: 'text' },
      { id: 'forcePathStyle', label: 'Force path style', type: 'boolean', default: false },
      { id: 'publicUrl', label: 'Public URL prefix', type: 'text' },
      { id: 'label', label: 'Label override', type: 'text' },
      { id: 'description', label: 'Description', type: 'textarea' },
    ],
  },
  async execute(params): Promise<Output> {
    const credentials = normalizeCredentials(params.credentials);
    const destination: DestinationConfig = {
      adapterId: 's3',
      config: {
        bucket: params.bucket,
        region: params.region,
        pathPrefix: params.pathPrefix,
        objectKey: params.objectKey,
        endpoint: params.endpoint,
        forcePathStyle: params.forcePathStyle,
        publicUrl: params.publicUrl,
        credentials,
      },
      metadata: {
        label: params.label,
        description: params.description,
      },
    };

    return { destination };
  },
};

componentRegistry.register(definition);

function normalizeCredentials(input: z.infer<typeof credentialsInputSchema>) {
  if (typeof input === 'string') {
    try {
      const parsed = JSON.parse(input);
      return credentialObjectSchema.parse(parsed);
    } catch (error) {
      throw new Error(
        error instanceof Error
          ? `Failed to parse AWS credentials JSON: ${error.message}`
          : 'AWS credentials input must be valid JSON.',
      );
    }
  }
  return credentialObjectSchema.parse(input);
}
