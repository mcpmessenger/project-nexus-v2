# Nexus Hub Implementation Roadmap

## Recommended Implementation Order

This roadmap provides a logical, incremental approach to building the Nexus Hub. Each phase builds upon the previous one, allowing for testing and validation at each step.

## Phase 0: Foundation Setup (Week 1, Days 1-2)

**Goal**: Set up development environment and database schema

### Step 1: Initialize Supabase Project
- [ ] Install Supabase CLI (`npm install -g supabase`)
- [ ] Initialize Supabase project: `supabase init`
- [ ] Link to Supabase project: `supabase link --project-ref <your-project-ref>`
- [ ] Start local development: `supabase start`

**Files to create**:
- `supabase/config.toml` (auto-generated)
- `.env.local` (for local development)

### Step 2: Create Database Schema (Core Tables)
- [ ] Create migration: `supabase migration new create_core_tables`
- [ ] Implement `system_servers` table
- [ ] Implement `user_servers` table (with `config_encrypted bytea`)
- [ ] Add RLS policies
- [ ] Seed initial system servers (brave, maps, github, playwright)

**Files to create**:
- `supabase/migrations/YYYYMMDDHHMMSS_create_core_tables.sql`

**Why start here**: Database schema is the foundation. All other components depend on it.

---

## Phase 1: Core Infrastructure (Week 1, Days 3-5)

**Goal**: Build basic Edge Function with minimal functionality

### Step 3: Edge Function Structure
- [ ] Create `supabase/functions/nexus-hub/` directory
- [ ] Create `index.ts` entry point with basic routing
- [ ] Set up CORS handling
- [ ] Implement basic health check endpoint

**Files to create**:
- `supabase/functions/nexus-hub/index.ts`
- `supabase/functions/nexus-hub/lib/types.ts`

### Step 4: Token Vault Implementation
- [ ] Implement `lib/vault.ts` with AES-256-GCM
- [ ] Generate and store vault key in Supabase secrets
- [ ] Test encryption/decryption functions
- [ ] Add vault key to local environment

**Files to create**:
- `supabase/functions/nexus-hub/lib/vault.ts`

**Why early**: Vault is needed for any user server storage/retrieval.

### Step 5: Basic Server Registry
- [ ] Implement `servers/registry.ts`
- [ ] Load system servers from database
- [ ] Load user servers from database (with vault decryption)
- [ ] Test server loading

**Files to create**:
- `supabase/functions/nexus-hub/servers/registry.ts`

**Test**: Can retrieve system servers and decrypt user servers.

---

## Phase 2: MCP Client & Tool Aggregation (Week 2, Days 1-3)

**Goal**: Implement MCP protocol communication and tool caching

### Step 6: Cache Tables Migration
- [ ] Create migration for cache tables (`tool_cache`, `resource_cache`, `prompt_cache`)
- [ ] Add `expires_at` columns with TTL
- [ ] Create indexes for performance
- [ ] Create cache refresh functions

**Files to create**:
- `supabase/migrations/YYYYMMDDHHMMSS_create_cache_tables.sql`

### Step 7: MCP Client Implementation
- [ ] Port/adapt `lib/mcpClient.ts` for Deno
- [ ] Implement HTTP/SSE transport
- [ ] Support JSON-RPC 2.0 protocol
- [ ] Test with Google Maps Grounding (simplest server)

**Files to create**:
- `supabase/functions/nexus-hub/lib/mcp_client.ts`

**Test**: Can call `list_tools` on Google Maps server.

### Step 8: Cache Manager
- [ ] Implement `lib/cache.ts`
- [ ] Implement `refreshToolCache()` function
- [ ] Implement `getCachedTools()` function
- [ ] Extract metadata (category, priority, tags)
- [ ] Test cache refresh and retrieval

**Files to create**:
- `supabase/functions/nexus-hub/lib/cache.ts`

**Test**: Cache tools after calling `list_tools`, retrieve from cache.

---

## Phase 3: Hub Core & Tool Routing (Week 2, Days 4-5)

**Goal**: Implement tool aggregation and routing logic

### Step 9: Hub Core Logic
- [ ] Implement `lib/hub.ts`
- [ ] Implement `aggregateTools()` - cache-first approach
- [ ] Implement tool namespacing (e.g., `brave_search`)
- [ ] Implement `invokeTool()` - basic routing
- [ ] Apply tool permissions filtering

**Files to create**:
- `supabase/functions/nexus-hub/lib/hub.ts`

**Test**: Can list all tools from cache, can invoke a tool.

### Step 10: Server Adapters (Start with Simplest)
- [ ] Implement `servers/maps.ts` (Google Maps - SSE endpoint)
- [ ] Implement `servers/brave.ts` (Brave Search - REST API)
- [ ] Test each adapter independently

**Files to create**:
- `supabase/functions/nexus-hub/servers/maps.ts`
- `supabase/functions/nexus-hub/servers/brave.ts`

**Test**: Each server adapter can list tools and invoke them.

---

## Phase 4: Edge Function Endpoints (Week 3, Days 1-2)

**Goal**: Complete Edge Function API endpoints

### Step 11: Complete Edge Function Routes
- [ ] Implement `/functions/v1/nexus-hub` POST endpoint
- [ ] Support actions: `list_tools`, `invoke`, `health`
- [ ] Implement server management endpoints (add/update/delete)
- [ ] Add authentication (JWT extraction)
- [ ] Test all endpoints locally

**Files to update**:
- `supabase/functions/nexus-hub/index.ts`

**Test**: All endpoints work via `supabase functions serve nexus-hub`.

---

## Phase 5: Async Jobs & Advanced Features (Week 3, Days 3-5)

**Goal**: Implement async job pattern and advanced features

### Step 12: Job Queue Tables
- [ ] Create migration for `job_results` table
- [ ] Create `rate_limit_tracking` table
- [ ] Add RLS policies

**Files to create**:
- `supabase/migrations/YYYYMMDDHHMMSS_create_job_tables.sql`

### Step 13: pg_net Background Jobs
- [ ] Enable pg_net extension
- [ ] Create `execute_job_via_pg_net()` function
- [ ] Implement `lib/job_queue.ts`
- [ ] Add `/internal/job-executor` endpoint
- [ ] Test async job creation and execution

**Files to create/update**:
- `supabase/migrations/YYYYMMDDHHMMSS_job_queue_pg_net.sql`
- `supabase/functions/nexus-hub/lib/job_queue.ts`
- `supabase/functions/nexus-hub/index.ts` (add internal endpoint)

**Test**: Create async job, verify it executes via pg_net.

### Step 14: Rate Limiting
- [ ] Implement `check_rate_limit()` function
- [ ] Add rate limiting to tool invocations
- [ ] Test rate limit enforcement

**Files to create/update**:
- `supabase/migrations/YYYYMMDDHHMMSS_rate_limiting.sql`
- `supabase/functions/nexus-hub/lib/rate_limiter.ts`
- `supabase/functions/nexus-hub/lib/hub.ts` (integrate rate limiting)

---

## Phase 6: Frontend Integration (Week 4, Days 1-3)

**Goal**: Connect Next.js frontend to Edge Function

### Step 15: Next.js Supabase Client Setup
- [ ] Install `@supabase/supabase-js`
- [ ] Create `lib/supabase-client.ts`
- [ ] Add environment variables
- [ ] Test Supabase client connection

**Files to create/update**:
- `lib/supabase-client.ts`
- `.env.local` (add Supabase URL and anon key)

### Step 16: Replace API Routes with Direct Calls
- [ ] Create `hooks/useTools.ts` hook
- [ ] Update components to use Supabase client
- [ ] Remove or deprecate `/api/mcp` route
- [ ] Test tool listing from frontend

**Files to create/update**:
- `hooks/useTools.ts`
- `app/dashboard/page.tsx` (update to use hook)
- `app/workflows/page.tsx` (update tool calls)

**Test**: Frontend can list tools via Edge Function.

### Step 17: Server Management UI
- [ ] Create `app/settings/page.tsx`
- [ ] Implement server add/update/delete UI
- [ ] Implement tool permissions UI
- [ ] Add "Sync Tools" button

**Files to create**:
- `app/settings/page.tsx`
- `components/server-management/` (if needed)

---

## Phase 7: Advanced Features (Week 4, Days 4-5)

**Goal**: Complete MCP spec and advanced features

### Step 18: Resources & Prompts Support
- [ ] Implement `aggregateResources()` in hub
- [ ] Implement `aggregatePrompts()` in hub
- [ ] Add cache refresh for resources/prompts
- [ ] Test resources and prompts endpoints

**Files to update**:
- `supabase/functions/nexus-hub/lib/hub.ts`
- `supabase/functions/nexus-hub/lib/cache.ts`

### Step 19: Realtime Subscriptions
- [ ] Create `hooks/useJobStatus.ts` with Realtime
- [ ] Update UI to use Realtime for job status
- [ ] Test job status updates in real-time

**Files to create/update**:
- `hooks/useJobStatus.ts`
- Components using job status (update to use hook)

### Step 20: Remaining Server Adapters
- [ ] Implement `servers/github.ts` (GitHub - Octokit)
- [ ] Implement `servers/playwright.ts` (Playwright - WebSocket)
- [ ] Test each adapter

**Files to create**:
- `supabase/functions/nexus-hub/servers/github.ts`
- `supabase/functions/nexus-hub/servers/playwright.ts`

---

## Phase 8: Operational Setup (Week 5, Days 1-2)

**Goal**: Set up production operations

### Step 21: Job Cleanup (pg_cron)
- [ ] Enable pg_cron extension
- [ ] Create cleanup functions
- [ ] Schedule daily cleanup job
- [ ] Test cleanup function

**Files to create**:
- `supabase/migrations/YYYYMMDDHHMMSS_job_cleanup.sql`

### Step 22: Monitoring Queries
- [ ] Create monitoring SQL queries
- [ ] Set up alerting thresholds
- [ ] Document monitoring procedures

**Files to create/update**:
- `OPERATIONAL_GUIDE.md` (already created, verify queries)

---

## Phase 9: Testing & Deployment (Week 5, Days 3-5)

**Goal**: Test thoroughly and deploy to production

### Step 23: End-to-End Testing
- [ ] Test tool aggregation (all servers)
- [ ] Test tool invocation (sync and async)
- [ ] Test server management (add/update/delete)
- [ ] Test cache refresh
- [ ] Test rate limiting
- [ ] Test error handling

### Step 24: Performance Testing
- [ ] Load test tool listing (verify cache performance)
- [ ] Load test tool invocation
- [ ] Monitor database performance
- [ ] Optimize slow queries

### Step 25: Production Deployment
- [ ] Deploy database migrations to production
- [ ] Set Supabase secrets (vault key, API keys)
- [ ] Deploy Edge Function: `supabase functions deploy nexus-hub`
- [ ] Update Next.js environment variables
- [ ] Verify production deployment
- [ ] Monitor error logs

---

## Recommended Starting Point

**Start with Phase 0, Step 1: Initialize Supabase Project**

This is the foundation - you need a working Supabase project before anything else.

### Quick Start Command Sequence:

```bash
# 1. Install Supabase CLI (if not already installed)
npm install -g supabase

# 2. Initialize Supabase project
cd project-nexus-v2-main
supabase init

# 3. Start local Supabase (Docker required)
supabase start

# 4. Link to your Supabase project (optional, for remote)
supabase link --project-ref <your-project-ref>
```

### Why This Order?

1. **Foundation First**: Database schema must exist before any code can use it
2. **Incremental Testing**: Each phase can be tested independently
3. **Dependencies Resolved**: Each phase builds on previous ones
4. **Early Validation**: Test core functionality before adding complexity
5. **Risk Mitigation**: Complex features (async jobs, caching) come after basics work

### Critical Path

The **minimum viable implementation** path is:
- Phase 0: Foundation Setup
- Phase 1: Core Infrastructure (Steps 3-5)
- Phase 2: MCP Client (Step 7)
- Phase 3: Hub Core (Step 9)
- Phase 4: Edge Function Endpoints (Step 11)
- Phase 6: Frontend Integration (Steps 15-16)

This gives you a working system. Advanced features (async jobs, caching, rate limiting) can be added incrementally.

---

## Questions Before Starting?

Before we begin implementation, confirm:

1. **Do you have a Supabase account/project?** (If not, we'll create one)
2. **Do you have Docker installed?** (Required for local Supabase development)
3. **Which system servers should we implement first?** (Recommend: Google Maps as simplest)
4. **Do you want to start with local development or deploy to remote Supabase?**

Let me know when you're ready to begin, and I'll start with Phase 0, Step 1!
