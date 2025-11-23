import { useEffect, useMemo, useRef, useState } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import 'xterm/css/xterm.css'
import { Download, Loader2, PlugZap, Radio, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTimelineTerminalStream } from '@/hooks/useTimelineTerminalStream'
import { useExecutionTimelineStore } from '@/store/executionTimelineStore'

interface NodeTerminalPanelProps {
  nodeId: string
  runId: string | null
  onClose: () => void
  /**
   * Enable timeline synchronization mode.
   * When enabled, terminal will update based on timeline position.
   */
  timelineSync?: boolean
}

const decodePayload = (payload: string): Uint8Array => {
  if (typeof window === 'undefined' || typeof atob !== 'function') {
    return new Uint8Array(0)
  }
  try {
    const binary = atob(payload)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    // Return raw bytes instead of decoded string to preserve control characters
    return bytes
  } catch {
    return new Uint8Array(0)
  }
}

export function NodeTerminalPanel({
  nodeId,
  runId,
  onClose,
  timelineSync = false,
}: NodeTerminalPanelProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const lastRenderedChunkIndex = useRef<number>(-1)
  const lastTimelineTimeRef = useRef<number | null>(null)
  const [terminalKey, setTerminalKey] = useState(0)

  // Use separate selectors to avoid creating new objects on every render
  const currentTime = useExecutionTimelineStore((state) => state.currentTime)
  const timelineStartTime = useExecutionTimelineStore((state) => state.timelineStartTime)

  const { chunks, isHydrating, isStreaming, error, mode, exportText, isTimelineSync, isFetchingTimeline } = useTimelineTerminalStream({
    runId,
    nodeId,
    stream: 'pty', // Always use PTY stream
    autoConnect: true, // Always enable autoConnect - hook handles timeline sync logic
    timelineSync,
  })

  // Memoize session to avoid unnecessary re-renders
  // Only depend on chunks length and last chunk index, not the entire chunks array
  const chunksLength = chunks.length
  const lastChunkIndex = chunks[chunksLength - 1]?.chunkIndex ?? -1
  const session = useMemo(
    () => {
      console.debug('[NodeTerminalPanel] session memo updated', {
        chunksCount: chunksLength,
        lastChunkIndex,
        mode,
        isStreaming,
        isTimelineSync,
      })
      return {
        chunks,
      }
    },
    [chunks, chunksLength, lastChunkIndex, mode, isStreaming, isTimelineSync],
  )

  // Initialize terminal
  useEffect(() => {
    if (!containerRef.current) {
      return
    }
    const term = new Terminal({
      convertEol: false, // Don't convert EOL - we want raw control characters
      fontSize: 12,
      disableStdin: true,
      cursorBlink: false,
      allowProposedApi: true,
      allowTransparency: false,
      // Disable selection and mouse events
      macOptionIsMeta: false,
      macOptionClickForcesSelection: false,
      rightClickSelectsWord: false,
      // Enable proper handling of control characters
      windowsMode: false,
      theme: {
        background: '#0f172a',
      },
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    })

    // Disable mouse events completely to prevent selection mode
    term.options.macOptionIsMeta = false
    term.options.macOptionClickForcesSelection = false
    term.options.rightClickSelectsWord = false

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)

    term.open(containerRef.current)
    fitAddon.fit()

    terminalRef.current = term
    fitAddonRef.current = fitAddon

    const handleResize = () => fitAddon.fit()
    window.addEventListener('resize', handleResize)

    setTimeout(() => fitAddon.fit(), 0)

    return () => {
      window.removeEventListener('resize', handleResize)
      term.dispose()
      terminalRef.current = null
      fitAddonRef.current = null
    }
  }, [terminalKey])


  // SINGLE RENDERING LOGIC: Simple forward/backward detection
  useEffect(() => {
    if (!terminalRef.current) {
      return
    }

    // Detect if we're seeking backward (timeline position went backwards)
    const isSeekingBackward = timelineSync &&
      lastTimelineTimeRef.current !== null &&
      currentTime < lastTimelineTimeRef.current

    const shouldFilterByTimelineTime = timelineSync && timelineStartTime !== null
    const targetAbsoluteTime =
      shouldFilterByTimelineTime && timelineStartTime !== null
        ? timelineStartTime + currentTime
        : null

    if (isSeekingBackward) {
      // Seeking backward: Recreate terminal to ensure clean state
      // This avoids artifacts where cleared terminal still has pending writes
      console.debug('[NodeTerminalPanel] Seeking backward - recreating terminal', {
        from: lastTimelineTimeRef.current,
        to: currentTime,
      })

      setTerminalKey(k => k + 1)
      lastRenderedChunkIndex.current = -1
      lastTimelineTimeRef.current = currentTime
      return
    }

    // Forward streaming or forward seek: incremental rendering
    if (!chunks || chunks.length === 0) {
      lastTimelineTimeRef.current = currentTime
      return
    }

    const newChunks = chunks.filter((chunk) => chunk.chunkIndex > lastRenderedChunkIndex.current)

    if (newChunks.length === 0) {
      lastTimelineTimeRef.current = currentTime
      return
    }

    // Render only new chunks (incremental, no clear)
    for (const chunk of newChunks) {
      if (!terminalRef.current) break
      const chunkTime = new Date(chunk.recordedAt).getTime()
      if (shouldFilterByTimelineTime && targetAbsoluteTime !== null && chunkTime > targetAbsoluteTime) {
        continue
      }
      const bytes = decodePayload(chunk.payload)
      if (bytes.length === 0) continue
      terminalRef.current.write(bytes)
      lastRenderedChunkIndex.current = chunk.chunkIndex
    }

    lastTimelineTimeRef.current = currentTime
    fitAddonRef.current?.fit()
  }, [chunks, timelineSync, currentTime, timelineStartTime, terminalKey])

  const streamBadge = isTimelineSync ? (
    <span className="flex items-center gap-1 text-xs text-purple-400">
      <PlugZap className="h-3 w-3" /> Timeline Sync
    </span>
  ) : isStreaming ? (
    <span className="flex items-center gap-1 text-xs text-green-400">
      <Radio className="h-3 w-3 animate-pulse" /> Live
    </span>
  ) : mode === 'replay' ? (
    <span className="flex items-center gap-1 text-xs text-blue-400">
      <PlugZap className="h-3 w-3" /> Replay
    </span>
  ) : (
    <span className="flex items-center gap-1 text-xs text-slate-400">
      <PlugZap className="h-3 w-3" /> Idle
    </span>
  )

  return (
    <div className="w-[520px] bg-slate-900 text-slate-100 rounded-lg shadow-2xl border border-slate-700 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800 bg-slate-950/70">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-300">Terminal • {nodeId}</div>
          {streamBadge}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-slate-100"
            onClick={() => exportText()}
            disabled={!chunks.length}
          >
            <Download className="h-3 w-3 mr-1" />
            Export
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-300" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {(isHydrating || isFetchingTimeline) && (
        <div className="border-b border-slate-800 px-3 py-1 flex items-center gap-2 text-[11px] text-slate-400">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>{isFetchingTimeline ? 'Syncing with timeline...' : 'Loading terminal output...'}</span>
        </div>
      )}
      <div className="relative bg-slate-950">
        <div ref={containerRef} className="h-[360px] w-full" />
        {!session?.chunks?.length && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-xs text-slate-500 space-y-2 text-center p-4">
              <div>{isHydrating || isFetchingTimeline ? 'Loading output…' : 'Waiting for terminal output…'}</div>
              <div className="font-mono text-[10px] opacity-50">
                {nodeId} • pty
              </div>
            </div>
          </div>
        )}
      </div>
      {error && (
        <div className="px-3 py-2 text-xs text-red-400 border-t border-slate-800 bg-slate-950/60">
          {error}
        </div>
      )}
    </div>
  )
}
