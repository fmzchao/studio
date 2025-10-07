import { z } from 'zod'
import { NodeSchema } from './node'
import { EdgeSchema } from './edge'

/**
 * Workflow metadata schema (for list endpoint)
 * Contains summary information without nodes/edges
 */
export const WorkflowMetadataSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, 'Workflow name is required'),
  description: z.string().optional(),
  nodeCount: z.number().int().min(0),
  edgeCount: z.number().int().min(0),
  lastRun: z.string().datetime().nullable(),
  runCount: z.number().int().min(0),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type WorkflowMetadata = z.infer<typeof WorkflowMetadataSchema>

/**
 * Complete workflow schema (for detail endpoint)
 * Contains full nodes and edges data
 */
export const WorkflowSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, 'Workflow name is required'),
  description: z.string().optional(),
  nodes: z.array(NodeSchema),
  edges: z.array(EdgeSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type Workflow = z.infer<typeof WorkflowSchema>

export const CreateWorkflowSchema = WorkflowSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})

export type CreateWorkflow = z.infer<typeof CreateWorkflowSchema>

export const UpdateWorkflowSchema = WorkflowSchema.partial().required({
  id: true,
})

export type UpdateWorkflow = z.infer<typeof UpdateWorkflowSchema>