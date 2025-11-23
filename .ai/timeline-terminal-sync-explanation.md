# Timeline-Terminal Synchronization: How It Works

## The Core Problem

When a user scrubs through the timeline (drags the scrubber back and forth), we need to show the terminal output **exactly as it appeared at that moment in time**. This is tricky because:

1. **Terminal state is cumulative** - Each chunk builds on previous chunks (like typing characters)
2. **Progress bars use carriage returns** - They rewrite the same line over and over
3. **We can't just "show chunks up to time X"** - We need to rebuild the entire terminal state

## How Asciinema/Cast Files Work (Inspiration)

### Cast File Format
```json
{"version": 2, "width": 80, "height": 24}
[0.0, "o", "Hello "]
[0.5, "o", "World"]
[1.0, "o", "\r\n"]
[1.2, "o", "[Progress: 10%]"]
[1.4, "o", "\r[Progress: 20%]"]
```

**Key insight**: Each line is `[timestamp_delta, stream_type, payload]`
- `timestamp_delta`: Seconds since start (or since last chunk)
- `stream_type`: "o" (stdout), "e" (stderr), "i" (stdin)
- `payload`: Raw bytes (base64 encoded)

### How Replay Works

1. **Start with empty terminal** - Clear screen
2. **Apply chunks in order** - Write each payload at the correct time
3. **Carriage returns work naturally** - `\r` moves cursor back, overwrites line
4. **Jumping to timestamp**: 
   - Clear terminal
   - Apply all chunks up to that timestamp
   - Resume from there

## Our Implementation Strategy

### Current Data Structure

We have:
- **Redis Streams** (live): Chunks with `recordedAt` timestamps and `deltaMs`
- **Cast Files** (archived): JSON lines with `[deltaSeconds, stream, base64Payload]`
- **Timeline**: Events with `offsetMs` (relative to workflow start)

### The Challenge: Terminal State Reset

**Problem**: When user scrubs from 10s → 5s → 15s:
- At 10s: Terminal shows progress bar at 50%
- User scrubs to 5s: Need to show progress bar at 25%
- User scrubs to 15s: Need to show progress bar at 75%

**Solution**: **Rebuild terminal state from scratch** each time timeline position changes.

### Implementation Approach

#### Option 1: Full Rebuild (Recommended)
```
When timeline position changes:
1. Clear terminal completely (terminal.clear())
2. Fetch all chunks from start to current timeline position
3. Apply chunks in order (respecting deltaMs for timing)
4. Terminal shows exact state at that moment
```

**Pros**:
- ✅ Always accurate - terminal state matches timeline exactly
- ✅ Works with carriage returns - they naturally overwrite
- ✅ Simple to reason about - no state management complexity

**Cons**:
- ⚠️ Requires fetching/processing all chunks up to position
- ⚠️ Can be slow for very long terminal outputs

#### Option 2: Incremental Updates (Complex)
```
Track terminal state, apply diffs:
- If going forward: Apply new chunks
- If going backward: Rollback to checkpoint, reapply forward
```

**Pros**:
- ✅ Potentially faster for small jumps

**Cons**:
- ❌ Complex state management
- ❌ Hard to handle carriage returns correctly
- ❌ Checkpoint management overhead

### Recommended: Full Rebuild with Smart Caching

```typescript
// Pseudo-code
function renderTerminalAtTime(timelineMs: number) {
  // 1. Clear terminal
  terminal.clear()
  
  // 2. Calculate absolute time
  const absoluteTime = workflowStartTime + timelineMs
  
  // 3. Fetch chunks up to this time
  const chunks = await fetchChunks({
    startTime: workflowStartTime,
    endTime: absoluteTime
  })
  
  // 4. Apply chunks in order (fast-forward, no delays)
  for (const chunk of chunks) {
    terminal.write(decodeBase64(chunk.payload))
  }
  
  // Terminal now shows exact state at timelineMs
}
```

### Timeline Scrubbing Behavior

**During Scrubbing** (user dragging):
- **Debounce API calls** (wait 150ms after last movement)
- **Show loading indicator** while fetching
- **Clear and rebuild** terminal state

**During Playback** (timeline playing):
- **Update terminal continuously** as timeline advances
- **Apply chunks with timing** (respect deltaMs for smooth animation)
- **Progress bars animate naturally**

### Key Implementation Details

#### 1. Time Mapping
```typescript
// Timeline position (relative to workflow start)
const timelineMs = 5000 // 5 seconds into workflow

// Convert to absolute timestamp
const workflowStartTime = new Date(runStatus.startedAt)
const absoluteTime = new Date(workflowStartTime.getTime() + timelineMs)

// Query terminal chunks
const chunks = await api.getTerminalChunks(runId, {
  nodeRef: 'node-1',
  startTime: workflowStartTime,
  endTime: absoluteTime
})
```

#### 2. Terminal State Reset
```typescript
// When timeline position changes significantly
if (Math.abs(newTime - lastRenderedTime) > 100) {
  // Clear terminal
  terminalRef.current.clear()
  lastRenderedChunkIndex.current = -1
  
  // Fetch and render chunks up to new time
  await renderTerminalAtTime(newTime)
}
```

#### 3. Progress Bar Handling
Progress bars work perfectly because:
- Carriage return (`\r`) moves cursor to start of line
- New text overwrites old text
- When we rebuild from scratch, we naturally get the correct state

Example:
```
Chunk 1: "[Progress: 10%]\r"
Chunk 2: "[Progress: 20%]\r"
Chunk 3: "[Progress: 30%]\r"

At timeline position = chunk 2 time:
Terminal shows: "[Progress: 20%]"
```

#### 4. Performance Optimizations

**Caching Strategy**:
- Cache chunks by time ranges (e.g., 0-5s, 5-10s, 10-15s)
- Pre-fetch adjacent ranges during playback
- Clear cache when memory limit reached

**Debouncing**:
- During scrubbing: Wait 150ms after last movement
- During playback: Update every 100ms (or on each timeline tick)

**Smart Fetching**:
- If going forward: Only fetch new chunks since last position
- If going backward: Always rebuild from start (simpler, more reliable)

## Example Flow

### Scenario: User scrubs timeline from 10s → 5s → 15s

1. **Initial state** (timeline at 10s):
   - Terminal shows: `[Progress: 50%]`
   - Chunks rendered: 1-100

2. **User scrubs to 5s**:
   - Timeline emits `seek(5000)`
   - Terminal hook detects change
   - **Clear terminal** (`terminal.clear()`)
   - Fetch chunks: `startTime=workflowStart, endTime=workflowStart+5s`
   - Apply chunks 1-50 in order
   - Terminal shows: `[Progress: 25%]`

3. **User scrubs to 15s**:
   - Timeline emits `seek(15000)`
   - Terminal hook detects change
   - **Clear terminal** (`terminal.clear()`)
   - Fetch chunks: `startTime=workflowStart, endTime=workflowStart+15s`
   - Apply chunks 1-150 in order
   - Terminal shows: `[Progress: 75%]`

### During Playback

1. **Timeline playing** (advancing from 0s → 20s):
   - Timeline ticks every 100ms
   - Terminal updates every 100ms (or on each tick)
   - Chunks applied with timing delays (deltaMs)
   - Progress bar animates smoothly

2. **User pauses at 10s**:
   - Timeline stops
   - Terminal shows exact state at 10s
   - Can scrub back/forth from here

## Why This Works

1. **Terminal is stateless** - Each rebuild starts fresh
2. **Chunks are ordered** - Applying in order gives correct state
3. **Carriage returns work** - They naturally overwrite previous content
4. **Time-based queries** - Backend filters chunks by `recordedAt` timestamp
5. **Cast files compatible** - Same approach works for archived data

## Edge Cases Handled

- **Empty terminal** (before first chunk): Shows empty terminal
- **Terminal after last chunk**: Shows final state
- **Rapid scrubbing**: Debouncing prevents excessive API calls
- **Network failures**: Graceful degradation, show cached data
- **Very long outputs**: Virtual scrolling, limit rendered chunks

## Summary

**Key Principle**: **Rebuild terminal state from scratch** when timeline position changes.

**How**:
1. Clear terminal
2. Fetch chunks up to timeline position
3. Apply chunks in order
4. Terminal shows exact state at that moment

**Why it works**:
- Terminal output is cumulative (each chunk builds on previous)
- Carriage returns naturally handle line rewriting
- Time-based queries give us exact chunks for any timestamp
- Cast file format supports this approach perfectly

This is simpler and more reliable than trying to manage incremental state updates!

