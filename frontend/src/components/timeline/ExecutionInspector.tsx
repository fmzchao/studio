import { useEffect, useMemo, useState } from 'react'
import { AnsiUp } from 'ansi_up'
import { RunSelector } from '@/components/timeline/RunSelector'
import { ExecutionTimeline } from '@/components/timeline/ExecutionTimeline'
import { EventInspector } from '@/components/timeline/EventInspector'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MessageModal } from '@/components/ui/MessageModal'
import { StopCircle } from 'lucide-react'
import { useExecutionTimelineStore } from '@/store/executionTimelineStore'
import { useExecutionStore } from '@/store/executionStore'
import { useWorkflowExecution } from '@/hooks/useWorkflowExecution'
import { useWorkflowUiStore } from '@/store/workflowUiStore'
import { useWorkflowStore } from '@/store/workflowStore'
import { useArtifactStore } from '@/store/artifactStore'
import { useRunStore } from '@/store/runStore'
import { cn } from '@/lib/utils'
import type { ExecutionLog } from '@/schemas/execution'
import { createPreview } from '@/utils/textPreview'
import { RunArtifactsPanel } from '@/components/artifacts/RunArtifactsPanel'
import { AgentTracePanel } from '@/components/timeline/AgentTracePanel'

const formatTime = (timestamp: string) => {
  const date = new Date(timestamp)
  return date.toLocaleTimeString()
}

const formatStructured = (value: Record<string, unknown>) => {
  try {
    return JSON.stringify(value, null, 2)
  } catch (error) {
    console.error('Failed to stringify structured log data', error)
    return String(value)
  }
}

const buildLogMessage = (log: ExecutionLog): string => {
  const sections: string[] = []

  const primaryMessage = (log.message ?? log.error?.message)?.trim()
  sections.push(primaryMessage && primaryMessage.length > 0 ? primaryMessage : log.type)

  if (log.outputSummary && Object.keys(log.outputSummary).length > 0) {
    sections.push(`Output summary:\n${formatStructured(log.outputSummary)}`)
  }

  if (log.data && Object.keys(log.data).length > 0) {
    sections.push(`Data:\n${formatStructured(log.data)}`)
  }

  if (log.error?.stack?.trim()) {
    sections.push(`Stack trace:\n${log.error.stack.trim()}`)
  }

  return sections.join('\n\n').trim()
}

interface ExecutionInspectorProps {
  onRerunRun?: (runId: string) => void
}

export function ExecutionInspector({ onRerunRun }: ExecutionInspectorProps = {}) {
  const {
    selectedRunId,
    playbackMode,
    isPlaying,
  } = useExecutionTimelineStore()
  const { id: workflowId, currentVersion: currentWorkflowVersion } = useWorkflowStore(
    (state) => state.metadata
  )
  const workflowCacheKey = workflowId ?? '__global__'
  const scopedRuns = useRunStore((state) => state.cache[workflowCacheKey]?.runs)
  const runs = scopedRuns ?? []
  const { status, runStatus, reset, runId: liveRunId } = useWorkflowExecution()
  const { inspectorTab, setInspectorTab } = useWorkflowUiStore()
  const fetchRunArtifacts = useArtifactStore((state) => state.fetchRunArtifacts)
  const { getDisplayLogs, setLogMode } = useExecutionStore()
  const [logModal, setLogModal] = useState<{ open: boolean; message: string; title: string }>({
    open: false,
    message: '',
    title: '',
  })

  const selectedRun = useMemo(() => (
    runs.find(run => run.id === selectedRunId)
  ), [runs, selectedRunId])

  useEffect(() => {
    if (selectedRunId && inspectorTab === 'artifacts') {
      void fetchRunArtifacts(selectedRunId)
    }
  }, [selectedRunId, inspectorTab, fetchRunArtifacts])

  useEffect(() => {
    // Switch log mode based on timeline playback mode
    if (playbackMode === 'live') {
      setLogMode('live')
    } else if (playbackMode === 'replay') {
      setLogMode('scrubbing')
    }
  }, [playbackMode, setLogMode])



  const openLogModal = (fullMessage: string, log: ExecutionLog) => {
    const titleParts = [
      'Log message',
      log.nodeId ? `Node ${log.nodeId}` : null,
      formatTime(log.timestamp),
    ].filter(Boolean)

    setLogModal({
      open: true,
      message: fullMessage,
      title: titleParts.join(' • '),
    })
  }

  const statusBadge = selectedRun ? (
    <Badge
      variant={selectedRun.status === 'RUNNING' ? 'default' : selectedRun.status === 'FAILED' ? 'destructive' : 'secondary'}
      className="text-xs"
    >
      {selectedRun.status.toUpperCase()}
    </Badge>
  ) : null
  const runVersion = typeof selectedRun?.workflowVersion === 'number' ? selectedRun.workflowVersion : null
  const versionMismatch =
    runVersion !== null &&
    typeof currentWorkflowVersion === 'number' &&
    runVersion !== currentWorkflowVersion
  const versionBadge = runVersion !== null ? (
    <Badge
      variant={versionMismatch ? 'outline' : 'secondary'}
      className={cn(
        'text-[10px] uppercase tracking-wide',
        versionMismatch && 'border-amber-300 bg-amber-50 text-amber-700'
      )}
    >
      v{runVersion}
    </Badge>
  ) : null

  return (
    <>
      <aside className="flex h-full min-h-0 w-full min-w-[320px] flex-col overflow-hidden border-l bg-muted/30 backdrop-blur">
        <div className="border-b p-3 space-y-3 bg-background/70">
          <div className="flex items-center justify-between gap-2">
            <RunSelector onRerun={onRerunRun} />

            <div className="flex items-center gap-2">
              {runStatus?.progress && selectedRunId === liveRunId && (status === 'running' || status === 'queued') && (
                <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">
                  {runStatus.progress.completedActions}/{runStatus.progress.totalActions} actions
                </span>
              )}

              {selectedRunId === liveRunId && (status === 'running' || status === 'queued') && (
                <Button
                  onClick={() => reset()}
                  variant="destructive"
                  size="sm"
                  className="h-8 px-2 gap-1.5"
                >
                  <StopCircle className="h-3.5 w-3.5" />
                  <span className="text-xs">Stop</span>
                </Button>
              )}
            </div>
          </div>
          {selectedRun && (
            <div className="rounded-md border bg-background px-3 py-2 text-xs space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-sm truncate">{selectedRun.workflowName}</span>
                <div className="flex items-center gap-2">
                  {versionBadge}
                  {statusBadge}
                </div>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
                <span>Run #{selectedRun.id.slice(-6)}</span>
                {selectedRun.duration && <span>{Math.round(selectedRun.duration / 1000)}s</span>}
                <span>{selectedRun.eventCount} events</span>
                {selectedRun.nodeCount > 0 && <span>{selectedRun.nodeCount} nodes</span>}
                {runVersion !== null && (
                  <span className={cn(versionMismatch ? 'text-amber-500' : undefined)}>
                    v{runVersion}
                    {versionMismatch && typeof currentWorkflowVersion === 'number'
                      ? ` (current v${currentWorkflowVersion})`
                      : ''}
                  </span>
                )}
              </div>
            </div>
          )}
          {!selectedRun && (
            <div className="rounded-md border border-dashed bg-background px-3 py-2 text-xs text-muted-foreground">
              Select a run to explore its timeline.
            </div>
          )}
        </div>

        <div className="border-b bg-background/60 flex-shrink-0">
          {selectedRun ? (
            <ExecutionTimeline />
          ) : (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground">
              Select a run to scrub through execution timelines.
            </div>
          )}
        </div>

        <div className="border-b bg-background/60 px-3 py-2">
          <div className="inline-flex rounded-md border bg-muted/60 p-1 text-xs font-medium">
            <Button
              variant={inspectorTab === 'events' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 px-3"
              onClick={() => setInspectorTab('events')}
            >
              Events
            </Button>
            <Button
              variant={inspectorTab === 'logs' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 px-3"
              onClick={() => setInspectorTab('logs')}
            >
              Logs
            </Button>
            <Button
              variant={inspectorTab === 'agent' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 px-3"
              onClick={() => setInspectorTab('agent')}
            >
              Agent Trace
            </Button>
            <Button
              variant={inspectorTab === 'artifacts' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 px-3"
              onClick={() => setInspectorTab('artifacts')}
            >
              Artifacts
            </Button>
          </div>
        </div>

        <div className="flex-1 min-h-0">
          {inspectorTab === 'events' && (
            <div className="flex flex-col h-full min-h-0">
              <EventInspector className="h-full" />
            </div>
          )}

          {inspectorTab === 'logs' && (
            <div className="flex flex-col h-full min-h-0">
              <div className="flex items-center justify-between px-3 py-2 border-b bg-background/70 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span>{`${getDisplayLogs().length} log entries`}</span>
                </div>
                <span className={cn('font-medium', playbackMode === 'live' ? 'text-green-600' : 'text-blue-600')}>
                  {playbackMode === 'live' ? (isPlaying ? 'Live (following)' : 'Live paused') : 'Execution playback'}
                </span>
              </div>
              <div className="flex-1 overflow-auto bg-slate-950 text-slate-100 font-mono text-xs">
                {getDisplayLogs().length === 0 ? (
                  <div className="text-slate-400 text-center py-8">
                    No logs to display for this run.
                  </div>
                ) : (
                  <div className="p-2 space-y-0 min-w-max">
                    {getDisplayLogs().map((log, index) => {
                      const executionLog = log as ExecutionLog
                      const fullMessage = buildLogMessage(executionLog)
                      const time = formatTime(log.timestamp)
                      const level = log.level.toUpperCase()
                      const node = log.nodeId ? `[${log.nodeId}]` : ''

                      // Color coding for log levels
                      const levelColor = {
                        'DEBUG': 'text-gray-400',
                        'INFO': 'text-blue-400',
                        'WARN': 'text-yellow-400',
                        'ERROR': 'text-red-400'
                      }[level] || 'text-slate-300'

                      // Check for JSON and format nicely
                      let displayMessage = fullMessage
                      let isJson = false
                      try {
                        const parsed = JSON.parse(fullMessage.trim())
                        if (typeof parsed === 'object' && parsed !== null) {
                          displayMessage = JSON.stringify(parsed, null, 2)
                          isJson = true
                        }
                      } catch {
                        // Not JSON, use as-is
                      }

                      // Truncate long messages
                      const maxLength = 150
                      const isTruncated = displayMessage.length > maxLength
                      const truncatedMessage = isTruncated
                        ? displayMessage.substring(0, maxLength) + '...'
                        : displayMessage

                      return (
                        <div key={log.id} className="group hover:bg-slate-800/30 px-1 py-0.5 rounded cursor-pointer leading-none"
                             onClick={() => openLogModal(fullMessage, executionLog)}>
                          <div className="flex items-start gap-1">
                            <span className="text-slate-500 text-[10px] font-mono flex-shrink-0 w-10">
                              {time}
                            </span>
                            <span className={cn('text-[10px] font-bold uppercase flex-shrink-0 w-12', levelColor)}>
                              {level}
                            </span>
                            {node && (
                              <span className="text-slate-400 text-[10px] flex-shrink-0 max-w-16 truncate">
                                {node}
                              </span>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1">
                                <pre className={cn(
                                  "text-[11px] leading-tight flex-1",
                                  isJson ? "whitespace-pre-wrap" : "whitespace-nowrap overflow-hidden text-ellipsis"
                                )}>
                                  {truncatedMessage}
                                </pre>
                                {isTruncated && (
                                  <span className="text-slate-400 text-[9px] flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                    ⋯
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {inspectorTab === 'artifacts' && (
            <RunArtifactsPanel runId={selectedRunId ?? null} />
          )}

          {inspectorTab === 'agent' && (
            <AgentTracePanel runId={selectedRunId ?? null} />
          )}
        </div>
      </aside>
      <MessageModal
        open={logModal.open}
        onOpenChange={(open) => setLogModal((prev) => ({ ...prev, open }))}
        title={logModal.title || 'Log message'}
        message={logModal.message}
      />
    </>
  )
}
