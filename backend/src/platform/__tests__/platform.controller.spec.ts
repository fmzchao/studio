import { describe, expect, it, vi } from 'bun:test';
import { ForbiddenException } from '@nestjs/common';

import { PlatformController } from '../platform.controller';

const organizationId = 'org-123';

describe('PlatformController', () => {
  const service = {
    linkWorkflow: vi.fn().mockImplementation(async (input, org) => ({
      id: 'link-1',
      workflowId: input.workflowId,
      platformAgentId: input.platformAgentId,
      organizationId: org,
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T00:00:00Z'),
    })),
    getLink: vi.fn().mockResolvedValue({
      id: 'link-1',
      workflowId: 'wf-123',
      platformAgentId: 'agent-1',
      organizationId,
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T00:00:00Z'),
    }),
    unlink: vi.fn().mockResolvedValue(undefined),
  };

  const controller = new PlatformController(service as any);

  it('rejects non service providers', async () => {
    await expect(
      controller.linkWorkflow(
        { provider: 'local', roles: ['ADMIN'], userId: 'user', organizationId, isAuthenticated: true },
        { workflowId: 'wf-1', platformAgentId: 'agent-1' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('links workflow for platform service', async () => {
    const result = await controller.linkWorkflow(
      {
        provider: 'platform-service',
        roles: ['ADMIN'],
        userId: 'platform',
        organizationId,
        isAuthenticated: true,
      },
      { workflowId: 'wf-123', platformAgentId: 'agent-1' },
    );

    expect(result.workflowId).toBe('wf-123');
    expect(result.platformAgentId).toBe('agent-1');
    expect(service.linkWorkflow).toHaveBeenCalledWith(
      { workflowId: 'wf-123', platformAgentId: 'agent-1' },
      organizationId,
    );
  });

  it('unlinks workflow for platform service token', async () => {
    await controller.unlink(
      {
        provider: 'platform-service',
        roles: ['ADMIN'],
        userId: 'platform',
        organizationId,
        isAuthenticated: true,
      },
      'agent-1',
    );

    expect(service.unlink).toHaveBeenCalledWith('agent-1', organizationId);
  });
});
