import type { Request } from 'express';
import { Injectable, Logger, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { verifyToken } from '@clerk/backend';
import type { JwtPayload } from '@clerk/types';

import type { ClerkAuthConfig } from '../../config/auth.config';
import type { AuthContext, AuthRole } from '../types';
import type { AuthProviderStrategy } from './auth-provider.interface';
import { PlatformContextClient, type PlatformUserContext } from '../../platform/platform-context.client';

type ClerkJwt = JwtPayload & {
  org_id?: string;
  organization_id?: string;
  org_role?: string;
  o?: { id?: string };
};

@Injectable()
export class ClerkAuthProvider implements AuthProviderStrategy {
  readonly name = 'clerk';
  private readonly logger = new Logger(ClerkAuthProvider.name);

  constructor(
    private readonly config: ClerkAuthConfig,
    private readonly platformClient: PlatformContextClient,
  ) {}

  async authenticate(request: Request): Promise<AuthContext> {
    if (!this.config.secretKey) {
      throw new ServiceUnavailableException(
        'Clerk auth provider requires CLERK_SECRET_KEY to be configured',
      );
    }

    const token = this.extractBearerToken(request);
    if (!token) {
      throw new UnauthorizedException('Missing Clerk bearer token');
    }

    const payload = await this.verifyClerkToken(token);

    const clerkUserId = payload.sub;
    const organizationHint = this.resolveOrganizationId(payload);

    const platformContext = await this.platformClient.fetchUserContext(
      clerkUserId,
      organizationHint,
    );

    const organizationId =
      platformContext?.organizationId ?? organizationHint ?? null;
    const roles = this.resolveRoles(payload, platformContext);

    return {
      userId: clerkUserId,
      organizationId,
      roles,
      isAuthenticated: true,
      provider: this.name,
    };
  }

  private async verifyClerkToken(token: string): Promise<ClerkJwt> {
    try {
      return (await verifyToken(token, {
        secretKey: this.config.secretKey!,
      })) as ClerkJwt;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Clerk token verification failed: ${message}`);
      throw new UnauthorizedException('Invalid Clerk token');
    }
  }

  private extractBearerToken(request: Request): string | null {
    const header =
      request.headers.authorization ??
      (request.headers.Authorization as string | undefined);
    if (!header) {
      return null;
    }
    const [scheme, token] = header.split(' ');
    if (!scheme || !token) {
      return null;
    }
    return scheme.toLowerCase() === 'bearer' ? token.trim() : null;
  }

  private resolveOrganizationId(payload: ClerkJwt): string | null {
    if (payload.o?.id) {
      return payload.o.id;
    }
    if (payload.org_id) {
      return payload.org_id;
    }
    if (payload.organization_id) {
      return payload.organization_id;
    }
    return null;
  }

  private resolveRoles(
    payload: ClerkJwt,
    platformContext: PlatformUserContext | null,
  ): AuthRole[] {
    if (platformContext?.roles?.length) {
      const mapped = platformContext.roles
        .map((role) => role.toUpperCase())
        .filter((role): role is AuthRole => role === 'ADMIN' || role === 'MEMBER');
      if (mapped.length > 0) {
        return mapped;
      }
    }

    const clerkRole = payload.org_role?.toUpperCase();
    if (clerkRole === 'ADMIN') {
      return ['ADMIN'];
    }
    return ['MEMBER'];
  }
}
