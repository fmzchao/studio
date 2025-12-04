import { Inject, Injectable } from '@nestjs/common';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import { DRIZZLE_TOKEN } from '../database/database.module';
import { agentTraceEventsTable } from '../database/schema';

export interface AgentTraceEventInput {
  agentRunId: string;
  workflowRunId: string;
  nodeRef: string;
  sequence: number;
  timestamp: string;
  part: Record<string, unknown>;
}

@Injectable()
export class AgentTraceRepository {
  constructor(
    @Inject(DRIZZLE_TOKEN)
    private readonly db: NodePgDatabase,
  ) {}

  async append(event: AgentTraceEventInput): Promise<void> {
    await this.db.insert(agentTraceEventsTable).values({
      agentRunId: event.agentRunId,
      workflowRunId: event.workflowRunId,
      nodeRef: event.nodeRef,
      sequence: event.sequence,
      timestamp: new Date(event.timestamp),
      partType: typeof event.part?.type === 'string' ? String(event.part.type) : 'data',
      payload: event.part,
    });
  }
}
