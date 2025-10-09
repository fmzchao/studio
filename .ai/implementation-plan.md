# ShipSec Studio – Implementation Plan

This plan is written for an LLM coding agent ("Agent"). Each phase ends with a human review before continuing.  
**Frontend freeze:** per latest direction, defer all new frontend work until backend Phases 5–6 ship; Phase 7 remains on hold.

## Progress Overview

| Phase | Status | Description |
|-------|--------|-------------|
| Phase 1 | ✅ Complete | Workflow Storage & CRUD API |
| Phase 2 | ✅ Complete | Component Registry Foundation |
| Phase 3 | ✅ Complete | DSL Compiler & Validation |
| Phase 4 | ✅ Complete | Temporal Infrastructure & Client Integration |
| Phase 5 | ✅ Complete | Temporal Worker Execution |
| Phase 5.5 | ✅ Complete | File Storage & Component Registry API |
| Phase 5.9 | ✅ Complete | Component SDK Package Separation |
| Phase 5.10 | 🚧 In Progress | Testing Infrastructure & Unit Tests (31/31 unit tests ✅) |
| Phase 6 | ⏳ Partial | Execution Trace Foundation (in-memory only) |
| Phase 7 | ⏸️ On Hold | Frontend Integration |
| Phase 8 | ⏳ Pending | Final Review & Roadmap |

**Current Focus:** Phase 5.10 - Testing Infrastructure (Levels 3-6: Integration & E2E tests)

---
## Phase 1 – Workflow Storage & CRUD API

**Goal:** Define backend data model and REST endpoints to store workflow graphs sent from the frontend.

- [x] **Step 1:** Define shared TypeScript DTOs for `WorkflowGraph`, with validation.
- [x] **Step 2:** Create a repository (in-memory for now) to persist workflows.
- [x] **Step 3:** Implement `WorkflowsModule`, `WorkflowsService`, `WorkflowsController` with CRUD endpoints.
- [ ] **Step 4:** (Optional) Add frontend API client stubs for workflows.
- [x] **Step 5:** Add minimal tests validating controller behavior.
- [ ] **Step 6:** Commit `feat: add workflow storage CRUD`. ➜ **Human review before next phase**

---
## Phase 2 – Component Registry Foundation

**Goal:** Scaffold ShipSec SDK component registry and sample components.

- [x] **Step 1:** Set up backend directory structure under `src/components`.
- [x] **Step 2:** Implement component interfaces (`ComponentDefinition`, `RunnerConfig`, `ExecutionContext`).
- [x] **Step 3:** Build `ShipSecComponentRegistry` with register/get/list methods.
- [x] **Step 4:** Provide stubbed `ExecutionContext` (logger, secrets, artifacts).
- [x] **Step 5:** Create sample components (FileLoader, Subfinder, Webhook) with placeholder logic; register them.
- [x] **Step 6:** Add unit tests ensuring registry works.
- [x] **Step 7:** Commit `feat: scaffold component registry`. ➜ **Human review before next phase**

---
## Phase 3 – DSL Compiler & Validation

**Goal:** Convert stored workflow graphs into a validated DSL representation.

- [x] **Step 1:** Define DSL types (`WorkflowDefinition`, `ActionDefinition`).
- [x] **Step 2:** Implement `compileWorkflowGraph` function (validate, topological sort, build actions).
- [x] **Step 3:** Add `POST /workflows/:id/commit` endpoint using compiler; store DSL.
- [x] **Step 4:** Add tests verifying sample graph compiles correctly.
- [x] **Step 5:** Commit `feat: add workflow compiler`. ➜ **Human review before next phase**

---
## Phase 4 – Temporal Infrastructure & Client Integration ✅

**Goal:** Stand up Temporal + MinIO infrastructure locally and replace the stub runner with a real Temporal client in the Nest API.

- [x] **Step 1:** Expand `docker-compose.yml` to include Temporal server/UI and MinIO while reusing the existing Postgres service (new `temporal` database/schema).
- [x] **Step 2:** Document required env vars (`TEMPORAL_ADDRESS`, `TEMPORAL_NAMESPACE`, `TEMPORAL_TASK_QUEUE`, MinIO creds) in README/`.env.example`.
- [x] **Step 3:** Add Temporal SDK dependencies to the backend and create `TemporalModule`/`TemporalService` that manages connections, namespaces, and workflow starts.
- [x] **Step 4:** Update `WorkflowsService` to start workflows through Temporal (generate run IDs, call client) and expose status/result/cancel helpers.
- [x] **Step 5:** Commit `feat: add temporal infrastructure & client`. ➜ **Phase complete**

---
## Phase 5 – Temporal Worker Execution ✅

**Goal:** Move component execution into Temporal workers with dedicated task queues and activities.

- [x] **Step 1:** Implement worker entrypoints (e.g., `src/temporal/workers/dev.worker.ts`) that register workflows/activities and initialise the component registry.
- [x] **Step 2:** Port the existing inline runner into Temporal activities (invoke registry components, capture outputs/artifacts, emit trace events).
- [x] **Step 3:** Ensure namespace/queue naming is configurable (default to `shipsec-dev` namespace, `shipsec-default` task queue).
- [x] **Step 4:** Provide scripts (package.json targets) to run API + worker separately and update documentation.
- [x] **Step 5:** Switch worker runtime from Bun to Node.js+tsx (Bun incompatible with Temporal SDK).
- [x] **Step 6:** Commit `feat: add temporal worker execution`. ➜ **Phase complete**

---
## Phase 5.5 – File Storage & Component Registry API ✅

**Goal:** Implement real file storage with MinIO and expose component registry to frontend.

- [x] **Step 1:** Integrate MinIO client and create storage service for file upload/download/delete operations.
- [x] **Step 2:** Create files database schema and repository for metadata tracking.
- [x] **Step 3:** Implement Files REST API (`POST /files/upload`, `GET /files`, `GET /files/:id/download`, `DELETE /files/:id`).
- [x] **Step 4:** Update file loader component from mock to real MinIO-backed implementation.
- [x] **Step 5:** Implement service container for dependency injection in Temporal workers.
- [x] **Step 6:** Add Component Registry API (`GET /components`, `GET /components/:id`) with OpenAPI docs.
- [x] **Step 7:** End-to-end test file upload → workflow execution → MinIO fetch → result.
- [x] **Step 8:** Commit `feat: implement real file storage with MinIO` and `feat: add component registry API`. ➜ **Phase complete**

---
## Phase 5.9 – Component SDK Package Separation ✅

**Goal:** Extract component SDK into separate worker package with clean interfaces, eliminating backend coupling.

**Architectural Refactoring:**
This phase introduced a major separation of concerns using the **Adapter Pattern** for dependency injection:

1. **packages/component-sdk/** - Pure SDK with zero backend dependencies:
   - Service interfaces (`IFileStorageService`, `ISecretsService`, `IArtifactService`, `ITraceService`)
   - Component types (`ComponentDefinition`, `ExecutionContext`, `RunnerConfig`)
   - Component registry singleton
   - Execution context factory
   - Component runner logic (inline/docker/remote)

2. **worker/** - Temporal worker with execution layer:
   - Component implementations (file-loader, trigger-manual, webhook, subfinder)
   - Service adapters implementing SDK interfaces (FileStorageAdapter ↔ MinIO+PostgreSQL)
   - Temporal worker, workflows, and activities
   - Dependency injection via adapters at runtime

3. **backend/** - API layer (no execution logic):
   - Imports component-sdk for validation
   - Imports worker for component listing
   - Temporal client (starts workflows, queries status)
   - No component implementations or execution logic

**Key Benefits:**
- ✅ Clean separation: Backend validates, worker executes
- ✅ Interface-based DI: Components depend on interfaces, not concrete implementations
- ✅ Portability: Components can be tested with mock services
- ✅ Swappable adapters: MinIO → S3, PostgreSQL → MongoDB without changing components
- ✅ Single source of truth: One component registry, no duplicates

**Commits:**
- [x] `refactor: extract component SDK to separate packages` - Major architectural refactor
- [x] `test: add comprehensive unit tests` - SDK and component unit tests

**Steps Completed:**
- [x] **Step 1:** Create `worker/` package with its own `package.json` and TypeScript config.
- [x] **Step 2:** Define SDK interfaces (`IFileStorageService`, `ISecretsService`, etc.) in `packages/component-sdk/src/interfaces.ts`.
- [x] **Step 3:** Move component registry, types, context, and runner to `packages/component-sdk/src/`.
- [x] **Step 4:** Move all component implementations to `worker/src/components/` (core, security categories).
- [x] **Step 5:** Create service adapters in `worker/src/adapters/` that implement SDK interfaces using backend services.
- [x] **Step 6:** Move Temporal worker code to `worker/src/temporal/workers/` and update to use adapters.
- [x] **Step 7:** Update root `package.json` to use bun workspaces for monorepo structure.
- [x] **Step 8:** Update backend to remove component code and adjust imports where needed.
- [x] **Step 9:** Fix all typecheck errors and remove duplicate code.
- [x] **Step 10:** Audit for remnants and clean up leftover files.
- [x] **Step 11:** Update `backend/tsconfig.json` to use `bundler` moduleResolution.
- [x] **Step 12:** Create `ARCHITECTURE.md` documentation. ➜ **Phase complete**

---
## Phase 5.10 – Testing Infrastructure & Unit Tests

**Goal:** Establish comprehensive testing strategy with unit tests for SDK and components using mocked services.

**Testing Strategy:**
We follow a bottom-up testing approach with increasing integration complexity:

**Level 1: Component SDK Unit Tests** ✅
- Test registry, context factory, and runner in isolation
- Verify interface-based dependency injection works
- No real services, pure logic testing

**Level 2: Component Tests with Mocks** ✅
- Test component implementations with mocked SDK interfaces
- Verify components use `context.storage`, `context.secrets` correctly
- Ensure proper error handling and validation

**Level 3: Adapter Tests** (Next)
- Test adapters against real services (MinIO, PostgreSQL)
- Verify FileStorageAdapter uploads/downloads correctly
- Test error scenarios (file not found, connection failures)

**Level 4: Worker Integration** (Next)
- Start Temporal cluster + worker
- Execute workflows end-to-end
- Verify services are injected into components

**Level 5: Backend Integration** (Next)
- Test REST API → Temporal → Worker flow
- Verify workflow compilation and execution
- Test status queries and result retrieval

**Level 6: End-to-End Tests** (Next)
- Full flow: File upload → Workflow creation → Execution → Results
- Test with real MinIO, PostgreSQL, Temporal
- Frontend integration testing

**Steps Completed:**
- [x] **Step 1:** Create Component SDK unit tests (18 tests)
  - Registry: register, get, list, has, clear, duplicate detection
  - Context: creation, service injection, progress emission
  - Runner: inline execution, docker/remote stubs, error propagation
- [x] **Step 2:** Create Worker component unit tests (13 tests)
  - file-loader: mock storage integration, UUID validation, binary files
  - trigger-manual: payload pass-through, empty payload
  - webhook: URL validation, stubbed execution
  - subfinder: docker runner config, stubbed results
- [x] **Step 3:** Verify all 31 tests pass (18 SDK + 13 Worker).
- [x] **Step 4:** Commit `test: add comprehensive unit tests`.
- [x] **Step 5:** Add adapter tests for MinIO + PostgreSQL integration (18 tests).
  - FileStorageAdapter: Real MinIO + PostgreSQL, upload/download, error scenarios
  - TraceAdapter: In-memory event recording, retrieval, ordering
- [x] **Step 6:** Commit `test: add adapter integration tests`.
- [ ] **Step 7:** Add worker integration tests with Temporal.
- [ ] **Step 8:** Add backend integration tests.
- [ ] **Step 9:** Add end-to-end tests.
- [ ] **Step 10:** Add CI/CD pipeline for automated testing. ➜ **In Progress**

**Test Coverage Summary:**
- ✅ **Unit Tests:** 31/31 passing (18 SDK + 13 Worker)
  - Component SDK: 100% (registry, context, runner)
  - Worker Components: 100% (all 4 components)
- ✅ **Adapter Tests:** 18/18 passing (Level 3 complete!)
  - FileStorageAdapter: 100% (9 tests with real MinIO + PostgreSQL)
  - TraceAdapter: 100% (9 tests with in-memory storage)
- ⏳ **Integration Tests:** 0% (Levels 4-6 pending)
  - Worker: Temporal + Components
  - Backend: REST API → Temporal
  - End-to-End: Full stack

**Total: 49/49 tests passing** ✅

---
## Phase 6 – Execution Trace Foundation (Temporal-backed)

**Goal:** Extend trace capture to cover Temporal-driven runs and persist traces for retrieval.

- [x] **Step 1:** Define trace event types (`NODE_STARTED`, `NODE_COMPLETED`, etc.).
- [x] **Step 2:** Implement in-memory trace collector.
- [x] **Step 3:** Emit trace events around component execution in SDK/workflow.
- [x] **Step 4:** Add `GET /workflow-runs/:id/trace` endpoint.
- [ ] **Step 5:** Pipe Temporal activity/workflow events into the trace collector and persist runs for later querying.
- [ ] **Step 6:** Commit `feat: augment trace persistence for temporal runs`. ➜ **Human review before next phase**

---
## Phase 7 – Frontend Integration (Initial) **(On Hold)**

**Goal:** Hook frontend to new backend APIs once backend runner/trace work is stable.

- [ ] **Step 1:** Update frontend API client to call workflow CRUD/commit/run/trace endpoints. **Deferred.**
- [ ] **Step 2:** Wire UI to save workflows and display traces (basic view). **Deferred.**
- [ ] **Step 3:** Commit `feat: connect frontend to backend APIs` after backend readiness review. ➜ **Human review before next phase**

---
## Phase 8 – Final Review & Roadmap

- [ ] **Step 1:** Human-led review of entire codebase vs design docs.
- [ ] **Step 2:** Document remaining TODOs (real Docker/K8s runner, Temporal connection, secrets, artifacts).
- [ ] **Step 3:** Produce roadmap for subsequent sprints.
