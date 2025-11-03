import { registerAs } from '@nestjs/config';

export interface PlatformConfig {
  baseUrl: string | null;
  serviceAccountToken: string | null;
  requestTimeoutMs: number;
}

function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const platformConfig = registerAs<PlatformConfig>('platform', () => ({
  baseUrl: process.env.PLATFORM_API_URL ?? null,
  serviceAccountToken: process.env.PLATFORM_SERVICE_TOKEN ?? null,
  requestTimeoutMs: parseNumber(process.env.PLATFORM_API_TIMEOUT_MS, 5000),
}));
