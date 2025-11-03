import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';
import { PlatformController } from './platform.controller';
import { PlatformBridgeService } from './platform-bridge.service';
import { PlatformWorkflowLinkRepository } from './platform-workflow-link.repository';

@Module({
  imports: [DatabaseModule],
  controllers: [PlatformController],
  providers: [PlatformBridgeService, PlatformWorkflowLinkRepository],
  exports: [PlatformBridgeService, PlatformWorkflowLinkRepository],
})
export class PlatformModule {}
