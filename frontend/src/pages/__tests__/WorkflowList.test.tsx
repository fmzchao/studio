import { describe, it, beforeEach, expect, vi } from 'bun:test'
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'

vi.mock('@/components/ui/dialog', () => {
  const Dialog = ({ open, children }: { open: boolean; children: ReactNode }) =>
    open ? <>{children}</> : null
  const DialogContent = ({ children, ...props }: any) => (
    <div role="dialog" {...props}>
      {children}
    </div>
  )
  const passthrough = ({ children, ...props }: any) => <div {...props}>{children}</div>
  const passthroughInline = ({ children, ...props }: any) => <span {...props}>{children}</span>
  const FragmentWrapper = ({ children }: any) => <>{children}</>

  return {
    Dialog,
    DialogContent,
    DialogHeader: passthrough,
    DialogFooter: passthrough,
    DialogTitle: passthroughInline,
    DialogDescription: passthroughInline,
    DialogPortal: FragmentWrapper,
    DialogOverlay: FragmentWrapper,
    DialogTrigger: FragmentWrapper,
    DialogClose: FragmentWrapper,
  }
})

vi.mock('@/services/api', () => {
  const list = vi.fn()
  const remove = vi.fn()
  const noop = vi.fn()

  return {
    api: {
      workflows: {
        list,
        delete: remove,
        get: noop,
        create: noop,
        update: noop,
        commit: noop,
        run: noop,
      },
    },
  }
})

import { WorkflowList } from '@/pages/WorkflowList'
import type { WorkflowMetadata } from '@/schemas/workflow'
import { api } from '@/services/api'

const workflowsApi = api.workflows as unknown as {
  list: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
}

const ISO = '2024-01-01T00:00:00.000Z'

const makeWorkflow = (id: string, name: string): WorkflowMetadata => ({
  id,
  name,
  description: null,
  nodes: [],
  edges: [],
  lastRun: null,
  runCount: 0,
  createdAt: ISO,
  updatedAt: ISO,
})

const renderWorkflowList = () =>
  render(
    <MemoryRouter>
      <WorkflowList />
    </MemoryRouter>
  )

describe('WorkflowList delete workflow flow', () => {
  beforeEach(() => {
    workflowsApi.list.mockReset()
    workflowsApi.delete.mockReset()
  })

  it('opens confirmation dialog with workflow details when delete is clicked', async () => {
    const workflow = makeWorkflow('11111111-1111-1111-1111-111111111111', 'Alpha Workflow')
    workflowsApi.list.mockResolvedValue([workflow])
    workflowsApi.delete.mockResolvedValue(undefined)

    renderWorkflowList()

    await screen.findByText('Alpha Workflow')
    const deleteButton = screen.getByRole('button', { name: 'Delete workflow Alpha Workflow' })
    fireEvent.click(deleteButton)

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Alpha Workflow')).toBeInTheDocument()
    expect(within(dialog).getByText(workflow.id)).toBeInTheDocument()
  })

  it('calls API and removes workflow from list on successful delete', async () => {
    const workflow = makeWorkflow('22222222-2222-2222-2222-222222222222', 'Beta Workflow')
    workflowsApi.list.mockResolvedValue([workflow])
    workflowsApi.delete.mockResolvedValue(undefined)

    renderWorkflowList()

    await screen.findByText('Beta Workflow')
    fireEvent.click(screen.getByRole('button', { name: 'Delete workflow Beta Workflow' }))

    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete workflow' }))

    await waitFor(() => {
      expect(workflowsApi.delete).toHaveBeenCalledWith(workflow.id)
    })

    await waitFor(() => {
      expect(screen.queryByText('Beta Workflow')).not.toBeInTheDocument()
    })
  })

  it('shows error in dialog when delete fails', async () => {
    const workflow = makeWorkflow('33333333-3333-3333-3333-333333333333', 'Gamma Workflow')
    workflowsApi.list.mockResolvedValue([workflow])
    workflowsApi.delete.mockRejectedValue(new Error('Delete failed'))

    renderWorkflowList()

    await screen.findByText('Gamma Workflow')
    fireEvent.click(screen.getByRole('button', { name: 'Delete workflow Gamma Workflow' }))

    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete workflow' }))

    await waitFor(() => {
      expect(workflowsApi.delete).toHaveBeenCalledWith(workflow.id)
    })

    expect(await within(dialog).findByText('Delete failed')).toBeInTheDocument()
    expect(dialog).toBeInTheDocument()
  })
})
