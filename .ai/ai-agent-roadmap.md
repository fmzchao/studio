# ShipSec Studio – AI Agent Roadmap

This roadmap tracks how we evolve the `core.ai.agent` component from a model-only assistant into a fully instrumented, tool-using operator inside ShipSec Studio. Phase 1 landed the Agent Trace tab, persisted reasoning/tool data on run completion, and delivered the React cards that surfaced Thought/Action/Observation history—now we are pivoting entirely to the official Vercel AI SDK transport so the UI, backend, and worker all speak the same protocol.

**Completed so far:** the worker emits canonical AI SDK parts for every agent, Kafka persists those parts into `agent_trace_events`, backend exposes `/agents/:agentRunId/{parts,chat}` for live and replay streaming, and the frontend now hydrates/streams agent traces through `useChat` with the official AI SDK UI patterns instead of bespoke cards.

## Progress Overview

| Phase | Status | Description |
|-------|--------|-------------|
| Phase 1 | ✅ Complete | Legacy Agent Trace UI on stored outputs |
| Phase 2 | 🟡 In Progress | AI SDK stream transport + storage ledger |
| Phase 3 | 🟡 In Progress | Full AI SDK UI adoption & legacy removal |

---

## Phase 2 – AI SDK Stream Transport

**Goal:** Replace the bespoke `agent_event` bus with the official AI SDK UI message stream across worker, backend, and frontend while preserving historical storage.

> **Update — 2025‑11‑30:** Worker now emits AI SDK–compatible agent trace parts (message start, reasoning deltas, tool IO, finish) and ships them to a dedicated Kafka topic (`telemetry.agent-trace`). Backend ingest writes those parts into the new `agent_trace_events` ledger table, so we have a clean store keyed by `agentRunId`. The Agent component exposes that run ID for downstream consumers.

### Worker
- [x] Wrap `core.ai.agent` execution in the AI SDK streaming helpers (`streamText`/`createStreamableUI`) so reasoning steps, tool IO, and final responses are emitted as UI message parts.
- [x] Persist every emitted part (type, payload, timestamp, nodeRef, sequence) through a dedicated Kafka publisher so `agent_trace_events` becomes the canonical ledger for live + replay streams.
- [ ] Remove bespoke `agent_event` enums once the AI SDK part emitter is stable.

### Backend
- [x] Add `POST /api/v1/agents/:agentRunId/chat` that proxies the worker result and returns `result.toUIMessageStreamResponse()` for live runs.
- [x] Add `/api/v1/agents/:agentRunId/stream` (SSE) and `/api/v1/agents/:agentRunId/parts` that read from the new repository and stream/return stored UI message parts in order with cursor metadata.
- [x] Fully remove the legacy `/api/v1/agents/:runId/stream` path from backend code, OpenAPI, and the generated client in favor of the new agentRunId routes.

### Frontend
- [x] Replace the bespoke run-level `/agents/:runId/stream` logic with per-agent streams built on `/agents/:agentRunId/{parts,stream}` so each node renders its own trace from the new backend ledger.
- [x] Swap the remaining custom UI with `useChat`/AI SDK components pointed at `/agents/:agentRunId/chat`, using `/parts` for initial hydration.
- [x] Ensure replay/seeker controls reset the hook and re-stream stored parts when the user scrubs.

**Success criteria**
- [ ] Live runs stream through the AI SDK protocol end-to-end and render via official components.
- [ ] Historical runs replay by streaming the stored parts and appear identical to the live experience.
- [ ] No code references `agent_event`, `useAgentStream`, or custom SSE parsers.

---

## Phase 3 – AI SDK UI Adoption & Legacy Retirement

**Goal:** Fully align the Studio UX with AI SDK’s UI toolkit and delete the legacy transport/UI surface.

### Deletions & Refactors
- [x] Delete the bespoke agent stream hook (`frontend/src/hooks/useAgentTraces.ts`) and any SSE-specific utils.
- [x] Remove backend polling loops/heartbeat logic tied to the legacy `/stream` endpoint.
- [ ] Strip `agentEvent` handling from TraceService consumers; only AI SDK part types remain.

### Frontend Adoption
- [x] Swap bespoke Agent Trace cards with the AI SDK conversation components so future upgrades (tool drawers, reasoning chips) are inherited automatically.
- [ ] Hook ExecutionInspector’s replay controls into the `/replay` endpoint to rebuild state when the user scrubs or jumps to a node.
- [ ] Update docs/Runbooks to reference the new endpoints and controls.

**Success criteria**
- [ ] `git grep` shows no references to the legacy stream plumbing.
- [ ] Designers can drop in AI SDK UI blocks anywhere in Studio without adapter shims.
- [ ] Replay, seek, and historical audit features operate entirely on the stored AI SDK parts.

---

## Long-Tail Enhancements

- [ ] **Agent analytics:** PostHog metrics for tool latency, success rate, and per-step errors.
- [ ] **Replay controls:** Jump to a specific agent step from the timeline scrubber.
- [ ] **Audit trails:** Persist full agent transcripts (thoughts + tool IO) for compliance with redaction options.
- [ ] **Safety harness:** Add policy checks (allowed tool list, token budgets) before each tool call.

Document owners should update this file whenever a phase status or deliverable changes. Refer back to `.ai/implementation-plan.md` for shared observability context and `.ai/visual-execution-notes.md` for daily findings.
