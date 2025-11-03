import { createShipSecClient, type components } from '@shipsec/backend-client'
import { useAuthStore } from '@/store/authStore'

// Direct type imports from backend client
type WorkflowResponseDto = components['schemas']['WorkflowResponseDto']
type CreateWorkflowRequestDto = components['schemas']['CreateWorkflowRequestDto']
type UpdateWorkflowRequestDto = components['schemas']['UpdateWorkflowRequestDto']
type SecretSummaryResponse = components['schemas']['SecretSummaryResponse']
type SecretValueResponse = components['schemas']['SecretValueResponse']
type CreateSecretDto = components['schemas']['CreateSecretDto']
type RotateSecretDto = components['schemas']['RotateSecretDto']
type UpdateSecretDto = components['schemas']['UpdateSecretDto']

/**
 * API Client Configuration
 */
type RuntimeImportMeta = ImportMeta & {
  env?: Record<string, string | undefined>
}

function resolveApiBaseUrl() {
  const metaEnv = (import.meta as RuntimeImportMeta).env
  if (metaEnv?.VITE_API_URL && metaEnv.VITE_API_URL.trim().length > 0) {
    return metaEnv.VITE_API_URL
  }

  if (typeof process !== 'undefined') {
    const nodeEnv = (process.env ?? {}).VITE_API_URL
    if (nodeEnv && nodeEnv.trim().length > 0) {
      return nodeEnv
    }
  }

  return 'http://localhost:3211'
}

export const API_BASE_URL = resolveApiBaseUrl()

// Create type-safe API client
const apiClient = createShipSecClient({
  baseUrl: API_BASE_URL,
  middleware: {
  async onRequest({ request }) {
    const { token, organizationId } = useAuthStore.getState()

    if (token && token.trim().length > 0) {
      const headerValue = token.startsWith('Bearer ') ? token : `Bearer ${token}`
      request.headers.set('Authorization', headerValue)
    }

    if (organizationId && organizationId.trim().length > 0) {
      request.headers.set('X-Organization-Id', organizationId)
    }

    if (!request.headers.has('Content-Type')) {
      request.headers.set('Content-Type', 'application/json')
    }

    return request
  },
  },
})

/**
 * API Service
 * Simple wrapper around the backend API client
 */
export const api = {
  workflows: {
    list: async (): Promise<WorkflowResponseDto[]> => {
      const response = await apiClient.listWorkflows()
      if (response.error) throw new Error('Failed to fetch workflows')
      return response.data || []
    },

    get: async (id: string): Promise<WorkflowResponseDto> => {
      const response = await apiClient.getWorkflow(id)
      if (response.error) throw new Error('Failed to fetch workflow')
      if (!response.data) throw new Error('Workflow not found')
      return response.data
    },

    create: async (workflow: CreateWorkflowRequestDto): Promise<WorkflowResponseDto> => {
      const response = await apiClient.createWorkflow(workflow)
      if (response.error) throw new Error('Failed to create workflow')
      if (!response.data) throw new Error('Workflow creation failed')
      return response.data
    },

    update: async (id: string, workflow: UpdateWorkflowRequestDto): Promise<WorkflowResponseDto> => {
      const response = await apiClient.updateWorkflow(id, workflow)
      if (response.error) throw new Error('Failed to update workflow')
      if (!response.data) throw new Error('Workflow update failed')
      return response.data
    },

    delete: async (id: string): Promise<void> => {
      const response = await apiClient.deleteWorkflow(id)
      if (response.error) throw new Error('Failed to delete workflow')
    },

    commit: async (id: string) => {
      const response: any = await apiClient.commitWorkflow(id)
      if (response.error) {
        const message = response.error?.message || 'Failed to commit workflow'
        throw new Error(message)
      }
      return response.data
    },

    run: async (id: string, body?: { inputs?: Record<string, unknown> }) => {
      const response: any = await apiClient.runWorkflow(id, body)
      if (response.error) {
        const message = response.error?.message || 'Failed to run workflow'
        throw new Error(message)
      }
      return response.data
    },
  },

  components: {
    list: async () => {
      const response = await apiClient.listComponents()
      if (response.error) throw new Error('Failed to fetch components')
      return response.data || []
    },

    get: async (slug: string) => {
      const response = await apiClient.getComponent(slug)
      if (response.error) throw new Error('Failed to fetch component')
      return response.data
    },
  },

  secrets: {
    list: async (): Promise<SecretSummaryResponse[]> => {
      const response = await apiClient.listSecrets()
      if (response.error) throw new Error('Failed to fetch secrets')
      return response.data || []
    },

    create: async (input: CreateSecretDto): Promise<SecretSummaryResponse> => {
      const response = await apiClient.createSecret(input)
      if (response.error) throw new Error('Failed to create secret')
      if (!response.data) throw new Error('Secret creation failed')
      return response.data
    },

    update: async (id: string, input: UpdateSecretDto): Promise<SecretSummaryResponse> => {
      const response = await apiClient.updateSecret(id, input)
      if (response.error) throw new Error('Failed to update secret')
      if (!response.data) throw new Error('Secret update failed')
      return response.data
    },

    rotate: async (id: string, input: RotateSecretDto): Promise<SecretSummaryResponse> => {
      const response = await apiClient.rotateSecret(id, input)
      if (response.error) throw new Error('Failed to rotate secret')
      if (!response.data) throw new Error('Secret rotation failed')
      return response.data
    },

    delete: async (id: string): Promise<void> => {
      const response = await apiClient.deleteSecret(id)
      if (response.error) throw new Error('Failed to delete secret')
    },

    getValue: async (id: string, version?: number): Promise<SecretValueResponse> => {
      const response = await apiClient.getSecretValue(id, version)
      if (response.error) throw new Error('Failed to fetch secret value')
      if (!response.data) throw new Error('Secret value not found')
      return response.data
    },
  },

  executions: {
    start: async (
      workflowId: string,
      inputs?: Record<string, unknown>
    ): Promise<{ executionId: string }> => {
      const payload = inputs ? { inputs } : undefined
      const response = await apiClient.runWorkflow(workflowId, payload)
      if (response.error) throw new Error('Failed to start execution')
      return { executionId: (response.data as any)?.runId || '' }
    },

    getStatus: async (executionId: string) => {
      const response = await apiClient.getWorkflowRunStatus(executionId)
      if (response.error) throw new Error('Failed to fetch execution status')
      return response.data
    },

    getTrace: async (executionId: string) => {
      const response = await apiClient.getWorkflowRunTrace(executionId)
      if (response.error) throw new Error('Failed to fetch execution logs')
      return response.data
    },

    getEvents: async (executionId: string) => {
      const response = await fetch(`${API_BASE_URL}/workflows/runs/${executionId}/events`)
      if (!response.ok) {
        throw new Error(`Failed to fetch events: ${response.statusText}`)
      }
      const data = await response.json()
      return data
    },

    getDataFlows: async (executionId: string) => {
      const response = await fetch(`${API_BASE_URL}/workflows/runs/${executionId}/dataflows`)
      if (!response.ok) {
        throw new Error(`Failed to fetch data flows: ${response.statusText}`)
      }
      const data = await response.json()
      return data
    },

    stream: (executionId: string, options?: { cursor?: string; temporalRunId?: string }) => {
      const params = new URLSearchParams()
      if (options?.cursor) params.set('cursor', options.cursor)
      if (options?.temporalRunId) params.set('temporalRunId', options.temporalRunId)
      const query = params.toString()
      const url = `${API_BASE_URL}/workflows/runs/${executionId}/stream${query ? `?${query}` : ''}`
      return new EventSource(url)
    },

    cancel: async (executionId: string) => {
      const response = await apiClient.cancelWorkflowRun(executionId)
      if (response.error) throw new Error('Failed to cancel execution')
      return { success: true }
    },

    listRuns: async (options?: {
      workflowId?: string;
      status?: string;
      limit?: number;
    }) => {
      const params = new URLSearchParams()
      if (options?.workflowId) params.set('workflowId', options.workflowId)
      if (options?.status) params.set('status', options.status)
      if (options?.limit) params.set('limit', String(options.limit))

      const query = params.toString()
      const response = await fetch(`${API_BASE_URL}/workflows/runs${query ? `?${query}` : ''}`)

      if (!response.ok) {
        throw new Error(`Failed to fetch runs: ${response.statusText}`)
      }

      const data = await response.json()
      return data
    },
  },

  files: {
    list: async () => {
      const response = await apiClient.listFiles()
      if (response.error) throw new Error('Failed to fetch files')
      return response.data
    },

    upload: async (file: File) => {
      const response = await apiClient.uploadFile(file)
      if (response.error) throw new Error('Failed to upload file')
      return response.data
    },

    download: async (id: string) => {
      return apiClient.downloadFile(id)
    },

    delete: async (id: string) => {
      const response = await apiClient.deleteFile(id)
      if (response.error) throw new Error('Failed to delete file')
    },
  },
}

export default api
