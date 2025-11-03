import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import type { Request } from 'express';

import { AuthService } from './auth.service';
import type { AuthContext } from './types';

export interface RequestWithAuthContext extends Request {
  auth?: AuthContext;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const request = http.getRequest<RequestWithAuthContext>();
    if (!request) {
      return true;
    }

    request.auth = await this.authService.authenticate(request);
    return true;
  }
}
