import { Body, Controller, Delete, ForbiddenException, Get, Param, Post } from '@nestjs/common';
import { ZodValidationPipe } from 'nestjs-zod';

import { PlatformBridgeService } from './platform-bridge.service';
import { WorkflowLinkSchema } from './dto/workflow-link.dto';
import { CurrentAuth } from '../auth/auth-context.decorator';
import type { AuthContext } from '../auth/types';
import type { WorkflowLinkDto } from './dto/workflow-link.dto';

@Controller('service/studio')
export class PlatformController {
  constructor(private readonly bridgeService: PlatformBridgeService) {}

  @Post('workflows/link')
  async linkWorkflow(
    @CurrentAuth() auth: AuthContext | null,
    @Body(new ZodValidationPipe(WorkflowLinkSchema)) body: WorkflowLinkDto,
  ) {
    this.ensurePlatformService(auth);
    const organizationId = this.requireOrganizationId(auth);
    const record = await this.bridgeService.linkWorkflow(body, organizationId);
    return {
      id: record.id,
      workflowId: record.workflowId,
      platformAgentId: record.platformAgentId,
      organizationId: record.organizationId,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  @Get('workflows/link/:platformAgentId')
  async getLink(
    @CurrentAuth() auth: AuthContext | null,
    @Param('platformAgentId') platformAgentId: string,
  ) {
    this.ensurePlatformService(auth);
    const organizationId = this.requireOrganizationId(auth);
    const record = await this.bridgeService.getLink(platformAgentId, organizationId);
    return {
      id: record.id,
      workflowId: record.workflowId,
      platformAgentId: record.platformAgentId,
      organizationId: record.organizationId,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  @Delete('workflows/link/:platformAgentId')
  async unlink(
    @CurrentAuth() auth: AuthContext | null,
    @Param('platformAgentId') platformAgentId: string,
  ) {
    this.ensurePlatformService(auth);
    const organizationId = this.requireOrganizationId(auth);
    await this.bridgeService.unlink(platformAgentId, organizationId);
    return { status: 'deleted', platformAgentId };
  }

  private ensurePlatformService(auth: AuthContext | null) {
    if (auth?.provider !== 'platform-service') {
      throw new ForbiddenException('Platform service token required');
    }
  }

  private requireOrganizationId(auth: AuthContext | null): string {
    if (!auth?.organizationId) {
      throw new ForbiddenException('Organization context required');
    }
    return auth.organizationId;
  }
}
