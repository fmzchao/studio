# Terminal Live Console Streaming – Phase Plan

Goal: deliver low-latency, PTY-accurate Docker console streaming with archival replay. This plan breaks the work into focused phases so we can ship incrementally without disrupting existing JSON parsers or Loki logging.

## Phase 1 – SDK + Worker PTY Capture (Foundations) ✅ *Completed*

**Objectives**
- Introduce a `terminalCollector` surface in `@shipsec/component-sdk` without changing existing logger/logCollector semantics.
- Add a PTY-aware Docker runner that can emit raw byte chunks alongside the current line-buffered outputs, but gate it behind feature flags so components keep working.
- Define the canonical chunk payload (`runId`, `nodeRef`, `stream`, `chunkIndex`, `payload(base64)`, `recordedAt`, `deltaMs`, `origin`, `runnerKind`).

**Tasks**
1. Extend SDK types (`TerminalChunkInput`) and `createExecutionContext` to accept an optional `terminalCollector`.
2. Update `runComponentWithRunner` to support dual mode:
   - Default: current `spawn` behaviour for stability.
   - PTY mode: use `node-pty`, copy raw data into chunks, still route flushed lines through `logCollector` so Loki remains populated.
3. Add worker configuration (env / feature flag) to toggle PTY emission per component or per run.
4. Unit tests for chunk metadata ordering, base64 encoding, and backwards compatibility with existing logger/logCollector flows.

**Exit Criteria**
- Worker can emit terminal chunks to an in-memory collector with deterministic chunk indices.
- Components continue to receive parseable stdout/stderr in legacy mode.

## Phase 2 – Redis Hot Path Transport ✅ *Completed*

**Objectives**
- Stream terminal chunks through Redis Streams for low-latency fan-out and resumable cursors.
- Introduce a worker-side terminal adapter that pushes chunks to Redis and publishes EOF markers per node.

**Tasks**
1. Add `ioredis` dependency to worker + backend; create a connection factory honoring env vars (`REDIS_URL`, TLS, auth).
2. Implement `RedisTerminalStreamAdapter` in the worker:
   - Key shape: `terminal:{runId}:{nodeRef}:{stream}`.
   - Payload: packed chunk JSON (payload base64, metadata).
   - Enforce length limits with `XTRIM` or `MAXLEN ~`.
3. Extend `run-component.activity` to pass a `terminalCollector` that forwards to Redis adapter whenever PTY mode is on.
4. Add monitoring/logging for write failures and backpressure handling (pause PTY if Redis is unavailable or queue > threshold).
5. Integration test using Redis docker container verifying stream write + resume semantics.

**Exit Criteria**
- Live Docker nodes push chunks into Redis Streams with monotonic IDs.
- Worker detects write failures and downgrades gracefully (logs warning + disables PTY).

## Phase 3 – Backend Live Fan-Out + Cursor API ✅ *Completed*

**Objectives**
- Consume Redis Streams from the backend and expose chunks via SSE/WebSocket alongside existing trace events.
- Provide API contracts for clients to request historical chunks (`afterChunk`, `limit`).

**Tasks**
1. Implement a NestJS provider that runs a Redis consumer group per run/node, pulling chunks and rebroadcasting them to connected clients.
2. Extend `/workflows/runs/:runId/stream` to emit a new `terminal` event type (`{ nodeRef, stream, chunkIndex, payload, recordedAt }`). Include cursors so clients can resume (`cursor=chunkIndex` maps to Redis IDs).
3. Add `GET /workflows/runs/:runId/terminal/:nodeRef` endpoint returning paginated chunks (pulling from Redis if available; fallback to archive when added).
4. Update authentication/authorization guards so Redis-derived events respect org scoping.
5. Document SSE contract in `docs/execution-contract.md`.

**Exit Criteria**
- Backend streams PTY chunks with <150 ms latency in dev stack.
- API consumers can request historical chunks via REST without touching Redis directly.

## Phase 4 – Cast File Archival & Indexing ✅ *Completed*

**Objectives**
- Persist per-node replay files (cast-like JSON) to object storage (MinIO/S3) while runs execute.
- Maintain an index table in Postgres linking `runId + nodeRef + stream` to the stored file, duration, and chunk count.

**Tasks**
1. Design cast file schema (header + `[deltaSeconds, stream, base64Payload]` entries). Support partial flushes so we can stream to storage as chunks arrive.
2. Create `workflow_terminal_records` table storing `run_id`, `node_ref`, `stream`, `file_url`, `chunk_count`, `duration_secs`, `first_chunk_index`, `last_chunk_index`, `created_at`, `completed_at`.
3. Implement a backend or worker-side archival service:
   - Subscribes to Redis streams.
   - Appends chunks to the cast file (either via streaming upload or local temp file + upload).
   - Updates index rows incrementally.
   - Handles finalization (write metadata + EOF marker when node completes).
4. Provide retention hooks (configurable TTL for Redis stream trimming once archival is confirmed).
5. Integration test verifying that a completed run produces a downloadable cast file with accurate timeline.

**Exit Criteria**
- Each docker-backed node yields a downloadable replay file stored in MinIO/S3.
- Redis streams are trimmed once archival confirms persistence.

## Phase 5 – Frontend Terminal Player (Live + Replay) ✅ *Completed*

**Objectives**
- Introduce an `xterm.js`-based terminal panel that consumes the new SSE events and can replay cast files.

**Tasks**
1. Build a React hook (`useTerminalStream`) that hydrates historical chunks (REST) then subscribes to SSE/WebSocket for live frames. Manage chunk cursors and reconnect logic.
2. Integrate `xterm.js` into the run inspector or timeline UI with tabs per docker node (stderr highlighting, pause/autoscroll, copy/download buttons).
3. Add a replay mode that fetches the cast file and plays it locally; allow jumping to timestamps and exporting `.cast`.
4. Telemetry: log when users view terminal, download cast, or encounter gaps.
5. Frontend tests (Vitest + Playwright) covering hydration, live streaming, and replay switching.

**Exit Criteria**
- Users can watch live docker output with colour/TTY fidelity and replay completed nodes from stored files.
- UI gracefully handles reconnects and cross-node navigation.

### **✅ Phase 5 Achievements (Beyond Original Scope)**
- Interactive Node.js terminal component with carriage return progress bars
- Redis infrastructure for reliable terminal streaming
- **Timing-aware dual-mode rendering**: Live (immediate) vs Replay (deltaMs delays)
- Comprehensive terminal streaming tests and validation
- 44 PTY chunks with perfect timing preservation (200ms progress intervals)
- Proper carriage return handling for line rewriting animations

## Phase 6 – Timeline-Terminal Synchronization (Magic Experience) 🚧 *Next Phase*

**Objective**: Enable **timeline-synchronized terminal playback** where users can scrub through the execution timeline and see terminal output dynamically update to match the exact point in time.

### 🎯 Core Experience Goals

1. **Scrubbing Through Time**: When users drag the timeline scrubber, terminal output instantly updates to show what was being printed at that exact moment
2. **Progress Bar Animation**: Timeline playback animates progress bars in perfect sync with the original execution timing
3. **Multi-Node Coordination**: Each workflow node's terminal updates independently based on its own timeline position
4. **Seamless Integration**: Timeline and terminal systems work together without conflicts

### 📋 Technical Implementation Plan

#### **Phase 6.1 – Time Mapping Foundation (Week 1)**

**Objective**: Create unified time system between timeline and terminal data

**Tasks**:
1. **Timeline-Absolute Time Mapping**
   ```typescript
   // Map timeline relative time to absolute timestamps
   const getAbsoluteTimeFromTimeline = (timelineMs: number, workflowStart: Date): Date => {
     return new Date(workflowStart.getTime() + timelineMs);
   };

   // Map timeline position to terminal query range
   const getTerminalQueryRange = (timelineMs: number, windowMs: number = 5000): {
     startTime: Date,
     endTime: Date,
   } => {
     const workflowStart = executionTimeline[0]?.timestamp;
     const absoluteTime = getAbsoluteTimeFromTimeline(timelineMs, workflowStart);

     return {
       startTime: new Date(absoluteTime.getTime() - windowMs),
       endTime: absoluteTime,
     };
   };
   ```

2. **Enhanced Terminal API**
   - Extend `/api/v1/workflows/runs/{runId}/terminal` with time range parameters
   - Add `startTime` and `endTime` query parameters
   - Implement efficient time-based filtering in backend
   ```typescript
   // New API endpoint
   GET /api/v1/workflows/runs/{runId}/terminal?nodeRef={nodeRef}&stream={stream}&startTime={iso}&endTime={iso}
   ```

3. **Terminal Time Index**
   - Create database index on `recordedAt` timestamps for fast time-range queries
   - Optimize terminal chunk retrieval by time window
   - Add caching for frequently accessed time ranges

#### **Phase 6.2 – Event Coordination System (Week 2)**

**Objective**: Connect timeline position changes to terminal updates

**Tasks**:
1. **Timeline Event System**
   ```typescript
   // Timeline position change events
   interface TimelineSeekEvent {
     type: 'timeline:seek';
     currentTimeMs: number;
     isPlaying: boolean;
   }

   // Terminal update coordination
   interface TerminalUpdateEvent {
     type: 'terminal:update';
     nodeRef: string;
     stream: 'pty' | 'stdout' | 'stderr';
     timeRange: { startTime: Date; endTime: Date };
   }
   ```

2. **Pub/Sub Integration**
   - Implement event bus between timeline and terminal components
   - Use React Context or custom event emitter for coordination
   - Add debouncing to prevent excessive terminal updates during scrubbing

3. **Terminal Panel Extensions**
   ```typescript
   // Extend NodeTerminalPanel to support time-aware mode
   interface NodeTerminalPanelProps {
     nodeId: string;
     runId: string | null;
     timelinePosition?: number; // New: timeline sync position
     timelineMode?: boolean; // New: enable timeline-aware mode
     onClose: () => void;
   }
   ```

#### **Phase 6.3 – Dynamic Terminal Filtering (Week 3)**

**Objective**: Implement time-based terminal content filtering and rendering

**Tasks**:
1. **Timeline-Aware Terminal Hook**
   ```typescript
   // New hook for timeline-synchronized terminals
   export function useTimelineTerminalStream({
     runId,
     nodeId,
     stream = 'pty',
     timelineMs,
     windowMs = 5000,
   }: {
     runId: string;
     nodeId: string;
     stream?: 'pty' | 'stdout' | 'stderr';
     timelineMs: number;
     windowMs?: number;
   }): {
     chunks: TerminalChunk[];
     isLoading: boolean;
     error: string | null;
   }
   ```

2. **Smart Content Windowing**
   - Show terminal content from `timelineMs - windowMs` to `timelineMs`
   - Implement configurable window size (default: 5 seconds)
   - Add "context" around current time for better user experience

3. **Scroll Position Management**
   - Auto-scroll to show content at timeline position
   - Maintain scroll position relative to timeline
   - Add manual scroll override options

#### **Phase 6.4 – Performance Optimizations (Week 4)**

**Objective**: Ensure smooth timeline scrubbing performance

**Tasks**:
1. **Intelligent Caching**
   - Cache terminal chunks by time ranges
   - Pre-fetch adjacent time windows during playback
   - Implement LRU cache for terminal time windows

2. **Debouncing and Throttling**
   - Debounce timeline position changes during rapid scrubbing
   - Throttle terminal API calls to prevent overload
   - Add progressive loading for large terminal sessions

3. **Memory Management**
   - Limit terminal buffer size during timeline mode
   - Implement virtual scrolling for very large terminal outputs
   - Clean up unused time ranges from cache

### 🎮 User Experience Flow

#### **Timeline Scrubbing Experience**:
1. **User drags timeline scrubber** → Timeline position updates
2. **Timeline emits seek event** → All terminal panels receive update
3. **Each terminal queries chunks for its time range** → Backend filters by `recordedAt`
4. **Terminal updates instantly** → Progress bars show state at timeline position
5. **Smooth transitions** → Carriage returns work perfectly during scrubbing

#### **Timeline Playback Experience**:
1. **User hits play** → Timeline starts advancing
2. **Terminal panels animate in sync** → Progress bars update with real timing
3. **Multi-node coordination** → Each terminal updates based on its own schedule
4. **Pause/Resume** → Timeline and terminals pause/resume together

### 🔧 Implementation Architecture

```
Timeline Component
    ↓ (currentTimeMs changes)
Event Bus (timeline:seek events)
    ↓ (time range calculation)
Terminal Panels
    ↓ (API calls with time ranges)
Backend API
    ↓ (filter by recordedAt timestamps)
Database (indexed by recordedAt)
    ↓ (filtered chunks)
Frontend Rendering (carriage returns + timing)
```

### 📊 Success Metrics

#### **Technical Metrics**:
- **Sub-100ms response time** for timeline position → terminal update
- **Smooth 60fps timeline scrubbing** without terminal lag
- **Memory usage < 100MB** for large terminal sessions
- **API response time < 200ms** for time-range queries

#### **User Experience Metrics**:
- **Instant visual feedback** during timeline scrubbing
- **Perfect progress bar synchronization** with original execution
- **Intuitive timeline-terminal coordination**
- **No jarring transitions** between different time positions

### 🚀 Acceptance Criteria

#### **Core Functionality**:
- [ ] Timeline scrubbing instantly updates terminal output
- [ ] Progress bars animate smoothly during timeline playback
- [ ] Carriage returns work perfectly during time navigation
- [ ] Multiple nodes update independently based on timeline position

#### **Performance Requirements**:
- [ ] Timeline scrubbing maintains 60fps performance
- [ ] Terminal updates complete within 100ms of timeline change
- [ ] Memory usage scales linearly with terminal content size
- [ ] No memory leaks during extended timeline scrubbing sessions

#### **Edge Cases**:
- [ ] Empty terminal content before first timeline event
- [ ] Terminal content after last timeline event
- [ ] Rapid timeline scrubbing (debouncing works)
- [ ] Timeline jumps to distant time positions
- [ ] Network failures during timeline-terminal sync

#### **Integration Requirements**:
- [ ] Timeline controls work seamlessly with terminal updates
- [ ] Existing live/replay modes continue to work
- [ ] Terminal export/download functions work in timeline mode
- [ ] Multi-stream (pty/stdout/stderr) switching works during timeline mode

### 💭 Future Enhancements

#### **Phase 6.5 – Advanced Timeline Features** (Future)

1. **Time Machine Mode**
   - Full terminal state at any timeline position
   - Rewind/fast-forward with perfect preservation
   - Branching timeline support

2. **Comparative Timeline Analysis**
   - Side-by-side terminal comparison for different runs
   - Timeline synchronization across multiple workflow executions
   - Diff visualization between terminal states

3. **Interactive Timeline Debugging**
   - Click on terminal output to jump to corresponding timeline position
   - Timeline annotations linked to terminal events
   - Performance metrics overlay on timeline

**This phase transforms terminal viewing from static replay into an interactive, timeline-synchronized experience that provides unprecedented insight into workflow execution dynamics.** 🎯

## Phase 6 – Hardening & Observability

**Objectives**
- Ensure the pipeline is resilient, observable, and easy to operate in prod.

**Tasks**
1. Metrics & alerts: capture PTY chunk throughput, Redis lag, archival backlog, SSE latency.
2. Backpressure strategies: configurable thresholds that pause PTY or spill to file when Redis/MinIO is slow.
3. Security review: ensure Redis credentials are scoped, cast files inherit run-level ACLs, and downloads respect org authorization.
4. Documentation updates (`.ai/temporal-worker-architecture.md`, `.ai/component-sdk.md`, `docs/execution-contract.md`) describing the new terminal pipeline and troubleshooting steps.

**Exit Criteria**
- Dashboard and alerts cover each stage (worker capture, Redis, backend fan-out, archival).
- Runbooks describe failure modes and recovery (Redis outage, archival lag, SSE congestion).

---

This plan prioritizes preserving current behaviour while layering in the new PTY experience. Each phase ends with reviewable deliverables, so we can pause after any stage if priorities shift. Let me know if you want to tweak scope or reorder phases before implementation.
