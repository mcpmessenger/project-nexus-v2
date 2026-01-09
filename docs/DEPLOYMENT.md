- # Deployment Checklist

## 1. Build and publish

- Run `npm install` (or `pnpm install`/`npm ci`) and `npm run build`. The `vercel.json` build command is `npm run build`, so the same pipeline applies in Vercel/Edge.
- Verify the Next.js `app/` directory is the source root and that `next.config.mjs` is compatible with Next 16 (the repo already declares `typescript.ignoreBuildErrors` and `images.unoptimized` for edge friendliness).
- If the build fails on Vercel, open the deployment log for `npm run build` and look for stack traces that mention missing environment variables or Supabase authentication errors.
## 2. Required environment variables

**CRITICAL**: These environment variables MUST be set in your Vercel deployment settings. Missing Supabase variables will cause "Failed to fetch (api.supabase.com)" errors.

### Supabase Configuration (REQUIRED)
| Variable | Needed by | Description | Notes |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `lib/supabase-client.ts`, `lib/get-user-session.ts`, `app/api/servers/route.ts` | Points the Supabase client at the project URL. | **REQUIRED** - Copy the Supabase "Project URL" value from your Supabase project settings (e.g., `https://xxxxx.supabase.co`). Missing this causes "Failed to fetch" errors. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same as above | The public anon key for Supabase authentication. | **REQUIRED** - Use the value from your Supabase project settings > API > anon/public key. Missing this causes authentication failures. |

### API Keys
| Variable | Needed by | Description | Notes |
| --- | --- | --- | --- |
| `OPENAI_API_KEY` | `app/api/messages/route.ts` | Powers the OpenAI chat completions requests for workflows. Missing this key causes `/api/messages` to throw a 500 error (the UI surfaces the "API key is not configured" banner). | Store as a Vercel secret and mark it as `Environment Variable` for production. |
| `EXA_API_KEY` | `lib/tools-helper.ts` | Exa Search MCP server uses this key (added as an Authorization header when available). | Optional — credentials can also be supplied via the Add Server dialog (query string or header). |
| `GITHUB_PERSONAL_ACCESS_TOKEN` / `GITHUB_TOKEN` | `lib/tools-helper.ts`, `supabase/functions/nexus-hub/servers/github.ts` | GitHub MCP server uses a PAT to list user repos and tools via stdio. | The frontend stores the PAT in localStorage when the user saves a server (see `app/monitoring/page.tsx`). |
| `GOOGLE_MAPS_GROUNDING_API_KEY` | `lib/tools-helper.ts`, server registry | Google Maps grounding server injects `X-Goog-Api-Key` when `maps` or `google-maps-grounding` is active. | Needed for Maps and any downstream place/directions calls. |
| `GOOGLE_OAUTH_CLIENT_ID` | `supabase/functions/nexus-hub/servers/google-workspace.ts` | Google Workspace MCP server OAuth2 client ID for GSuite integration. | Required for Google Workspace server. Get from Google Cloud Console. |
| `GOOGLE_OAUTH_CLIENT_SECRET` | `supabase/functions/nexus-hub/servers/google-workspace.ts` | Google Workspace MCP server OAuth2 client secret. | Required for Google Workspace server. Get from Google Cloud Console. |
| `NOTION_API_KEY` | `supabase/functions/nexus-hub/servers/notion.ts` | Notion MCP server API key for workspace access. | Required for Notion server. Get from https://www.notion.so/my-integrations |
> Optional: Supabase Edge functions (e.g., `nexus-hub`) run on Deno and often reference additional environment variables (`SUPABASE_SERVICE_ROLE_KEY`, vault secrets for encrypted configs). Keep those in sync with the Supabase project, because the Next.js API routes rely on `getSupabaseClient` to forward authenticated requests.
## 3. Database Setup - Stock Servers

**IMPORTANT**: If stock servers are missing from the deployment (showing "No servers configured"), you need to seed the `system_servers` table.

### Option 1: Run Migrations (Recommended)
Ensure all Supabase migrations have been run. The migrations are in `supabase/migrations/` and should run automatically if using Supabase CLI or if configured in your deployment pipeline.

### Option 2: Manual Seed Script
If migrations haven't run or servers are missing, run the seed script:

1. Open your Supabase project dashboard
2. Go to SQL Editor
3. Copy and paste the contents of `SEED_STOCK_SERVERS.sql` from the project root
4. Click "Run" to execute

This script is idempotent (safe to run multiple times) and will ensure all 9 stock servers are present:
- Exa Search
- Google Maps Grounding
- GitHub
- Playwright
- LangChain Agent
- Google Workspace
- Sequential Thinking
- Notion
- n8n Automation

After running, verify servers appear by checking `/monitoring` page or querying:
```sql
SELECT id, name, enabled FROM system_servers ORDER BY name;
```

## 4. System services verification
The front-end ships nine system MCP servers with known transports. Keep this table in sync with `app/api/servers/route.ts`, `lib/tools-helper.ts`, and `supabase/functions/nexus-hub/servers/{maps,github,playwright,google-workspace,notion,registry}.ts`.

### Core Integration Servers
| Service | Transport | Verification path | Key requirements |
| --- | --- | --- | --- |
| Exa Search | http (`https://mcp.exa.ai/mcp`) | `POST /api/mcp` `{ action: "list_tools", config: { id: "exa", transport: "http", url: "https://mcp.exa.ai/mcp", headers: { "Accept": "application/json" } } }` | `exaApiKey` can be added via query (`?exaApiKey=KEY`) or passed in headers; reference https://docs.exa.ai/reference/exa-mcp for credential setup. |
| Google Maps Grounding Lite | http (X-Goog-Api-Key header) | Same `/api/mcp` call with `config.transport = "http"` and `config.url = "https://mapstools.googleapis.com/mcp"`. | `GOOGLE_MAPS_GROUNDING_API_KEY`. |
| Playwright | stdio (`npx @playwright/mcp@latest --headless --isolated`) | `/api/mcp` health/list_tools described in `app/monitoring/page.tsx` – the dialog uses this flow to validate the server. | No API key, but headless browsers require extra CPU (Vercel + Playwright may not run in production; supply your own server). |
| GitHub MCP | stdio (`npx -y @modelcontextprotocol/server-github`) | The `Add Server` dialog saves the PAT in localStorage and the backend uses it when invoking GitHub tools. | `GITHUB_PERSONAL_ACCESS_TOKEN`/`GITHUB_TOKEN`. |
| LangChain Agent | http (https://langchain-agent-mcp-server-554655392699.us-central1.run.app) | Already published server. The registry lists the tool manifest via `mcp.listTools`. | Server-managed `OPENAI_API_KEY` or whichever key LangChain needs. |

### Productivity & Automation Servers
| Service | Transport | Verification path | Key requirements |
| --- | --- | --- | --- |
| Google Workspace | stdio (`uvx workspace-mcp --transport streamable-http`) | OAuth2-based authentication. Server requires OAuth credentials for GSuite services. | `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET` environment variables. |
| Notion | stdio (`npx -y @notionhq/notion-mcp-server`) | Notion API integration for workspace management. | `NOTION_API_KEY` environment variable. Get from https://www.notion.so/my-integrations |
| n8n Automation | stdio (`npx -y n8n-mcp-server`) | Visual workflow automation server. May require n8n instance URL and API key. | Optional: n8n instance URL and API key if using remote n8n instance. |

### AI Reasoning Servers
| Service | Transport | Verification path | Key requirements |
| --- | --- | --- | --- |
| Sequential Thinking | stdio (`npx -y mcp-sequentialthinking-tools`) | Chain-of-thought reasoning for AI agents. | No API key required. |
## 5. Testing advice
1. Open the choreography UI (`/workflows`) and type `/exa test` + `#` for autocomplete to ensure Exa Search tools appear.
2. Use the Add Server dialog (`/monitoring` > Add Server) to test `/api/mcp` health checks (the dialog pre-populates known URLs and handles API key hints).
3. If you add a custom server, the `userServersUpdated` event triggers both the monitoring list and the chat autocomplete to refresh (see `app/workflows/page.tsx`).
4. For debugging, curl `/api/messages` or `/api/mcp` from your shell after setting `OPENAI_API_KEY` to ensure the backend responds with a 200 before hitting the UI.
## 6. Deployment sanity checks
- **CRITICAL**: Confirm the Vercel build environment file mirrors your `.env.local` (at least the keys listed above). Missing keys cause `/api/messages` requests to 500, which breaks the chat experience even though the page renders.
- **CRITICAL**: Validate that Supabase credentials are reachable from Vercel via the `NEXT_PUBLIC` prefix; the UI relies on those to load system and user server lists.
  - If you see "Failed to fetch (api.supabase.com)" errors, check:
    1. `NEXT_PUBLIC_SUPABASE_URL` is set in Vercel environment variables
    2. `NEXT_PUBLIC_SUPABASE_ANON_KEY` is set in Vercel environment variables
    3. Both values match your Supabase project settings
    4. The Supabase project is active and not paused
  - To verify: Go to Vercel Dashboard > Your Project > Settings > Environment Variables and ensure both `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are present
- Encourage the first section of the landing page to show "Add your API key in Settings" copy so the "Control Plane" narrative has a functional entry point.

## 7. Troubleshooting Common Errors

### "Failed to fetch (api.supabase.com)"
**Cause**: Missing or incorrect Supabase environment variables.

**Solution**:
1. Go to Vercel Dashboard > Your Project > Settings > Environment Variables
2. Add `NEXT_PUBLIC_SUPABASE_URL` with value from Supabase project settings (Project URL)
3. Add `NEXT_PUBLIC_SUPABASE_ANON_KEY` with value from Supabase project settings (API > anon/public key)
4. Redeploy the application
5. Verify in browser console that the Supabase URL is correct (should not show `http://127.0.0.1:54321`)

### "No servers configured" on /monitoring page
**Cause**: `system_servers` table is empty in Supabase database.

**Solution**:
1. Run the `SEED_STOCK_SERVERS.sql` script in Supabase SQL Editor (see Section 3)
2. Verify with: `SELECT COUNT(*) FROM system_servers WHERE enabled = true;` (should return 9)
<REMOVE>
