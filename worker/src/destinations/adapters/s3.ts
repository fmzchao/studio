import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import type { DestinationAdapterRegistration, DestinationSaveInput, DestinationSaveResult } from '../registry';
import type { ExecutionContext } from '@shipsec/component-sdk';

interface S3CredentialConfig {
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
  region?: string;
  secretId?: string;
}

interface S3AdapterConfig {
  bucket: string;
  region?: string;
  objectKey?: string;
  pathPrefix?: string;
  endpoint?: string;
  forcePathStyle?: boolean;
  publicUrl?: string;
  credentials?: S3CredentialConfig;
}

async function resolveCredentials(config: S3AdapterConfig, context: ExecutionContext) {
  if (config.credentials?.secretId) {
    if (!context.secrets) {
      throw new Error('S3 destination requires the secrets service for managed credentials.');
    }
    const secret = await context.secrets.get(config.credentials.secretId);
    if (!secret) {
      throw new Error(`Secret ${config.credentials.secretId} was not found.`);
    }
    try {
      const parsed = JSON.parse(secret.value);
      return {
        accessKeyId: parsed.accessKeyId as string,
        secretAccessKey: parsed.secretAccessKey as string,
        sessionToken: parsed.sessionToken as string | undefined,
        region: (parsed.region as string | undefined) ?? config.region,
      };
    } catch (error) {
      throw new Error(
        error instanceof Error ? `Failed to parse AWS credentials secret: ${error.message}` : 'Secret value is not valid JSON.',
      );
    }
  }

  if (config.credentials?.accessKeyId && config.credentials?.secretAccessKey) {
    return {
      accessKeyId: config.credentials.accessKeyId,
      secretAccessKey: config.credentials.secretAccessKey,
      sessionToken: config.credentials.sessionToken,
      region: config.region,
    };
  }

  throw new Error('S3 destination requires credentials (either via secretId or inline access keys).');
}

function buildObjectKey(config: S3AdapterConfig, fileName: string) {
  if (config.objectKey) {
    return config.objectKey.replace(/^\/+/, '');
  }
  const prefix = config.pathPrefix?.replace(/^\/+/, '').replace(/\/+$/, '');
  return prefix ? `${prefix}/${fileName}` : fileName;
}

export const s3DestinationAdapter: DestinationAdapterRegistration = {
  id: 's3',
  label: 'Amazon S3',
  description: 'Upload artifacts to an S3 bucket (or S3-compatible storage).',
  parameters: [
    { id: 'bucket', label: 'Bucket', type: 'text', required: true },
    { id: 'region', label: 'Region', type: 'text' },
    { id: 'pathPrefix', label: 'Path prefix', type: 'text' },
    { id: 'objectKey', label: 'Explicit object key', type: 'text' },
    { id: 'endpoint', label: 'Custom endpoint', type: 'text' },
    { id: 'forcePathStyle', label: 'Force path style', type: 'boolean' },
    { id: 'publicUrl', label: 'Public URL prefix', type: 'text' },
    { id: 'credentials.secretId', label: 'Credential secret', type: 'secret' },
    { id: 'credentials.accessKeyId', label: 'Access key ID', type: 'text' },
    { id: 'credentials.secretAccessKey', label: 'Secret access key', type: 'text' },
    { id: 'credentials.sessionToken', label: 'Session token', type: 'text' },
  ],
  create(rawConfig) {
    return {
      async save(input: DestinationSaveInput, context): Promise<DestinationSaveResult> {
        const config = ensureS3Config(rawConfig);
        const credentials = await resolveCredentials(config, context);
        const key = buildObjectKey(config, input.fileName);

        const client = new S3Client({
          region: credentials.region ?? config.region ?? 'us-east-1',
          endpoint: config.endpoint,
          forcePathStyle: config.forcePathStyle,
          credentials: {
            accessKeyId: credentials.accessKeyId,
            secretAccessKey: credentials.secretAccessKey,
            sessionToken: credentials.sessionToken,
          },
        });

        context.logger.info(
          `[Destination:S3] Uploading ${input.fileName} (${input.buffer.byteLength} bytes) to s3://${config.bucket}/${key}`,
        );

        const command = new PutObjectCommand({
          Bucket: config.bucket,
          Key: key,
          Body: input.buffer,
          ContentType: input.mimeType,
          Metadata: {
            'shipsec-run-id': context.runId,
            'shipsec-component-ref': context.componentRef,
          },
        });

        const response = await client.send(command);
        const uri = `s3://${config.bucket}/${key}`;
        const publicUrl = config.publicUrl ? `${config.publicUrl.replace(/\/+$/, '')}/${key}` : undefined;

        return {
          remoteUploads: [
            {
              type: 's3',
              bucket: config.bucket,
              key,
              uri,
              url: publicUrl,
              region: credentials.region ?? config.region,
              etag: typeof response.ETag === 'string' ? response.ETag.replace(/"/g, '') : undefined,
            },
          ],
        };
      },
    };
  },
};

function ensureS3Config(config: unknown): S3AdapterConfig {
  if (!isS3Config(config)) {
    throw new Error('S3 destination requires a bucket name.');
  }
  return config;
}

function isS3Config(config: unknown): config is S3AdapterConfig {
  if (!config || typeof config !== 'object') {
    return false;
  }
  const candidate = config as Partial<S3AdapterConfig>;
  return typeof candidate.bucket === 'string' && candidate.bucket.length > 0;
}
