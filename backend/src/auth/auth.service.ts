import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

import type { AuthConfig, AuthProvider as AuthProviderName } from '../config/auth.config';
import type { AuthContext } from './types';
import type { AuthProviderStrategy } from './providers/auth-provider.interface';
import { LocalAuthProvider } from './providers/local-auth.provider';
import { ClerkAuthProvider } from './providers/clerk-auth.provider';
import { PlatformContextClient } from '../platform/platform-context.client';
import type { PlatformConfig } from '../config/platform.config';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly provider: AuthProviderStrategy;

  constructor(
    private readonly configService: ConfigService,
    private readonly platformContextClient: PlatformContextClient,
  ) {
    this.provider = this.createProvider();
    this.logger.log(`Auth provider initialised: ${this.provider.name}`);
  }

  async authenticate(request: Request): Promise<AuthContext> {
    const serviceAuth = this.tryPlatformServiceAuth(request);
    if (serviceAuth) {
      return serviceAuth;
    }
    return this.provider.authenticate(request);
  }

  get providerName(): string {
    return this.provider.name;
  }

  private createProvider(): AuthProviderStrategy {
    const config = this.configService.get<AuthConfig>('auth');
    if (!config) {
      this.logger.warn('Auth config missing, defaulting to local provider');
      return new LocalAuthProvider({ apiKey: null, allowUnauthenticated: true });
    }

    const provider: AuthProviderName = config.provider;
    if (provider === 'clerk') {
      return new ClerkAuthProvider(config.clerk, this.platformContextClient);
    }

    return new LocalAuthProvider(config.local);
  }

  private tryPlatformServiceAuth(request: Request): AuthContext | null {
    const platform = this.configService.get<PlatformConfig>('platform');
    const expectedToken = platform?.serviceAccountToken;
    if (!expectedToken) {
      return null;
    }

    const headerToken = this.extractServiceToken(request);
    if (!headerToken || headerToken !== expectedToken) {
      return null;
    }

    const organizationId = this.extractOrganizationId(request);
    return {
      userId: 'platform-service',
      organizationId,
      roles: ['ADMIN'],
      isAuthenticated: true,
      provider: 'platform-service',
    };
  }

  private extractServiceToken(request: Request): string | null {
    const header =
      (request.headers['x-service-token'] as string | undefined) ??
      (request.headers.authorization as string | undefined) ??
      (request.headers.Authorization as string | undefined);

    if (!header) {
      return null;
    }

    if (header.includes(' ')) {
      const [scheme, token] = header.split(' ');
      if (scheme.toLowerCase() !== 'bearer') {
        return null;
      }
      return token.trim();
    }

    return header.trim();
  }

  private extractOrganizationId(request: Request): string | null {
    const orgHeader =
      (request.headers['x-organization-id'] as string | undefined) ??
      (request.headers['x-org-id'] as string | undefined);
    if (orgHeader && orgHeader.trim().length > 0) {
      return orgHeader.trim();
    }
    return null;
  }
}
