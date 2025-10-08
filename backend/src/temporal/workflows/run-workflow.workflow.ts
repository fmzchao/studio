import { proxyActivities, log } from '@temporalio/workflow';

// Import types from shared file (NOT from activities)
import type { RunWorkflowActivityInput, RunWorkflowActivityOutput } from '../types';

const activities = proxyActivities<{
  runWorkflow(input: RunWorkflowActivityInput): Promise<RunWorkflowActivityOutput>;
}>({
  startToCloseTimeout: '10 minutes',
  retry: {
    maximumAttempts: 1,
  },
});

export interface ShipSecWorkflowRunInput extends RunWorkflowActivityInput {}

export async function shipsecWorkflowRun(input: ShipSecWorkflowRunInput) {
  log.info('🚀 Workflow started', { runId: input.runId, workflowId: input.workflowId });
  
  try {
    log.info('📞 Calling runWorkflow activity');
    const result = await activities.runWorkflow(input);
    log.info('✅ Workflow completed successfully');
    return result;
  } catch (error) {
    log.error('❌ Workflow failed', { error });
    throw error;
  }
}
