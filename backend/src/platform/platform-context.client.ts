import { ConfigService } from '@nestjs/config';
import { Injectable, Logger } from '@nestjs/common';
import type { PlatformConfig } from '../config/platform.config';

export interface PlatformOrgMetadata {
  id: string;
  name: string;
  slug?: string | null;
  domain?: string | null;
}

export interface PlatformUserContext {
  userId: string;
  organizationId: string;
  roles: string[];
  organization?: PlatformOrgMetadata | null;
}

export interface PlatformWorkflowLink {
  workflowId: string;
  platformAgentId: string;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class PlatformContextClient {
  private readonly logger = new Logger(PlatformContextClient.name);
  private readonly baseUrl: string | null;
  private readonly token: string | null;
  private readonly timeoutMs: number;

  constructor(private readonly configService: ConfigService) {
    const config = this.configService.get<PlatformConfig>('platform');
    this.baseUrl = config?.baseUrl ?? null;
    this.token = config?.serviceAccountToken ?? null;
    this.timeoutMs = config?.requestTimeoutMs ?? 5000;
  }

  /**
   * Returns true when the client has enough configuration to call the platform.
   */
  get isConfigured(): boolean {
    return Boolean(this.baseUrl && this.token);
  }

  /**
   * Fetch enriched user/org context from the platform. Returns null when the client is not
   * configured or the platform cannot be reached.
   */
  async fetchUserContext(
    clerkUserId: string,
    organizationHint?: string | null,
  ): Promise<PlatformUserContext | null> {
    if (!this.isConfigured) {
      return null;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
      const response = await fetch(this.resolveUrl('/service/studio/context'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify({
          clerkUserId,
          organizationHint: organizationHint ?? null,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        this.logger.warn(
          `Platform context fetch failed (${response.status}): ${await response
            .text()
            .catch(() => '<no-body>')}`,
        );
        return null;
      }

      const payload = (await response.json()) as PlatformUserContext;
      return payload;
    } catch (error) {
      this.logger.warn(
        `Failed to fetch platform context for user ${clerkUserId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  private resolveUrl(path: string): string {
    if (!this.baseUrl) {
      throw new Error('Platform base URL not configured');
    }
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${this.baseUrl.replace(/\/$/, '')}${normalizedPath}`;
  }
}
