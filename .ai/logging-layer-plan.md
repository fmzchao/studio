# Logging Layer Plan

## Goals
- Decouple worker components from storage backends (Postgres/Loki) by introducing a Kafka-compatible bus (Redpanda initially).
- Provide a dedicated logging pipeline (structured + leveled) separate from lifecycle events.
- Lay the groundwork to move lifecycle events and custom streams onto the same bus later.

## Phase 1 – Provision Redpanda
1. Extend `docker/docker-compose.infra.yml` (or a new compose file) with a Redpanda service + console UI.
2. Add env/config entries (`TELEMETRY_BROKER_URL`, `TELEMETRY_LOG_TOPIC`, etc.).
3. Provide dev scripts/docs so `bun run dev:infra` brings up Redpanda alongside Temporal/Postgres.
4. Keep codebase agnostic: refer to it as “Telemetry Bus” and rely on Kafka APIs so we can swap implementations later.

## Phase 2 – Logging over the bus
### Worker
- Add a Kafka producer wrapper (e.g., using `kafkajs`) bound to `TELEMETRY_LOG_TOPIC`.
- Update `createExecutionContext` to route `logger.info/warn/error` entries through the producer instead of `trace.record`.
- Entries should be structured JSON (`runId`, `nodeRef`, `timestamp`, `level`, `stream`, `message`, metadata).
- Ensure asynchronous, fire-and-forget semantics with batching and retry (do not block component execution).

### Backend
- Create a `LogIngestService` (Nest microservice or standalone consumer) that subscribes to `telemetry.logs`.
- For each entry:
  - Enrich with org/workflow metadata if needed.
  - Forward to Loki via HTTP push (or another log store) so long-term search goes through Loki.
  - Optionally store a short-term cache if the frontend needs immediate access without hitting Loki.
- Update the frontend logs panel to query logs from Loki (or a proxy) instead of `workflow_traces`.

## Phase 3 – Events over the bus (next step after logging)
- Mirror the logging architecture for lifecycle events:
  - Worker publishes `TraceEvent` JSON to `telemetry.events`.
  - Backend consumer persists to Postgres (same schema as today).
- This keeps the UI/event APIs unchanged while removing direct DB writes from the worker.

## Future Phases
- Unify custom streams (terminal, AI agent) as Kafka topics if we want a single ingress point, or retain Redis for ultra-low-latency use cases.
- Add alerting/analytics consumers (e.g., stream logs to Datadog, derive metrics from events) without touching workers.

---

## Immediate Next Steps (logging)
1. Compose Redpanda into the dev stack.
2. Implement worker log producer.
3. Implement backend log ingestor that writes to Loki.
4. Wire the frontend logs tab to the new log retrieval endpoint.
