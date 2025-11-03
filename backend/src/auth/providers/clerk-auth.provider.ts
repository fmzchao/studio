import type { Request } from 'express';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';

import type { ClerkAuthConfig } from '../../config/auth.config';
import type { AuthContext } from '../types';
import type { AuthProviderStrategy } from './auth-provider.interface';

@Injectable()
export class ClerkAuthProvider implements AuthProviderStrategy {
  readonly name = 'clerk';

  constructor(private readonly config: ClerkAuthConfig) {}

  async authenticate(_request: Request): Promise<AuthContext> {
    throw new ServiceUnavailableException({
      message: 'Clerk auth provider is not yet implemented',
      provider: this.name,
      config: {
        publishableKey: Boolean(this.config.publishableKey),
        secretKey: Boolean(this.config.secretKey),
      },
    });
  }
}
