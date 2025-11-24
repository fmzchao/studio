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
  
  // Use separate selectors to avoid creating new objects on every render
  const playbackMode = useExecutionTimelineStore((state) => state.playbackMode)
  
  // Only disable autoConnect if timelineSync is enabled AND we're not in live mode
  // In live mode, we always want autoConnect to work for real-time streaming
  const shouldAutoConnect = timelineSync && playbackMode !== 'live' 
    ? false  // Disable autoConnect in timeline sync mode (replay)
    : terminalOptions.autoConnect !== false  // Use original autoConnect value (defaults to true)
  
  const terminalResult = useTerminalStream({
    ...terminalOptions,
    autoConnect: shouldAutoConnect,
  })
  
  // Use separate selectors to avoid creating new objects on every render
  const currentTime = useExecutionTimelineStore((state) => state.currentTime)
  const timelineStartTime = useExecutionTimelineStore((state) => state.timelineStartTime)

  const [timelineChunks, setTimelineChunks] = useState<typeof terminalResult.chunks>([])
  const [isFetchingTimeline, setIsFetchingTimeline] = useState(false)
  const lastFetchTimeRef = useRef<number | null>(null)
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const cachedChunksRef = useRef<Map<number, typeof terminalResult.chunks>>(new Map())
  const lastTimelineChunksRef = useRef<typeof terminalResult.chunks>([])

  // Helper to set timeline chunks only if they actually changed
  const setTimelineChunksIfChanged = useCallback((newChunks: typeof terminalResult.chunks) => {
    // Compare by length and last chunk index to avoid unnecessary updates
    const lastChunks = lastTimelineChunksRef.current
    if (
      lastChunks.length !== newChunks.length ||
      lastChunks[lastChunks.length - 1]?.chunkIndex !== newChunks[newChunks.length - 1]?.chunkIndex
    ) {
      lastTimelineChunksRef.current = newChunks
      setTimelineChunks(newChunks)
    }
  }, [])

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
        setTimelineChunksIfChanged(merged)
      } else if (allChunks.length > 0) {
        setTimelineChunksIfChanged(allChunks)
      } else {
        setTimelineChunksIfChanged(result.chunks)
      }
    } catch (error) {
      console.error('[useTimelineTerminalStream] Failed to fetch chunks for timeline', error)
      // Fallback: don't set chunks on error, let it use existing terminalResult.chunks
    } finally {
      setIsFetchingTimeline(false)
    }
  }, [terminalOptions.runId, terminalOptions.nodeId, terminalOptions.stream, timelineStartTime, getAbsoluteTimeFromTimeline])

  // Store terminalResult.chunks in a ref to avoid dependency issues
  const terminalChunksRef = useRef(terminalResult.chunks)
  useEffect(() => {
    terminalChunksRef.current = terminalResult.chunks
  }, [terminalResult.chunks])

  // Update terminal when timeline position changes (in timeline sync mode)
  useEffect(() => {
    if (!timelineSync || playbackMode === 'live') {
      // Not in sync mode - use regular chunks
      setTimelineChunksIfChanged([])
      return
    }

    if (!timelineStartTime) {
      return // Can't sync without timeline start time
    }

    // Handle timeline updates
    // We separate the logic for "fetching new data" (expensive, needs debounce/throttle)
    // from "updating view from cache" (cheap, should be immediate)
    
    // 1. Immediate update from cache if possible
    const updateFromCache = () => {
      const targetAbsoluteTime = getAbsoluteTimeFromTimeline(currentTime)
      const startAbsoluteTime = timelineStartTime ? new Date(timelineStartTime) : null

      if (targetAbsoluteTime && startAbsoluteTime) {
        const currentChunks = terminalChunksRef.current
        
        // Filter chunks that are within the time range
        // This is fast enough to run on every frame for reasonable chunk counts
        const filtered = currentChunks.filter((chunk) => {
          const recordedAt = new Date(chunk.recordedAt)
          return recordedAt >= startAbsoluteTime && recordedAt <= targetAbsoluteTime
        })

        setTimelineChunksIfChanged(filtered)
      }
    }

    // 2. Network fetch management
    const checkAndFetch = () => {
      const timeDiff = lastFetchTimeRef.current
        ? Math.abs(currentTime - lastFetchTimeRef.current)
        : Infinity

      // If we moved significantly (seeking) or haven't fetched yet, fetch from API
      // We use a threshold of 500ms to avoid fetching too often during playback
      // but ensure we fetch when seeking or when playback moves into new territory
      if (timeDiff > 500 || lastFetchTimeRef.current === null) {
        console.log('[useTimelineTerminalStream] Fetching chunks from API', {
          currentTimeMs: currentTime,
          timeDiff,
        })
        void fetchChunksUpToTime(currentTime)
        lastFetchTimeRef.current = currentTime
      }
    }

    // Main effect logic
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current)
    }

    // Always try to update from cache immediately for smooth playback
    updateFromCache()

    // Debounce the network fetch check
    // This allows "scrubbing" to settle before triggering a fetch
    // But during playback, we want to check periodically
    debounceTimeoutRef.current = setTimeout(() => {
      checkAndFetch()
    }, 100)

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
      }
    }
  }, [timelineSync, currentTime, timelineStartTime, playbackMode, fetchChunksUpToTime, getAbsoluteTimeFromTimeline, setTimelineChunksIfChanged])

  // Determine which chunks to use
  // In live mode or when not syncing, use terminalResult.chunks directly (always fresh)
  // In timeline sync mode (replay), use filtered timelineChunks
  // CRITICAL: When timelineSync is true, NEVER use terminalResult.chunks - only use timelineChunks
  // This prevents double rendering (regular stream + timeline sync)
  const displayChunks = useMemo(() => {
    // If timelineSync is enabled, ALWAYS use timeline-synced chunks, never regular stream chunks
    if (timelineSync) {
      // In timeline sync mode, use timelineChunks (filtered by time) or filter terminalResult.chunks
      if (timelineChunks.length > 0) {
        // CRITICAL: Filter timelineChunks by target time - API might return chunks beyond target
        const targetAbsoluteTime = timelineStartTime ? timelineStartTime + currentTime : null
        const filtered = targetAbsoluteTime
          ? timelineChunks.filter((chunk) => {
              const chunkTime = new Date(chunk.recordedAt).getTime()
              return chunkTime <= targetAbsoluteTime
            })
          : timelineChunks
        
        console.log('[useTimelineTerminalStream] displayChunks - using timelineChunks (filtered)', {
          timelineChunksCount: timelineChunks.length,
          filteredCount: filtered.length,
          currentTimeMs: currentTime,
          timelineStartTime: timelineStartTime ? new Date(timelineStartTime).toISOString() : null,
          targetAbsoluteTime: targetAbsoluteTime ? new Date(targetAbsoluteTime).toISOString() : null,
          chunkIndices: filtered.map(c => c.chunkIndex),
        })
        return filtered
      }
      
      // Fallback: filter terminalResult.chunks by time if timelineStartTime is available
      if (timelineStartTime && currentTime >= 0) {
        const targetAbsoluteTime = getAbsoluteTimeFromTimeline(currentTime)
        if (targetAbsoluteTime) {
          const startAbsoluteTime = new Date(timelineStartTime)
          const filtered = terminalResult.chunks.filter((chunk) => {
            const recordedAt = new Date(chunk.recordedAt)
            return recordedAt >= startAbsoluteTime && recordedAt <= targetAbsoluteTime
          })
          
          console.log('[useTimelineTerminalStream] displayChunks - filtering terminalResult.chunks', {
            currentTimeMs: currentTime,
            startAbsoluteTime: startAbsoluteTime.toISOString(),
            targetAbsoluteTime: targetAbsoluteTime.toISOString(),
            totalChunks: terminalResult.chunks.length,
            filteredChunks: filtered.length,
            chunkIndices: filtered.map(c => c.chunkIndex),
          })
          
          return filtered
        }
      }
      
      // Last resort: return empty array if we can't filter (shouldn't happen in timeline sync mode)
      console.warn('[useTimelineTerminalStream] displayChunks - no chunks available, returning empty', {
        timelineSync,
        playbackMode,
        timelineChunksCount: timelineChunks.length,
        terminalResultChunksCount: terminalResult.chunks.length,
        currentTimeMs: currentTime,
        timelineStartTime,
      })
      
      return []
    }
    
    // When NOT in timeline sync mode, use regular stream chunks
    if (playbackMode === 'live') {
      // In live mode, always use terminalResult.chunks directly for real-time updates
      return terminalResult.chunks
    }
    
    // Regular replay mode (not timeline sync) - use terminalResult.chunks
    return terminalResult.chunks
  }, [timelineSync, playbackMode, timelineChunks, terminalResult.chunks, currentTime, timelineStartTime, getAbsoluteTimeFromTimeline])

  // When timeline sync is active, completely disable regular stream mode updates
  // to prevent double rendering (regular stream + timeline sync)
  const finalMode = timelineSync && playbackMode !== 'live' ? 'replay' : terminalResult.mode
  
  return {
    ...terminalResult,
    chunks: displayChunks,
    timelineChunks: displayChunks,
    mode: finalMode,
    isTimelineSync: timelineSync && playbackMode !== 'live',
    isFetchingTimeline,
  }
}
