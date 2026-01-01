import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/use-toast'
import {
  RefreshCw,
  Search,
  Edit3,
  Plus,
  Trash2,
  Copy,
  Link2,
  Code,
  AlertCircle,
  CheckCircle2,
  RotateCw,
  ChevronDown,
  ChevronRight,
  ExternalLink,
} from 'lucide-react'
import { useWebhookStore } from '@/store/webhookStore'
import { api } from '@/services/api'
import { WebhookEditorDrawer, type WorkflowOption } from '@/components/webhooks/WebhookEditorDrawer'
import type { WebhookConfiguration } from '@shipsec/shared'

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
]

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  active: 'default',
  inactive: 'secondary',
}

const DELIVERY_STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  delivered: 'default',
  failed: 'destructive',
  processing: 'outline',
}

const formatDateTime = (value?: string | null) => {
  if (!value) return '—'
  const date = new Date(value)
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    timeZoneName: 'short',
  }).format(date)
}

const getWorkflowName = (
  workflowId: string,
  workflows: WorkflowOption[],
): string => {
  const match = workflows.find((workflow) => workflow.id === workflowId)
  return match?.name ?? 'Unknown workflow'
}

const WEBHOOK_BASE_URL = process.env.VITE_API_URL || 'https://api.shipsec.ai'

export function WebhooksPage() {
  const { toast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const [workflowOptions, setWorkflowOptions] = useState<WorkflowOption[]>([])
  const [workflowsLoading, setWorkflowsLoading] = useState(true)
  const [actionState, setActionState] = useState<Record<string, 'delete' | 'regenerate' | 'test'>>({})
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorMode, setEditorMode] = useState<'create' | 'edit'>('create')
  const [activeWebhook, setActiveWebhook] = useState<WebhookConfiguration | null>(null)

  // Test panel state
  const [testPanelOpen, setTestPanelOpen] = useState(false)
  const [testWebhookId, setTestWebhookId] = useState<string | null>(null)
  const [testPayload, setTestPayload] = useState('')
  const [testHeaders, setTestHeaders] = useState('')
  const [testResult, setTestResult] = useState<{
    success: boolean
    parsedData: Record<string, unknown> | null
    errorMessage: string | null
    validationErrors?: Array<{ inputId: string; message: string }>
  } | null>(null)
  const [isTesting, setIsTesting] = useState(false)

  // Delivery history state
  const [deliveriesPanelOpen, setDeliveriesPanelOpen] = useState(false)
  const [deliveriesWebhookId, setDeliveriesWebhookId] = useState<string | null>(null)
  const [expandedDeliveries, setExpandedDeliveries] = useState<Set<string>>(new Set())

  const webhooks = useWebhookStore((state) => state.webhooks)
  const isLoading = useWebhookStore((state) => state.isLoading)
  const error = useWebhookStore((state) => state.error)
  const filters = useWebhookStore((state) => state.filters)
  const fetchWebhooks = useWebhookStore((state) => state.fetchWebhooks)
  const refreshWebhooks = useWebhookStore((state) => state.refreshWebhooks)
  const setFilters = useWebhookStore((state) => state.setFilters)
  const deleteWebhook = useWebhookStore((state) => state.deleteWebhook)
  const upsertWebhook = useWebhookStore((state) => state.upsertWebhook)
  const regeneratePath = useWebhookStore((state) => state.regeneratePath)
  const testScript = useWebhookStore((state) => state.testScript)
  const fetchDeliveries = useWebhookStore((state) => state.fetchDeliveries)
  const deliveries = useWebhookStore((state) => state.deliveries)
  const isDeliveriesLoading = useWebhookStore((state) => state.isDeliveriesLoading)

  useEffect(() => {
    const initialWorkflowId = searchParams.get('workflowId')
    if (initialWorkflowId) {
      setFilters({ workflowId: initialWorkflowId })
    }
  }, [])

  useEffect(() => {
    fetchWebhooks({ force: true }).catch(() => {})
  }, [fetchWebhooks])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const workflowList = await api.workflows.list()
        if (cancelled) return
        const normalized = workflowList.map((workflow) => ({
          id: workflow.id,
          name: workflow.name ?? 'Untitled workflow',
        }))
        setWorkflowOptions(normalized)
      } catch (err) {
        console.error('Failed to load workflows', err)
        toast({
          title: 'Unable to load workflows',
          description: err instanceof Error ? err.message : 'Please try refreshing the page.',
          variant: 'destructive',
        })
      } finally {
        if (!cancelled) {
          setWorkflowsLoading(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [toast])

  const filteredWebhooks = useMemo(() => {
    const query = filters.search.trim().toLowerCase()

    return webhooks.filter((webhook) => {
      const workflowName = getWorkflowName(webhook.workflowId, workflowOptions)
      const matchesSearch =
        query.length === 0 ||
        webhook.name.toLowerCase().includes(query) ||
        workflowName.toLowerCase().includes(query) ||
        webhook.webhookPath.toLowerCase().includes(query)

      const matchesStatus = filters.status === 'all' || webhook.status === filters.status

      return matchesSearch && matchesStatus
    })
  }, [filters.search, filters.status, webhooks, workflowOptions])

  const markAction = (id: string, action: 'delete' | 'regenerate' | 'test') => {
    setActionState((state) => ({ ...state, [id]: action }))
  }

  const clearAction = (id: string) => {
    setActionState((state) => {
      const next = { ...state }
      delete next[id]
      return next
    })
  }

  const handleWorkflowFilterChange = (value: string) => {
    const workflowId = value === 'all' ? null : value
    setFilters({ workflowId })
    const nextParams = new URLSearchParams(searchParams)
    if (workflowId) {
      nextParams.set('workflowId', workflowId)
    } else {
      nextParams.delete('workflowId')
    }
    setSearchParams(nextParams, { replace: true })
  }

  const handleStatusFilterChange = (value: string) => {
    setFilters({ status: value as typeof filters.status })
  }

  const openCreateDrawer = () => {
    setEditorMode('create')
    setActiveWebhook(null)
    setEditorOpen(true)
  }

  const openEditDrawer = (webhook: WebhookConfiguration) => {
    setEditorMode('edit')
    setActiveWebhook(webhook)
    setEditorOpen(true)
  }

  const handleWebhookSaved = (
    savedWebhook: WebhookConfiguration,
    mode: 'create' | 'edit',
  ) => {
    upsertWebhook(savedWebhook)
    toast({
      title: mode === 'create' ? 'Webhook created' : 'Webhook updated',
      description: mode === 'create'
        ? `"${savedWebhook.name}" is ready to receive events.`
        : `"${savedWebhook.name}" has been updated.`,
    })
  }

  const handleCopyUrl = async (webhook: WebhookConfiguration) => {
    const url = `${WEBHOOK_BASE_URL}/webhooks/inbound/${webhook.webhookPath}`
    try {
      await navigator.clipboard.writeText(url)
      toast({
        title: 'Webhook URL copied',
        description: 'The webhook URL has been copied to your clipboard.',
      })
    } catch (err) {
      toast({
        title: 'Failed to copy',
        description: 'Could not copy the webhook URL to clipboard.',
        variant: 'destructive',
      })
    }
  }

  const handleRegeneratePath = async (webhook: WebhookConfiguration) => {
    markAction(webhook.id, 'regenerate')
    try {
      const result = await regeneratePath(webhook.id)
      toast({
        title: 'Webhook URL regenerated',
        description: 'The old webhook URL will no longer work. Make sure to update your integrations.',
      })
      // Update the webhook in state
      upsertWebhook({ ...webhook, webhookPath: result.webhookPath })
    } catch (err) {
      toast({
        title: 'Failed to regenerate URL',
        description: err instanceof Error ? err.message : 'Try again in a moment.',
        variant: 'destructive',
      })
    } finally {
      clearAction(webhook.id)
    }
  }

  const handleRefresh = async () => {
    try {
      await refreshWebhooks()
      toast({
        title: 'Webhooks refreshed',
        description: 'Latest webhook configurations have been loaded.',
      })
    } catch (err) {
      toast({
        title: 'Refresh failed',
        description: err instanceof Error ? err.message : 'Try again in a moment.',
        variant: 'destructive',
      })
    }
  }

  const handleDelete = async (webhook: WebhookConfiguration) => {
    if (!confirm(`Are you sure you want to delete "${webhook.name}"? This action cannot be undone.`)) {
      return
    }
    markAction(webhook.id, 'delete')
    try {
      await deleteWebhook(webhook.id)
      toast({
        title: 'Webhook deleted',
        description: `"${webhook.name}" has been deleted.`,
      })
    } catch (err) {
      toast({
        title: 'Failed to delete webhook',
        description: err instanceof Error ? err.message : 'Try again in a moment.',
        variant: 'destructive',
      })
    } finally {
      clearAction(webhook.id)
    }
  }

  const openTestPanel = (webhook: WebhookConfiguration) => {
    setTestWebhookId(webhook.id)
    setTestPayload('{\n  // Example payload\n  "pull_request": {\n    "title": "Fix bug in authentication",\n    "number": 123,\n    "state": "open"\n  }\n}')
    setTestHeaders('{\n  "x-github-event": "pull_request"\n}')
    setTestResult(null)
    setTestPanelOpen(true)
  }

  const handleRunTest = async () => {
    const webhook = webhooks.find((w) => w.id === testWebhookId)
    if (!webhook) return

    setIsTesting(true)
    setTestResult(null)

    try {
      let payloadObj: Record<string, unknown>
      let headersObj: Record<string, string> = {}

      try {
        payloadObj = JSON.parse(testPayload)
      } catch {
        throw new Error('Invalid JSON in test payload')
      }

      if (testHeaders.trim()) {
        try {
          headersObj = JSON.parse(testHeaders)
        } catch {
          throw new Error('Invalid JSON in test headers')
        }
      }

      const result = await testScript({
        parsingScript: webhook.parsingScript,
        testPayload: payloadObj,
        testHeaders: headersObj,
        webhookId: webhook.id,
      })

      setTestResult(result)

      if (result.success) {
        toast({
          title: 'Test successful',
          description: 'Parsing script executed successfully. See results below.',
        })
      } else {
        toast({
          title: 'Test failed',
          description: result.errorMessage || 'Parsing script failed.',
          variant: 'destructive',
        })
      }
    } catch (err) {
      const result = {
        success: false,
        parsedData: null,
        errorMessage: err instanceof Error ? err.message : 'Unknown error',
      }
      setTestResult(result)
      toast({
        title: 'Test failed',
        description: result.errorMessage,
        variant: 'destructive',
      })
    } finally {
      setIsTesting(false)
    }
  }

  const openDeliveriesPanel = async (webhook: WebhookConfiguration) => {
    setDeliveriesWebhookId(webhook.id)
    setDeliveriesPanelOpen(true)
    setExpandedDeliveries(new Set())

    if (!deliveries[webhook.id]) {
      try {
        await fetchDeliveries(webhook.id)
      } catch (err) {
        toast({
          title: 'Failed to load deliveries',
          description: err instanceof Error ? err.message : 'Try again later.',
          variant: 'destructive',
        })
      }
    }
  }

  const toggleDeliveryExpanded = (deliveryId: string) => {
    setExpandedDeliveries((prev) => {
      const next = new Set(prev)
      if (next.has(deliveryId)) {
        next.delete(deliveryId)
      } else {
        next.add(deliveryId)
      }
      return next
    })
  }

  const renderStatusBadge = (status: string) => {
    const variant = STATUS_VARIANTS[status] || 'outline'
    const label = status.charAt(0).toUpperCase() + status.slice(1)
    return <Badge variant={variant}>{label}</Badge>
  }

  const renderDeliveryStatusBadge = (status: string) => {
    const variant = DELIVERY_STATUS_VARIANTS[status] || 'outline'
    const label = status.charAt(0).toUpperCase() + status.slice(1)
    return <Badge variant={variant}>{label}</Badge>
  }

  const isActionBusy = (id: string) => Boolean(actionState[id])

  const hasData = filteredWebhooks.length > 0
  const currentWebhookDeliveries = deliveriesWebhookId ? deliveries[deliveriesWebhookId] || [] : []

  return (
    <TooltipProvider>
      <div className="flex-1 bg-background">
        <div className="container mx-auto px-3 md:px-4 py-4 md:py-8 space-y-4 md:space-y-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="flex-1 space-y-2">
              <label className="text-xs uppercase text-muted-foreground flex items-center gap-2">
                <Search className="h-3.5 w-3.5" />
                Search webhooks or workflows
              </label>
              <Input
                placeholder="Filter by webhook name, workflow, or URL"
                value={filters.search}
                onChange={(event) => setFilters({ search: event.target.value })}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                className="gap-2"
                onClick={handleRefresh}
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
              <Button
                variant="default"
                className="gap-2"
                onClick={openCreateDrawer}
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">New webhook</span>
              </Button>
            </div>
          </div>

          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive flex items-center justify-between">
              <span>{error}</span>
              <Button variant="outline" size="sm" onClick={handleRefresh}>
                Try again
              </Button>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <label className="text-xs uppercase text-muted-foreground">Status</label>
              <Select value={filters.status} onValueChange={handleStatusFilterChange}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase text-muted-foreground">Workflow</label>
              <Select
                value={filters.workflowId ?? 'all'}
                onValueChange={handleWorkflowFilterChange}
                disabled={workflowsLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All workflows" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All workflows</SelectItem>
                  {workflowOptions.map((workflow) => (
                    <SelectItem key={workflow.id} value={workflow.id}>
                      {workflow.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[140px]">Name</TableHead>
                  <TableHead className="min-w-[120px] hidden md:table-cell">Workflow</TableHead>
                  <TableHead className="min-w-[200px]">Webhook URL</TableHead>
                  <TableHead className="min-w-[100px] hidden lg:table-cell">Created</TableHead>
                  <TableHead className="min-w-[80px]">Status</TableHead>
                  <TableHead className="text-right min-w-[200px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && !hasData
                  ? Array.from({ length: 4 }).map((_, index) => (
                      <TableRow key={`skeleton-${index}`}>
                        {Array.from({ length: 6 }).map((_, cell) => (
                          <TableCell key={`cell-${cell}`}>
                            <Skeleton className="h-5 w-full" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  : null}
                {!isLoading && hasData
                  ? filteredWebhooks.map((webhook) => {
                      const workflowName = getWorkflowName(webhook.workflowId, workflowOptions)

                      return (
                        <TableRow key={webhook.id}>
                          <TableCell className="font-medium">
                            <div className="flex flex-col">
                              <span className="truncate max-w-[140px]">{webhook.name}</span>
                              {webhook.description && (
                                <span className="text-xs text-muted-foreground truncate max-w-[140px]">
                                  {webhook.description}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <div className="flex flex-col">
                              <span className="font-medium truncate max-w-[120px]">{workflowName}</span>
                              <span className="text-xs text-muted-foreground truncate max-w-[120px]">
                                {webhook.workflowId.slice(0, 8)}...
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 max-w-[200px]">
                              <code className="text-xs bg-muted px-1.5 py-0.5 rounded truncate flex-1">
                                /{webhook.webhookPath.slice(0, 20)}...
                              </code>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 shrink-0"
                                    onClick={() => handleCopyUrl(webhook)}
                                  >
                                    <Copy className="h-3 w-3" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  Copy webhook URL
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm hidden lg:table-cell">{formatDateTime(webhook.createdAt)}</TableCell>
                          <TableCell>{renderStatusBadge(webhook.status)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1 md:gap-2">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="gap-1 h-8 px-2 md:px-3"
                                    onClick={() => openTestPanel(webhook)}
                                  >
                                    <Code className="h-4 w-4" />
                                    <span className="hidden md:inline">Test</span>
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  Test parsing script
                                </TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="gap-1 h-8 px-2 md:px-3"
                                    onClick={() => openDeliveriesPanel(webhook)}
                                  >
                                    <ExternalLink className="h-4 w-4" />
                                    <span className="hidden md:inline">History</span>
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  View delivery history
                                </TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    className="gap-1 h-8 px-2 md:px-3"
                                    onClick={() => openEditDrawer(webhook)}
                                  >
                                    <Edit3 className="h-4 w-4" />
                                    <span className="hidden md:inline">Edit</span>
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  Edit webhook configuration
                                </TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    aria-label="Regenerate URL"
                                    onClick={() => handleRegeneratePath(webhook)}
                                    disabled={isActionBusy(webhook.id)}
                                    className="h-8 w-8"
                                  >
                                    <RotateCw className={`h-4 w-4 ${isActionBusy(webhook.id) ? 'animate-spin' : ''}`} />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  Regenerate webhook URL (old URL will stop working)
                                </TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label="Delete webhook"
                                    onClick={() => handleDelete(webhook)}
                                    disabled={isActionBusy(webhook.id)}
                                    className="h-8 w-8"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  Delete webhook
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  : null}
                {!isLoading && !hasData && (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <div className="flex flex-col items-center justify-center py-10 text-center space-y-2">
                        <Link2 className="h-10 w-10 text-muted-foreground" />
                        <p className="font-medium">No webhooks found</p>
                        <p className="text-sm text-muted-foreground max-w-lg">
                          Create your first webhook with the "New webhook" button or tweak the filters above.
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            </div>
          </div>
        </div>
      </div>

      {/* Test Panel Dialog */}
      <Dialog open={testPanelOpen} onOpenChange={setTestPanelOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Test Parsing Script</DialogTitle>
            <DialogDescription>
              Test your webhook parsing script with sample data to see how it transforms payloads.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="test-payload">Test Payload (JSON)</Label>
                <Textarea
                  id="test-payload"
                  rows={8}
                  value={testPayload}
                  onChange={(e) => setTestPayload(e.target.value)}
                  placeholder='{"key": "value"}'
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="test-headers">Test Headers (JSON, optional)</Label>
                <Textarea
                  id="test-headers"
                  rows={8}
                  value={testHeaders}
                  onChange={(e) => setTestHeaders(e.target.value)}
                  placeholder='{"x-webhook-event": "trigger"}'
                  className="font-mono text-sm"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleRunTest} disabled={isTesting}>
                {isTesting ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <PlayCircle className="h-4 w-4 mr-2" />
                    Run Test
                  </>
                )}
              </Button>
            </div>

            {testResult && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  {testResult.success ? (
                    <>
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      <span className="font-medium text-green-600">Test passed</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-5 w-5 text-destructive" />
                      <span className="font-medium text-destructive">Test failed</span>
                    </>
                  )}
                </div>

                {testResult.errorMessage && (
                  <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3">
                    <p className="text-sm text-destructive">{testResult.errorMessage}</p>
                  </div>
                )}

                {testResult.parsedData && (
                  <div className="space-y-2">
                    <Label>Parsed Output</Label>
                    <pre className="rounded-md bg-muted p-3 text-xs overflow-x-auto">
                      {JSON.stringify(testResult.parsedData, null, 2)}
                    </pre>
                  </div>
                )}

                {testResult.validationErrors && testResult.validationErrors.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-destructive">Validation Errors</Label>
                    <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3">
                      <ul className="text-sm text-destructive space-y-1">
                        {testResult.validationErrors.map((err, i) => (
                          <li key={i}>• {err.inputId}: {err.message}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Deliveries Panel Dialog */}
      <Dialog open={deliveriesPanelOpen} onOpenChange={setDeliveriesPanelOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Delivery History</DialogTitle>
            <DialogDescription>
              Recent webhook deliveries and their processing status.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {isDeliveriesLoading[deliveriesWebhookId || ''] ? (
              <div className="flex justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : currentWebhookDeliveries.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No deliveries yet. Once a webhook is triggered, deliveries will appear here.
              </div>
            ) : (
              <div className="space-y-2">
                {currentWebhookDeliveries.map((delivery) => (
                  <div
                    key={delivery.id}
                    className="rounded-md border bg-card p-3 space-y-2"
                  >
                    <div
                      className="flex items-center justify-between cursor-pointer"
                      onClick={() => toggleDeliveryExpanded(delivery.id)}
                    >
                      <div className="flex items-center gap-2">
                        {expandedDeliveries.has(delivery.id) ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                        {renderDeliveryStatusBadge(delivery.status)}
                        <span className="text-sm text-muted-foreground">
                          {formatDateTime(delivery.createdAt)}
                        </span>
                      </div>
                      {delivery.workflowRunId && (
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                          onClick={(e) => {
                            e.stopPropagation()
                            window.open(`/runs/${delivery.workflowRunId}`, '_blank')
                          }}
                        >
                          <a target="_blank" rel="noopener noreferrer">
                            View Run
                          </a>
                        </Button>
                      )}
                    </div>

                    {expandedDeliveries.has(delivery.id) && (
                      <div className="space-y-3 pt-2 border-t">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-xs text-muted-foreground">Payload</Label>
                            <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-x-auto max-h-32">
                              {JSON.stringify(delivery.payload, null, 2)}
                            </pre>
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Parsed Data</Label>
                            {delivery.parsedData ? (
                              <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-x-auto max-h-32">
                                {JSON.stringify(delivery.parsedData, null, 2)}
                              </pre>
                            ) : (
                              <p className="text-sm text-muted-foreground mt-1">No parsed data</p>
                            )}
                          </div>
                        </div>
                        {delivery.errorMessage && (
                          <div>
                            <Label className="text-xs text-destructive">Error</Label>
                            <p className="text-sm text-destructive mt-1">{delivery.errorMessage}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <WebhookEditorDrawer
        open={editorOpen}
        mode={editorMode}
        webhook={activeWebhook ?? undefined}
        defaultWorkflowId={editorMode === 'create' ? filters.workflowId : activeWebhook?.workflowId}
        workflowOptions={workflowOptions}
        onClose={() => setEditorOpen(false)}
        onSaved={handleWebhookSaved}
      />
    </TooltipProvider>
  )
}

// Import PlayCircle icon for the test button
import { PlayCircle } from 'lucide-react'
