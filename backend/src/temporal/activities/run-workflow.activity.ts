import '../../components/register-default-components';

import { executeWorkflow } from '../workflow-runner';
import type { RunWorkflowActivityInput, RunWorkflowActivityOutput } from '../types';

export async function runWorkflowActivity(
  input: RunWorkflowActivityInput,
): Promise<RunWorkflowActivityOutput> {
  console.log(`🔧 [ACTIVITY] runWorkflow started for run: ${input.runId}`);
  console.log(`🔧 [ACTIVITY] Workflow: ${input.workflowId}, Actions: ${input.definition.actions.length}`);
  
  try {
    const result = await executeWorkflow(
      input.definition,
      {
        inputs: input.inputs,
      },
      {
        runId: input.runId,
      },
    );
    
    console.log(`✅ [ACTIVITY] runWorkflow completed for run: ${input.runId}`);
    return result;
  } catch (error) {
    console.error(`❌ [ACTIVITY] runWorkflow failed for run: ${input.runId}`, error);
    throw error;
  }
}
