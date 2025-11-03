import { Injectable, NotFoundException } from '@nestjs/common';

import { PlatformWorkflowLinkRepository } from './platform-workflow-link.repository';

export interface UpsertLinkDto {
  workflowId: string;
  platformAgentId: string;
}

@Injectable()
export class PlatformBridgeService {
  constructor(private readonly linkRepository: PlatformWorkflowLinkRepository) {}

  async linkWorkflow(input: UpsertLinkDto, organizationId: string | null) {
    const record = await this.linkRepository.upsertLink({
      workflowId: input.workflowId,
      platformAgentId: input.platformAgentId,
      organizationId,
    });
    return record;
  }

  async getLink(platformAgentId: string, organizationId: string | null) {
    const record = await this.linkRepository.findByPlatformAgentId(platformAgentId, organizationId);
    if (!record) {
      throw new NotFoundException('Workflow link not found');
    }
    return record;
  }

  async unlink(platformAgentId: string, organizationId: string | null): Promise<void> {
    await this.linkRepository.removeLink(platformAgentId, organizationId ?? undefined);
  }
}
