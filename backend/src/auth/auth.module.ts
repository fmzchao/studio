import { Global, Module } from '@nestjs/common';

import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import { RolesGuard } from './roles.guard';
import { PlatformContextClient } from '../platform/platform-context.client';

@Global()
@Module({
  providers: [AuthService, AuthGuard, RolesGuard, PlatformContextClient],
  exports: [AuthService, AuthGuard, RolesGuard],
})
export class AuthModule {}
