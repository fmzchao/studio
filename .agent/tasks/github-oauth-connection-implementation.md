# GitHub OAuth Connection Implementation Plan

> **Goal**: Implement GitHub as a first-class OAuth connection that can be used across multiple components and features.
> **Status**: Planning
> **Created**: December 30, 2024

---

## Executive Summary

Evolve the existing GitHub OAuth integration from a single-connection-per-user model to a **named, reusable connection** that can be:
1. Selected via a connection picker UI
2. Used across multiple GitHub components
3. Shared within a workspace
4. Eventually integrated with MCPs for AI agents

---

## Current State

### What Works Today
- ✅ GitHub OAuth flow (authorize, callback, token exchange)
- ✅ Token encryption and secure storage
- ✅ Token refresh mechanism (`ensureFreshToken`)
- ✅ IntegrationsManager UI for connecting/disconnecting
- ✅ `getConnectionToken(connectionId)` API

### Current Limitations
1. **One connection per user+provider** - Unique constraint on `(userId, provider)`
2. **No connection names** - Users can't identify connections
3. **No connection picker** - Components use raw text input for `connectionId`
4. **Awkward UX** - Connection Provider component pattern is confusing

---

## Implementation Phases

### Phase 1: Named Connections (Database + Backend)

#### 1.1 Schema Migration

```sql
-- Add name column to integration_tokens
ALTER TABLE integration_tokens ADD COLUMN name VARCHAR(255);

-- Drop unique constraint on (userId, provider)
DROP INDEX integration_tokens_user_provider_uidx;

-- Add new unique constraint on (userId, provider, name)
CREATE UNIQUE INDEX integration_tokens_user_provider_name_uidx 
  ON integration_tokens(user_id, provider, name);

-- Set default names for existing connections
UPDATE integration_tokens 
SET name = provider || ' Connection'
WHERE name IS NULL;

-- Make name NOT NULL after backfill
ALTER TABLE integration_tokens ALTER COLUMN name SET NOT NULL;
```

**File**: `backend/src/database/migrations/XXXX_add_connection_names.ts`

#### 1.2 Update Schema TypeScript

```typescript
// backend/src/database/schema/integrations.ts

export const integrationTokens = pgTable(
  'integration_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 255 }).notNull(),  // NEW
    userId: varchar('user_id', { length: 191 }).notNull(),
    provider: varchar('provider', { length: 64 }).notNull(),
    // ... rest unchanged
  },
  (table) => ({
    userProviderIdx: index('integration_tokens_user_idx').on(table.userId),
    // Updated unique constraint
    userProviderNameUnique: uniqueIndex('integration_tokens_user_provider_name_uidx').on(
      table.userId,
      table.provider,
      table.name,
    ),
  }),
);
```

#### 1.3 Update DTOs

```typescript
// backend/src/integrations/integrations.dto.ts

export class StartOAuthDto {
  @ApiProperty({ description: 'Application user identifier' })
  @IsString()
  userId: string;

  @ApiProperty({ description: 'User-friendly name for this connection' })  // NEW
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name: string;

  @ApiProperty({ description: 'OAuth callback redirect URI' })
  @IsUrl({ require_tld: false })
  redirectUri: string;

  @ApiPropertyOptional({ description: 'Additional scopes to request' })
  @IsOptional()
  @IsArray()
  scopes?: string[];
}
```

#### 1.4 Update Service

```typescript
// backend/src/integrations/integrations.service.ts

// Update IntegrationConnection interface
export interface IntegrationConnection {
  id: string;
  name: string;  // NEW
  provider: string;
  // ... rest
}

// Update startOAuthSession to accept name
async startOAuthSession(
  providerId: string,
  input: { userId: string; name: string; redirectUri: string; scopes?: string[] },
): Promise<OAuthStartResponse>

// Update completeOAuthSession to use name from state
async completeOAuthSession(
  providerId: string,
  input: {
    userId: string;
    state: string;
    code: string;
    redirectUri: string;
    name?: string;  // Fallback if not in state
  },
): Promise<IntegrationConnection>
```

#### 1.5 Store Name in OAuth State

```typescript
// Modify integrationOAuthStates table to include connection name
export const integrationOAuthStates = pgTable(
  'integration_oauth_states',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    state: text('state').notNull(),
    userId: varchar('user_id', { length: 191 }).notNull(),
    provider: varchar('provider', { length: 64 }).notNull(),
    connectionName: varchar('connection_name', { length: 255 }).notNull(),  // NEW
    codeVerifier: text('code_verifier'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
);
```

---

### Phase 2: Connection Picker UI (Frontend)

#### 2.1 Add Connection Selector Component

```typescript
// frontend/src/components/parameters/ConnectionSelector.tsx

interface ConnectionSelectorProps {
  provider: string;               // Filter by provider (e.g., 'github')
  value: string | undefined;      // Selected connection ID
  onChange: (connectionId: string) => void;
  placeholder?: string;
  requiredScopes?: string[];      // Show warning if connection lacks scopes
}

export function ConnectionSelector({
  provider,
  value,
  onChange,
  placeholder = 'Select a connection...',
  requiredScopes = [],
}: ConnectionSelectorProps) {
  const { connections, fetchConnections } = useIntegrationStore();
  
  // Filter connections by provider
  const providerConnections = useMemo(
    () => connections.filter(c => c.provider === provider),
    [connections, provider]
  );
  
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {providerConnections.map(conn => (
          <SelectItem key={conn.id} value={conn.id}>
            <div className="flex items-center gap-2">
              <span>{conn.name}</span>
              {conn.status === 'expired' && (
                <Badge variant="destructive">Expired</Badge>
              )}
            </div>
          </SelectItem>
        ))}
        <SelectSeparator />
        <Button variant="ghost" onClick={handleCreateNew}>
          <Plus className="h-4 w-4 mr-2" />
          Create new {provider} connection...
        </Button>
      </SelectContent>
    </Select>
  );
}
```

#### 2.2 Update IntegrationsManager for Named Connections

```typescript
// Update the connect flow to ask for a name
const [newConnectionName, setNewConnectionName] = useState('')

function handleConnect(provider: IntegrationProvider) {
  // Show dialog to enter connection name FIRST
  setConnectDialogOpen(true)
  setSelectedProvider(provider)
}

// New dialog for entering connection name before OAuth
<Dialog open={connectDialogOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Name this connection</DialogTitle>
    </DialogHeader>
    <Input
      placeholder="e.g., GitHub Personal, Work GitHub"
      value={newConnectionName}
      onChange={(e) => setNewConnectionName(e.target.value)}
    />
    <DialogFooter>
      <Button onClick={startOAuthFlow}>
        Continue to {selectedProvider?.name}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

#### 2.3 Update Integration Store

```typescript
// frontend/src/store/integrationStore.ts

interface IntegrationState {
  connections: IntegrationConnection[];
  providers: IntegrationProvider[];
  
  // NEW: Filter connections by provider
  getConnectionsByProvider: (provider: string) => IntegrationConnection[];
  
  // NEW: Create connection (starts OAuth)
  createConnection: (provider: string, name: string) => Promise<void>;
}
```

---

### Phase 3: Component SDK Updates

#### 3.1 Add Connection Parameter Type

```typescript
// packages/component-sdk/src/types.ts

export type ComponentParameterType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'boolean'
  | 'select'
  | 'multi-select'
  | 'json'
  | 'secret'
  | 'artifact'
  | 'variable-list'
  | 'form-fields'
  | 'selection-options'
  | 'connection';  // NEW!

// NEW: Connection parameter configuration
export interface ConnectionParameterConfig {
  provider: string;           // Filter by provider
  requiredScopes?: string[];  // Warn if connection lacks scopes
}

export interface ComponentParameterMetadata {
  id: string;
  label: string;
  type: ComponentParameterType;
  required?: boolean;
  // ... existing fields
  
  // NEW: Connection-specific config
  connectionConfig?: ConnectionParameterConfig;
}
```

#### 3.2 Add Connection Context Service

```typescript
// packages/component-sdk/src/interfaces.ts

export interface IConnectionService {
  /**
   * Get access token for a connection, auto-refreshing if needed
   */
  getToken(connectionId: string): Promise<{
    accessToken: string;
    tokenType: string;
    expiresAt: Date | null;
    scopes: string[];
  }>;
  
  /**
   * Get connection metadata (without token)
   */
  getConnection(connectionId: string): Promise<{
    id: string;
    name: string;
    provider: string;
    status: 'active' | 'expired';
  }>;
}
```

#### 3.3 Add to ExecutionContext

```typescript
// packages/component-sdk/src/types.ts

export interface ExecutionContext {
  runId: string;
  componentRef: string;
  logger: Logger;
  // ... existing
  
  // NEW: Connection service
  connections?: IConnectionService;
}
```

---

### Phase 4: Update GitHub Components

#### 4.1 Deprecate Connection Provider Component

```typescript
// worker/src/components/github/connection-provider.ts

const definition: ComponentDefinition = {
  id: 'github.connection.provider',
  // ...
  metadata: {
    // ...
    deprecated: true,  // Mark as deprecated
    deprecationMessage: 'Use connection parameter type directly in components',
  },
};
```

#### 4.2 Update GitHub Components to Use Connection Type

```typescript
// worker/src/components/github/remove-org-membership.ts (example)

const definition: ComponentDefinition = {
  id: 'github.remove.org.membership',
  // ...
  metadata: {
    parameters: [
      {
        id: 'connection',
        label: 'GitHub Connection',
        type: 'connection',                    // NEW: First-class type
        required: true,
        connectionConfig: {
          provider: 'github',
          requiredScopes: ['admin:org'],
        },
      },
      {
        id: 'organization',
        label: 'Organization',
        type: 'text',
        required: true,
      },
      // ... rest
    ],
  },
  
  async execute(params, context) {
    // NEW: Get token via connection service
    const { accessToken } = await context.connections.getToken(params.connection);
    
    // Use token for API calls
    const octokit = new Octokit({ auth: accessToken });
    // ...
  },
};
```

---

### Phase 5: Worker Connection Adapter

#### 5.1 Implement Connection Adapter

```typescript
// worker/src/adapters/connection.adapter.ts

import { IConnectionService } from '@shipsec/component-sdk';

export function createConnectionAdapter(
  apiClient: BackendClient,
  runId: string,
): IConnectionService {
  return {
    async getToken(connectionId: string) {
      const response = await apiClient.integrations.getConnectionToken(connectionId);
      return {
        accessToken: response.accessToken,
        tokenType: response.tokenType,
        expiresAt: response.expiresAt ? new Date(response.expiresAt) : null,
        scopes: response.scopes,
      };
    },
    
    async getConnection(connectionId: string) {
      const response = await apiClient.integrations.getConnection(connectionId);
      return {
        id: response.id,
        name: response.name,
        provider: response.provider,
        status: response.status,
      };
    },
  };
}
```

#### 5.2 Inject into Execution Context

```typescript
// worker/src/executor/component-executor.ts

const context: ExecutionContext = {
  runId,
  componentRef,
  logger,
  // ... existing
  connections: createConnectionAdapter(apiClient, runId),  // NEW
};
```

---

### Phase 6: Frontend Parameter Panel Update

#### 6.1 Render Connection Picker for Connection Parameters

```typescript
// frontend/src/components/parameter-panel/ParameterField.tsx

function ParameterField({ param, value, onChange }) {
  switch (param.type) {
    case 'text':
      return <Input value={value} onChange={e => onChange(e.target.value)} />;
    
    // ... other types
    
    case 'connection':  // NEW
      return (
        <ConnectionSelector
          provider={param.connectionConfig?.provider}
          value={value}
          onChange={onChange}
          requiredScopes={param.connectionConfig?.requiredScopes}
        />
      );
    
    default:
      return <Input value={value} onChange={e => onChange(e.target.value)} />;
  }
}
```

---

## File Changes Summary

### Backend

| File | Changes |
|------|---------|
| `database/schema/integrations.ts` | Add `name` column, update unique constraint |
| `database/migrations/XXXX_add_connection_names.ts` | New migration |
| `integrations/integrations.dto.ts` | Add `name` to StartOAuthDto |
| `integrations/integrations.service.ts` | Support named connections |
| `integrations/integrations.repository.ts` | Query by name, update upsert |
| `integrations/integrations.controller.ts` | Update endpoints |

### Frontend

| File | Changes |
|------|---------|
| `components/parameters/ConnectionSelector.tsx` | New component |
| `components/parameter-panel/ParameterField.tsx` | Handle `connection` type |
| `pages/IntegrationsManager.tsx` | Add name input dialog |
| `store/integrationStore.ts` | Add `getConnectionsByProvider` |

### Worker

| File | Changes |
|------|---------|
| `adapters/connection.adapter.ts` | New adapter |
| `executor/component-executor.ts` | Inject connections |
| `components/github/connection-provider.ts` | Mark deprecated |
| `components/github/*.ts` | Update to use `connection` type |

### Component SDK

| File | Changes |
|------|---------|
| `packages/component-sdk/src/types.ts` | Add `connection` type, config |
| `packages/component-sdk/src/interfaces.ts` | Add `IConnectionService` |

---

## Testing Checklist

### Phase 1: Database
- [ ] Migration runs successfully
- [ ] Existing connections get default names
- [ ] Can create multiple connections for same provider
- [ ] Can't create duplicate names for same user+provider

### Phase 2: Frontend
- [ ] Connection name dialog appears before OAuth
- [ ] OAuth flow completes with name stored
- [ ] Connections list shows names
- [ ] Can refresh/disconnect named connections

### Phase 3: SDK
- [ ] `connection` parameter type compiles
- [ ] TypeScript types are correct

### Phase 4: Components
- [ ] GitHub components work with new connection type
- [ ] Token is fetched correctly
- [ ] Deprecated component shows warning

### Phase 5: Worker
- [ ] Connection adapter fetches tokens
- [ ] Token refresh works via adapter
- [ ] Error handling for expired/missing connections

### Phase 6: Parameter Panel
- [ ] Connection picker shows in UI
- [ ] Can select existing connections
- [ ] "Create new" button works
- [ ] Scope warnings appear

---

## Rollout Plan

1. **Week 1**: Phase 1 (Database + Backend)
   - Deploy migration
   - Test backward compatibility

2. **Week 2**: Phase 2-3 (Frontend + SDK)
   - Update UI components
   - Publish new SDK version

3. **Week 3**: Phase 4-5 (Components + Worker)
   - Update existing GitHub components
   - Deploy worker changes

4. **Week 4**: Phase 6 + Polish
   - Parameter panel updates
   - Documentation
   - Deprecation notices

---

## Open Questions

1. **Workspace-level connections**: Should connections be per-user or per-workspace?
2. **Connection sharing**: Can users share connections with team members?
3. **Migration path**: How to handle existing workflows using old `connectionId` pattern?
4. **Connection validation**: Should we validate connections are still valid before workflow runs?

---

## Success Criteria

- [ ] Users can create multiple GitHub connections with custom names
- [ ] Connection picker shows in workflow parameter panel
- [ ] GitHub components work with first-class connection type
- [ ] OAuth flow includes naming step
- [ ] Existing workflows continue to work (backward compatible)
