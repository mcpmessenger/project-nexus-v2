- # Deployment Checklist

## 1. Build and publish

- Run `npm install` (or `pnpm install`/`npm ci`) and `npm run build`. The `vercel.json` build command is `npm run build`, so the same pipeline applies in Vercel/Edge.
- Verify the Next.js `app/` directory is the source root and that `next.config.mjs` is compatible with Next 16 (the repo already declares `typescript.ignoreBuildErrors` and `images.unoptimized` for edge friendliness).
- If the build fails on Vercel, open the deployment log for `npm run build` and look for stack traces that mention missing environment variables or Supabase authentication errors.
## 2. Required environment variables

| Variable | Needed by | Description | Notes |
| --- | --- | --- | --- |
| `OPENAI_API_KEY` | `app/api/messages/route.ts` | Powers the OpenAI chat completions requests for workflows. Missing this key causes `/api/messages` to throw a 500 error (the UI surfaces the “API key is not configured” banner). | Store as a Vercel secret and mark it as `Environment Variable` for production. |
| `EXA_API_KEY` | `lib/tools-helper.ts` | Exa Search MCP server uses this key (added as an Authorization header when available). | Optional — credentials can also be supplied via the Add Server dialog (query string or header). |
| `GITHUB_PERSONAL_ACCESS_TOKEN` / `GITHUB_TOKEN` | `lib/tools-helper.ts`, `supabase/functions/nexus-hub/servers/github.ts` | GitHub MCP server uses a PAT to list user repos and tools via stdio. | The frontend stores the PAT in localStorage when the user saves a server (see `app/monitoring/page.tsx`). |
| `GOOGLE_MAPS_GROUNDING_API_KEY` | `lib/tools-helper.ts`, server registry | Google Maps grounding server injects `X-Goog-Api-Key` when `maps` or `google-maps-grounding` is active. | Needed for Maps and any downstream place/directions calls. |
| `NEXT_PUBLIC_SUPABASE_URL` | `lib/supabase-client.ts`, `lib/get-user-session.ts` | Points the Supabase client at the project URL. | Copy the Supabase “Project URL” value from your Supabase project. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same as above | The public anon key for Supabase authentication. | Use the value from your Supabase settings. |
> Optional: Supabase Edge functions (e.g., `nexus-hub`) run on Deno and often reference additional environment variables (`SUPABASE_SERVICE_ROLE_KEY`, vault secrets for encrypted configs). Keep those in sync with the Supabase project, because the Next.js API routes rely on `getSupabaseClient` to forward authenticated requests.
## 3. System services verification
The front-end ships five system MCP servers with known transports. Keep this table in sync with `app/api/servers/route.ts`, `lib/tools-helper.ts`, and `supabase/functions/nexus-hub/servers/{gMaps,github,playwright,registry}.ts`.
| Service | Transport | Verification path | Key requirements |
| --- | --- | --- | --- |
| Exa Search | http (`https://mcp.exa.ai/mcp`) | `POST /api/mcp` `{ action: "list_tools", config: { id: "exa", transport: "http", url: "https://mcp.exa.ai/mcp", headers: { "Accept": "application/json" } } }` | `exaApiKey` can be added via query (`?exaApiKey=KEY`) or passed in headers; reference https://docs.exa.ai/reference/exa-mcp for credential setup. |
| Google Maps Grounding Lite | http (X-Goog-Api-Key header) | Same `/api/mcp` call with `config.transport = "http"` and `config.url = "https://mapstools.googleapis.com/mcp"`. | `GOOGLE_MAPS_GROUNDING_API_KEY`. |
| Playwright | stdio (`npx @playwright/mcp@latest --headless --isolated`) | `/api/mcp` health/list_tools described in `app/monitoring/page.tsx` – the dialog uses this flow to validate the server. | No API key, but headless browsers require extra CPU (Vercel + Playwright may not run in production; supply your own server). |
| GitHub MCP | stdio (GitHub MCP server binary or npx package) | The `Add Server` dialog saves the PAT in localStorage and the backend uses it when invoking GitHub tools. | `GITHUB_PERSONAL_ACCESS_TOKEN`/`GITHUB_TOKEN`. |
| LangChain Agent | http (https://langchain-agent-mcp-server-554655392699.us-central1.run.app) | Already published server. The registry lists the tool manifest via `mcp.listTools`. | Server-managed `OPENAI_API_KEY` or whichever key LangChain needs. |
### Testing advice
1. Open the choreography UI (`/workflows`) and type `/exa test` + `#` for autocomplete to ensure Exa Search tools appear.
2. Use the Add Server dialog (`/monitoring` > Add Server) to test `/api/mcp` health checks (the dialog pre-populates known URLs and handles API key hints).
3. If you add a custom server, the `userServersUpdated` event triggers both the monitoring list and the chat autocomplete to refresh (see `app/workflows/page.tsx`).
4. For debugging, curl `/api/messages` or `/api/mcp` from your shell after setting `OPENAI_API_KEY` to ensure the backend responds with a 200 before hitting the UI.
## 4. Deployment sanity checks
- Confirm the Vercel build environment file mirrors your `.env.local` (at least the keys listed above). Missing keys cause `/api/messages` requests to 500, which breaks the chat experience even though the page renders.
- Validate that Supabase credentials are reachable from Vercel via the `NEXT_PUBLIC` prefix; the UI relies on those to load system and user server lists.
- Encourage the first section of the landing page to show “Add your API key in Settings” copy so the “Control Plane” narrative has a functional entry point.
<REMOVE>
