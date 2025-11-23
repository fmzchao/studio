import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useTerminalStream, type UseTerminalStreamOptions, type UseTerminalStreamResult } from './useTerminalStream'
import { useExecutionTimelineStore } from '@/store/executionTimelineStore'
import { api } from '@/services/api'

export interface UseTimelineTerminalStreamOptions extends UseTerminalStreamOptions {
  /**
   * Enable timeline synchronization mode.
   * When enabled, terminal will update based on timeline position.
   */
  timelineSync?: boolean
}

export interface UseTimelineTerminalStreamResult extends UseTerminalStreamResult {
  /**
   * Chunks up to current timeline position (only in timeline sync mode)
   */
  timelineChunks: ReturnType<typeof useTerminalStream>['chunks']
  /**
   * Whether terminal is in timeline sync mode
   */
  isTimelineSync: boolean
  /**
   * Whether chunks are being fetched for timeline position
   */
  isFetchingTimeline: boolean
}

/**
 * Hook for timeline-synchronized terminal streaming.
 * When timelineSync is enabled, terminal content updates based on timeline position.
 * 
 * Implementation follows asciinema approach:
 * - When seeking backward: reset terminal and rebuild from start
 * - When seeking forward: fast-forward from current position
 * - Always fetch chunks from workflow start to current timeline position
 */
export function useTimelineTerminalStream(
  options: UseTimelineTerminalStreamOptions,
): UseTimelineTerminalStreamResult {
  const { timelineSync = false, ...terminalOptions } = options
  const terminalResult = useTerminalStream({
    ...terminalOptions,
    autoConnect: !timelineSync || terminalOptions.autoConnect === false ? false : terminalOptions.autoConnect,
  })
  
  const { currentTime, timelineStartTime, playbackMode } = useExecutionTimelineStore((state) => ({
    currentTime: state.currentTime,
    timelineStartTime: state.timelineStartTime,
    playbackMode: state.playbackMode,
  }))

  const [timelineChunks, setTimelineChunks] = useState<typeof terminalResult.chunks>([])
  const [isFetchingTimeline, setIsFetchingTimeline] = useState(false)
  const lastFetchTimeRef = useRef<number | null>(null)
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const cachedChunksRef = useRef<Map<number, typeof terminalResult.chunks>>(new Map())

  // Calculate absolute time from timeline position
  const getAbsoluteTimeFromTimeline = useCallback((timelineMs: number): Date | null => {
    if (!timelineStartTime) return null
    return new Date(timelineStartTime + timelineMs)
  }, [timelineStartTime])

  // Fetch terminal chunks from workflow start to target time
  const fetchChunksUpToTime = useCallback(async (targetTimeMs: number) => {
    if (!terminalOptions.runId || !terminalOptions.nodeId || !timelineStartTime) {
      return
    }

    setIsFetchingTimeline(true)
    try {
      const targetAbsoluteTime = getAbsoluteTimeFromTimeline(targetTimeMs)
      if (!targetAbsoluteTime) {
        return
      }

      // Fetch chunks from workflow start to target time
      const startAbsoluteTime = new Date(timelineStartTime)
      const result = await api.executions.getTerminalChunks(terminalOptions.runId, {
        nodeRef: terminalOptions.nodeId,
        stream: terminalOptions.stream,
        startTime: startAbsoluteTime,
        endTime: targetAbsoluteTime,
      })

      // Cache chunks by time range (for 1-second buckets)
      const timeBucket = Math.floor(targetTimeMs / 1000)
      cachedChunksRef.current.set(timeBucket, result.chunks)

      // Merge with cached chunks from earlier buckets
      const allChunks: typeof result.chunks = []
      for (let bucket = 0; bucket <= timeBucket; bucket++) {
        const cached = cachedChunksRef.current.get(bucket)
        if (cached) {
          // Merge and deduplicate by chunkIndex
          const chunkMap = new Map<number, typeof result.chunks[0]>()
          for (const chunk of allChunks) {
            chunkMap.set(chunk.chunkIndex, chunk)
          }
          for (const chunk of cached) {
            chunkMap.set(chunk.chunkIndex, chunk)
          }
          allChunks.length = 0
          allChunks.push(...Array.from(chunkMap.values()).sort((a, b) => a.chunkIndex - b.chunkIndex))
        }
      }

      // If we have new chunks, add them
      if (result.chunks.length > 0) {
        const chunkMap = new Map<number, typeof result.chunks[0]>()
        for (const chunk of allChunks) {
          chunkMap.set(chunk.chunkIndex, chunk)
        }
        for (const chunk of result.chunks) {
          chunkMap.set(chunk.chunkIndex, chunk)
        }
        const merged = Array.from(chunkMap.values()).sort((a, b) => a.chunkIndex - b.chunkIndex)
        setTimelineChunks(merged)
      } else if (allChunks.length > 0) {
        setTimelineChunks(allChunks)
      } else {
        setTimelineChunks(result.chunks)
      }
    } catch (error) {
      console.error('[useTimelineTerminalStream] Failed to fetch chunks for timeline', error)
      // Fallback to filtering existing chunks
      if (timelineStartTime) {
        const targetAbsoluteTime = getAbsoluteTimeFromTimeline(targetTimeMs)
        if (targetAbsoluteTime) {
          const startAbsoluteTime = new Date(timelineStartTime)
          const filtered = terminalResult.chunks.filter((chunk) => {
            const recordedAt = new Date(chunk.recordedAt)
            return recordedAt >= startAbsoluteTime && recordedAt <= targetAbsoluteTime
          })
          setTimelineChunks(filtered)
        }
      }
    } finally {
      setIsFetchingTimeline(false)
    }
  }, [terminalOptions.runId, terminalOptions.nodeId, terminalOptions.stream, timelineStartTime, getAbsoluteTimeFromTimeline, terminalResult.chunks])

  // Update terminal when timeline position changes (in timeline sync mode)
  useEffect(() => {
    if (!timelineSync || playbackMode === 'live') {
      // Not in sync mode - use regular chunks
      setTimelineChunks([])
      return
    }

    if (!timelineStartTime) {
      return // Can't sync without timeline start time
    }

    // Debounce rapid timeline changes (e.g., during scrubbing)
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current)
    }

    debounceTimeoutRef.current = setTimeout(() => {
      // Only fetch if timeline position changed significantly (avoid excessive API calls)
      const timeDiff = lastFetchTimeRef.current
        ? Math.abs(currentTime - lastFetchTimeRef.current)
        : Infinity

      // Fetch if timeline moved more than 100ms or this is the first fetch
      if (timeDiff > 100 || lastFetchTimeRef.current === null) {
        void fetchChunksUpToTime(currentTime)
        lastFetchTimeRef.current = currentTime
      } else {
        // Use cached/filtered chunks for small movements
        const targetAbsoluteTime = getAbsoluteTimeFromTimeline(currentTime)
        if (targetAbsoluteTime && timelineStartTime) {
          const startAbsoluteTime = new Date(timelineStartTime)
          const filtered = terminalResult.chunks.filter((chunk) => {
            const recordedAt = new Date(chunk.recordedAt)
            return recordedAt >= startAbsoluteTime && recordedAt <= targetAbsoluteTime
          })
          setTimelineChunks(filtered)
        }
      }
    }, 150) // 150ms debounce (same as asciinema)

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
      }
    }
  }, [timelineSync, currentTime, timelineStartTime, playbackMode, fetchChunksUpToTime, getAbsoluteTimeFromTimeline, terminalResult.chunks])

  // Determine which chunks to use
  const displayChunks = useMemo(() => {
    if (!timelineSync || playbackMode === 'live') {
      return terminalResult.chunks // Use all chunks when not syncing
    }
    return timelineChunks.length > 0 ? timelineChunks : terminalResult.chunks
  }, [timelineSync, playbackMode, timelineChunks, terminalResult.chunks])

  return {
    ...terminalResult,
    chunks: displayChunks,
    timelineChunks: displayChunks,
    isTimelineSync: timelineSync && playbackMode !== 'live',
    isFetchingTimeline,
  }
}
