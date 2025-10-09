# Current System State

**Last Updated:** 2025-10-09

## 🏗️ Architecture Overview

```
Frontend (React) ──HTTP──> Backend (NestJS+Bun) ──gRPC──> Temporal Cluster
                              │                              │
                              │                         Task Queue
                              │                              │
                              ├──> PostgreSQL               │
                              ├──> MinIO                    │
                              └─────────────────────────────┤
                                                            │
                                                      Worker (Node.js+tsx)
                                                      ├─> Components
                                                      ├─> Adapters
                                                      └─> Workflows
```

## 📦 Package Structure

### **Monorepo Workspaces**
- `packages/component-sdk/` - Pure component SDK with interfaces
- `packages/backend-client/` - Generated TypeScript API client
- `worker/` - Temporal worker with components and adapters
- `backend/` - NestJS REST API
- `frontend/` - React workflow builder

### **Runtime Separation**
- **Backend API:** Bun (fast HTTP server)
- **Temporal Worker:** Node.js + tsx (Bun incompatible with Temporal SDK)

## 🚀 Running Services

### **Docker Compose Services**
```bash
docker-compose up -d
```
- `shipsec-temporal` - Temporal server
- `shipsec-temporal-ui` - Temporal UI (http://localhost:8080)
- `shipsec-postgres` - PostgreSQL database
- `shipsec-minio` - MinIO object storage (http://localhost:9000)

### **Application Services (PM2)**
```bash
npx pm2 start pm2.config.cjs
npx pm2 logs shipsec-backend --lines 100 --nostream
npx pm2 logs shipsec-worker --lines 100 --nostream
npx pm2 stop all
```
- `shipsec-backend` - NestJS API on port 3000
- `shipsec-worker` - Temporal worker polling `shipsec-default` queue

## 🗄️ Database Schema

**PostgreSQL Tables:**
- `workflows` - Workflow graph storage
- `files` - File metadata (MinIO object keys)

**Drizzle ORM:**
- Migrations: `backend/drizzle/migrations/`
- Schema: `backend/src/database/schema/`

## 🔧 Backend Services

### **TemporalModule**
- `TemporalService` - Manages Temporal client connection
- Auto-registers `shipsec-dev` namespace
- Starts workflows, queries status, cancels executions

### **StorageModule**
- `StorageService` - MinIO client wrapper
- `FilesService` - File metadata + storage operations
- `FilesRepository` - Database access for file records
- `FilesController` - REST API for file upload/download/delete

### **ComponentsModule**
- `ComponentsController` - Exposes component registry via REST API
- `GET /components` - List all registered components
- `GET /components/:id` - Get component definition

### **WorkflowsModule**
- `WorkflowsService` - CRUD + Temporal integration
- `WorkflowsController` - REST API for workflows
- DSL Compiler - Converts graphs to executable definitions

## 🔨 Worker Components

### **Registered Components**
1. **core.trigger.manual** - Manual trigger with payload
2. **core.file.loader** - Loads files from MinIO by UUID
3. **core.webhook.post** - HTTP POST webhook (stubbed)
4. **shipsec.subfinder.run** - Subdomain discovery (Docker, stubbed)

### **Service Adapters**
- `FileStorageAdapter` - Implements `IFileStorageService` using MinIO + PostgreSQL
- `TraceAdapter` - Implements `ITraceService` (in-memory)

### **Temporal Integration**
- **Workflow:** `shipsecWorkflowRun` - Main execution workflow
- **Activity:** `runWorkflowActivity` - Executes component graph
- **Task Queue:** `shipsec-default`
- **Namespace:** `shipsec-dev`

## 📝 Environment Variables

**Required in `.env`:**
```bash
# Database
DATABASE_URL=postgresql://shipsec:shipsec@localhost:5432/shipsec_db

# Temporal
TEMPORAL_ADDRESS=localhost:7233
TEMPORAL_NAMESPACE=shipsec-dev
TEMPORAL_TASK_QUEUE=shipsec-default

# MinIO
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_USE_SSL=false
MINIO_BUCKET_NAME=shipsec-files
```

## ✅ Verified End-to-End Flow

1. **Upload File:** `POST /files/upload` → MinIO storage
2. **Create Workflow:** `POST /workflows` with file-loader component
3. **Compile DSL:** `POST /workflows/:id/commit` → Topologically sorted actions
4. **Execute:** `POST /workflow-runs` → Temporal starts workflow
5. **Worker Execution:** 
   - Worker polls task queue
   - Executes components in order
   - `file-loader` fetches file from MinIO via `FileStorageAdapter`
   - Returns base64-encoded content
6. **Get Results:** `GET /workflow-runs/:id` → Status + outputs

## 🧪 Test Coverage

**Unit Tests:** 31/31 passing ✅
- Component SDK: 18 tests (registry, context, runner)
- Worker Components: 13 tests (file-loader, trigger-manual, webhook, subfinder)

**Integration Tests:** Pending
- Adapter tests (MinIO + PostgreSQL)
- Worker integration (Temporal + Components)
- Backend integration (REST API → Temporal)
- End-to-end (Full stack)

## 🔍 Debugging Tips

### **Temporal UI**
- Visit http://localhost:8080
- View workflow executions, history, and task queue status

### **Worker Logs**
```bash
npx pm2 logs shipsec-worker --lines 100 --nostream
```
- Look for `✅ Connected to Temporal`
- Look for `📡 Polling for tasks on queue: shipsec-default`
- Activity logs: `🔧 [ACTIVITY] runWorkflow started`

### **Backend Logs**
```bash
npx pm2 logs shipsec-backend --lines 100 --nostream
```
- REST API requests
- Temporal client operations

### **Database Queries**
```bash
psql postgresql://shipsec:shipsec@localhost:5432/shipsec_db
\dt  # List tables
SELECT * FROM workflows;
SELECT * FROM files;
```

## 🚧 Known Limitations

1. **Docker Runner:** Stubbed (falls back to inline execution)
2. **Remote Runner:** Stubbed (falls back to inline execution)
3. **Secrets Service:** Not implemented (interface defined)
4. **Artifacts Service:** Not implemented (interface defined)
5. **Trace Persistence:** In-memory only (not persisted to database)

## 📚 Documentation

- **Architecture:** `ARCHITECTURE.md`
- **Implementation Plan:** `.ai/implementation-plan.md`
- **Current State:** `.ai/CURRENT-STATE.md` (this file)

