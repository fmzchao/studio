import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import { DRIZZLE_TOKEN } from '../database/database.module';
import {
  platformWorkflowLinksTable,
  type PlatformWorkflowLinkRecord,
} from '../database/schema';

interface UpsertLinkInput {
  workflowId: string;
  platformAgentId: string;
  organizationId?: string | null;
}

@Injectable()
export class PlatformWorkflowLinkRepository {
  constructor(
    @Inject(DRIZZLE_TOKEN)
    private readonly db: NodePgDatabase,
  ) {}

  async upsertLink(input: UpsertLinkInput): Promise<PlatformWorkflowLinkRecord> {
    const now = new Date();
    const [record] = await this.db
      .insert(platformWorkflowLinksTable)
      .values({
        workflowId: input.workflowId,
        platformAgentId: input.platformAgentId,
        organizationId: input.organizationId ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: platformWorkflowLinksTable.platformAgentId,
        set: {
          workflowId: input.workflowId,
          organizationId: input.organizationId ?? null,
          updatedAt: now,
        },
      })
      .returning();
    return record;
  }

  async findByPlatformAgentId(
    platformAgentId: string,
    organizationId?: string | null,
  ): Promise<PlatformWorkflowLinkRecord | undefined> {
    const condition = organizationId
      ? and(
          eq(platformWorkflowLinksTable.platformAgentId, platformAgentId),
          eq(platformWorkflowLinksTable.organizationId, organizationId),
        )
      : eq(platformWorkflowLinksTable.platformAgentId, platformAgentId);

    const [record] = await this.db
      .select()
      .from(platformWorkflowLinksTable)
      .where(condition)
      .limit(1);
    return record;
  }

  async removeLink(platformAgentId: string, organizationId?: string | null): Promise<void> {
    const condition = organizationId
      ? and(
          eq(platformWorkflowLinksTable.platformAgentId, platformAgentId),
          eq(platformWorkflowLinksTable.organizationId, organizationId),
        )
      : eq(platformWorkflowLinksTable.platformAgentId, platformAgentId);

    await this.db
      .delete(platformWorkflowLinksTable)
      .where(condition);
  }
}
