import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

import type { AuthConfig, AuthProvider as AuthProviderName } from '../config/auth.config';
import type { AuthContext } from './types';
import type { AuthProviderStrategy } from './providers/auth-provider.interface';
import { LocalAuthProvider } from './providers/local-auth.provider';
import { ClerkAuthProvider } from './providers/clerk-auth.provider';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly provider: AuthProviderStrategy;

  constructor(private readonly configService: ConfigService) {
    this.provider = this.createProvider();
    this.logger.log(`Auth provider initialised: ${this.provider.name}`);
  }

  async authenticate(request: Request): Promise<AuthContext> {
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
      return new ClerkAuthProvider(config.clerk);
    }

    return new LocalAuthProvider(config.local);
  }
}
