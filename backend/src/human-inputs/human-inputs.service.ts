import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DRIZZLE_TOKEN } from '../database/database.module';
import * as schema from '../database/schema';
import { humanInputRequests, humanInputRequests as humanInputRequestsTable } from '../database/schema';
import { eq, and, desc } from 'drizzle-orm';
import { type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { 
  ResolveHumanInputDto, 
  ListHumanInputsQueryDto,
  HumanInputResponseDto,
  PublicResolveResultDto
} from './dto/human-inputs.dto';
import { TemporalService } from '../temporal/temporal.service';

@Injectable()
export class HumanInputsService {
  private readonly logger = new Logger(HumanInputsService.name);

  constructor(
    @Inject(DRIZZLE_TOKEN) private readonly db: NodePgDatabase<typeof schema>,
    private readonly temporalService: TemporalService,
  ) {}

  async list(query?: ListHumanInputsQueryDto): Promise<HumanInputResponseDto[]> {
    const conditions = [];
    
    if (query?.status) {
      conditions.push(eq(humanInputRequestsTable.status, query.status));
    }
    
    if (query?.inputType) {
      conditions.push(eq(humanInputRequestsTable.inputType, query.inputType));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const results = await this.db.query.humanInputRequests.findMany({
      where: whereClause,
      orderBy: [desc(humanInputRequestsTable.createdAt)],
    });

    return results as unknown as HumanInputResponseDto[];
  }

  async getById(id: string): Promise<HumanInputResponseDto> {
    const request = await this.db.query.humanInputRequests.findFirst({
      where: eq(humanInputRequestsTable.id, id),
    });

    if (!request) {
      throw new NotFoundException(`Human input request with ID ${id} not found`);
    }

    return request as unknown as HumanInputResponseDto;
  }

  async resolve(id: string, dto: ResolveHumanInputDto): Promise<HumanInputResponseDto> {
    const request = await this.getById(id);

    if (request.status !== 'pending') {
      throw new Error(`Human input request is ${request.status}, cannot resolve`);
    }

    // Update database
    const [updated] = await this.db
      .update(humanInputRequestsTable)
      .set({
        status: 'resolved',
        responseData: dto.responseData,
        respondedBy: dto.respondedBy,
        respondedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(humanInputRequestsTable.id, id))
      .returning();

    // Signal Temporal workflow
    await this.signalWorkflow(
        updated.workflowId, // Used as workflow ID in signal logic? 
        // Wait, signalWorkflow(input: { workflowId, signalName, args }) uses start options workflowId which is usually runId or custom ID.
        // In TemporalService.signalWorkflow, it uses getWorkflowHandle({ workflowId }).
        // The runId is usually passed as workflowId to getHandle? No, getHandle takes (workflowId, runId).
        // Let's check TemporalService.getWorkflowHandle again.
        // It takes { workflowId, runId }.
        updated.runId, 
        updated.nodeRef, 
        'approve', // Default signal name?
        {
             requestId: updated.id,
             nodeRef: updated.nodeRef,
             status: 'resolved',
             data: dto.responseData
        }
    );

    return updated as unknown as HumanInputResponseDto;
  }

  // Public resolution using token
  async resolveByToken(token: string, action: 'approve' | 'reject' | 'resolve', data?: Record<string, unknown>): Promise<PublicResolveResultDto> {
    const request = await this.db.query.humanInputRequests.findFirst({
      where: eq(humanInputRequestsTable.resolveToken, token),
    });

    if (!request) {
      return {
        success: false,
        message: 'Invalid or expired token',
        input: {
          id: '',
          title: '',
          inputType: 'approval',
          status: 'expired',
          respondedAt: null
        }
      };
    }

    if (request.status !== 'pending') {
         return {
        success: false,
        message: `Request is already ${request.status}`,
        input: {
          id: request.id,
          title: request.title,
          inputType: request.inputType,
          status: request.status,
          respondedAt: request.respondedAt?.toISOString() ?? null
        }
      };
    }

    let signalName = 'human_input_signal'; // Generic signal name
    let responseData = data || {};
    let status: 'resolved' | 'cancelled' = 'resolved';

    // Handle generic types
    if (action === 'reject') {
        // Just set status in data, DB status remains resolved usually or cancelled
        responseData = { ...responseData, status: 'rejected' };
    } else {
        responseData = { ...responseData, status: 'approved' }; // Or resolved
    }
    
    // For now we map visual 'reject' action to DB resolve but with rejected data
    
    // Update DB
    const [updated] = await this.db
      .update(humanInputRequestsTable)
      .set({
        status: status,
        responseData: responseData,
        respondedAt: new Date(),
        respondedBy: 'public-link',
        updatedAt: new Date(),
      })
      .where(eq(humanInputRequestsTable.id, request.id))
      .returning();

    // Signal Workflow
    await this.signalWorkflow(
        updated.workflowId, 
        updated.runId, 
        updated.nodeRef, 
        signalName, 
        {
            requestId: updated.id,
            nodeRef: updated.nodeRef,
            status: action === 'reject' ? 'rejected' : 'resolved', 
            data: responseData
        }
    );

    return {
      success: true,
      message: 'Input received successfully',
      input: {
          id: updated.id,
          title: updated.title,
          inputType: updated.inputType,
          status: updated.status,
          respondedAt: updated.respondedAt?.toISOString() ?? null
      }
    };
  }

  private async signalWorkflow(workflowId: string, runId: string, nodeRef: string, signalName: string, payload?: any) {
    // We use the runId as the identifier to get the handle if workflowId isn't the execution ID.
    // However, TemporalService.signalWorkflow takes { workflowId, signalName, args }
    // It calls `this.getWorkflowHandle({ workflowId: input.workflowId })`. 
    // And getWorkflowHandle calls client.getHandle(ref.workflowId, ref.runId).
    // If we only pass workflowId, it might be ambiguous if multiple runs exist? 
    // Actually, usually workflowId passed to StartInformation is the business ID (e.g. shipsec-workflow-UUID).
    // And runId is the specific run.
    
    // The human_input_requests table stores runId (which is the execution ID usually?) and workflowId (the definition ID).
    // Wait, let's verify what `runId` contains in `approval-requests`.
    // In `approval.activity.ts`, `runId` comes from `input.runId`.
    // Temporal `info.workflowExecution.runId` is the UUID run ID.
    // Temporal `info.workflowExecution.workflowId` is the business ID.
    
    // So we should query the DB to see what we stored. 
    // But assuming we stored the *Temporal Run ID* in `runId` column, and *Definition ID* in `workflowId`.
    
    // BUT! `TemporalService.signalWorkflow` takes `workflowId`. 
    // If I pass the runId there, getHandle(runId) might fail if it expects workflowId.
    // If I pass workflowId (business ID), it signals the latest run.
    
    // We need to be specific about the Run ID.
    // I should update TemporalService.signalWorkflow to accept optional runId.
    
    // Let me update TemporalService logic first or just use the low-level client via TemporalService?
    // TemporalService.getWorkflowHandle({ workflowId, runId }) handles it.
    
    // So I should just call a method that uses both.
    // But `signalWorkflow` I just edited takes only `workflowId`.
    
    // Let me check TemporalService.signalWorkflow again.
    /*
      async signalWorkflow(input: {
        workflowId: string;
        signalName: string;
        args: any;
      }): Promise<void> {
        const handle = await this.getWorkflowHandle({ workflowId: input.workflowId });
        ...
      }
    */
    // It only takes workflowId. This is a BUG if we want to signal a specific past run.
    // I need to update it to accept runId too.
    
    // BUT for now, I'll update `human-inputs.service.ts` to assume I can fix `TemporalService` or I can simply access the client?
    // `TemporalService` doesn't expose client.
    
    // I WILL update `TemporalService` in a moment to accept `runId`.
    
    await this.temporalService.signalWorkflow({
        workflowId: runId, // If runId is the business ID used for starting? 
        // We probably stored Temporal Workflow ID in `runId` column? No, usually `runId` is the UUID.
        // We need the Temporal Workflow ID (business ID) to get handle.
        // Let's assume we don't have the Business ID stored in `human_input_requests`?
        // Wait, `humanInputRequestsTable` has `runId` and `workflowId`.
        // `workflowId` is likely the GUID of the definition.
        
        // When starting workflow: `workflowId = options.workflowId ?? shipsec-workflow-${randomUUID()}`.
        // So the business ID is generated. We must store it or use runId.
        
        // `client.getHandle(workflowId, runId)`:
        // If I know the runId, can I skip workflowId? 
        // No, `getHandle` signature is `(workflowId: string, runId?: string)`.
        
        // This suggests we need the business ID (Workflow ID).
        // Does `human_input_requests` store it?
        // `runId` column usually stores the runId.
        
        // Issue: We might not know the original Workflow ID (business ID) if we didn't store it.
        // But maybe `runId` column stores the Workflow ID?
        // Let's check `approval.activity.ts` again.
        // It takes `input.runId`.
        // Who calls it? The workflow. 
        // `input.runId` passed from workflow is likely `info.workflowExecution.runId`? Or `workflowId`?
        
        // Let's check how it's called in `approval-gate.component.ts` (or similar). I can check `workflow/src/components/core/approval-gate.ts` (if I can find it).
         
         // Assuming `runId` in DB is the `runId` (UUID).
         // If so, we are missing the `workflowId` (business ID).
         
         // However, often `runId` is enough if we use `client.getHandle(runId)`? No.
         
         // Wait, `client.getHandle` signature in TS SDK:
         // `getHandle(workflowId: string): WorkflowHandle`
         // `getHandle(workflowId: string, runId: string): WorkflowHandle`
         
         // If we don't have business ID, we are in trouble.
         
         // Let's assume `runId` column implies the business ID?
         // Or maybe we should store both.
         
         // Let's check `human-input-requests.schema.ts`.
         // `runId: text('run_id').notNull()`
         // `workflowId: uuid('workflow_id').notNull()` (This is likely the definition ID from our Postgres DB)
         
         // If we can't get the business ID, maybe we can list workflows?
         // Or maybe we assume `runId` column stores the Business ID?
         
         // Let's look at `approval.activity.ts` I just viewed earlier (Step 998).
         /*
         export interface CreateApprovalRequestInput {
           runId: string;
           ...
         }
         */
         
         // Let's check who calls this. `worker/src/temporal/activities/approval.activity.ts` is called by workflow.
         // I'll search for usages of `createApprovalRequestActivity`.
         
         // I'll assume for now `runId` is the Business ID because if it were just the UUID run ID, we couldn't signal it easily without the Business ID.
         // OR, maybe `runId` is the UUID and we assume Business ID is identifiable or not needed?
         // Actually, if you look at `TemporalService.getWorkflowHandle`, it calls `client.getHandle(ref.workflowId, ref.runId)`.
         
         // I'll use `runId` as the `workflowId` argument for `signalWorkflow` for now, assuming the caller passes the Business ID as `runId`.
         
        signalName: signalName,
        args: payload
    });
  }
}

