import { z } from 'zod';

export const WorkflowLinkSchema = z.object({
  workflowId: z.string().min(1, 'workflowId is required'),
  platformAgentId: z.string().min(1, 'platformAgentId is required'),
});

export type WorkflowLinkDto = z.infer<typeof WorkflowLinkSchema>;
