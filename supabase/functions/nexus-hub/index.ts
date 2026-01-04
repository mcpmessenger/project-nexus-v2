/**
 * Nexus Hub Edge Function
 * Main entry point for Supabase Edge Function
 */

import { serve } from "jsr:@supabase/functions-js/edge";
import { createClient } from "jsr:@supabase/supabase-js@2";
import type { HubRequest, HubResponse } from "./lib/types.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  const url = new URL(req.url);

  // Handle internal job executor endpoint (called by pg_net)
  if (url.pathname.endsWith("/internal/job-executor")) {
    // Verify service role key
    const authHeader = req.headers.get("Authorization");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (authHeader !== `Bearer ${serviceRoleKey}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { job_id, job_type, server_id, tool_name, params, user_id } = body;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey!);

    const { executeJob } = await import("./lib/job_queue.ts");
    await executeJob(supabase, job_id, job_type, server_id, tool_name, params, user_id);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  try {
    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: req.headers.get("Authorization")! },
      },
    });

    // Get user from JWT
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    // Parse request body
    const body: HubRequest = await req.json();

    // Route based on action
    switch (body.action) {
      case "health":
        return new Response(
          JSON.stringify({
            status: "healthy",
            timestamp: new Date().toISOString(),
          } as HubResponse),
          {
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          }
        );

      case "list_tools":
        const { aggregateTools } = await import("./lib/hub.ts");
        const tools = await aggregateTools(supabase, user.id);
        return new Response(
          JSON.stringify({
            tools,
            cached: true,
            timestamp: new Date().toISOString(),
          } as HubResponse),
          {
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          }
        );

      case "invoke":
        if (!body.toolName || !body.params) {
          return new Response(
            JSON.stringify({ error: "toolName and params are required" } as HubResponse),
            {
              status: 400,
              headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
            }
          );
        }
        const { invokeTool } = await import("./lib/hub.ts");
        const invokeResult = await invokeTool(supabase, user.id, body.toolName, body.params || {});
        return new Response(
          JSON.stringify(invokeResult as HubResponse),
          {
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          }
        );

      case "add_server":
        if (!body.config) {
          return new Response(
            JSON.stringify({ error: "config is required" } as HubResponse),
            {
              status: 400,
              headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
            }
          );
        }
        const { addUserServer } = await import("./lib/server_management.ts");
        const serverId = body.serverId || `server-${crypto.randomUUID()}`;
        const addResult = await addUserServer(
          supabase,
          user.id,
          serverId,
          body.config.name || serverId,
          body.config.transport || 'http',
          body.config
        );
        if (!addResult.success) {
          return new Response(
            JSON.stringify({ error: addResult.error } as HubResponse),
            {
              status: 400,
              headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
            }
          );
        }
        return new Response(
          JSON.stringify({ server_id: addResult.id } as HubResponse),
          {
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          }
        );

      case "update_server":
        if (!body.serverId) {
          return new Response(
            JSON.stringify({ error: "serverId is required" } as HubResponse),
            {
              status: 400,
              headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
            }
          );
        }
        const { updateUserServer } = await import("./lib/server_management.ts");
        const updateResult = await updateUserServer(
          supabase,
          user.id,
          body.serverId,
          {
            name: body.config?.name,
            config: body.config,
            enabled: body.config?.enabled,
          }
        );
        if (!updateResult.success) {
          return new Response(
            JSON.stringify({ error: updateResult.error } as HubResponse),
            {
              status: 400,
              headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
            }
          );
        }
        return new Response(
          JSON.stringify({ success: true } as HubResponse),
          {
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          }
        );

      case "delete_server":
        if (!body.serverId) {
          return new Response(
            JSON.stringify({ error: "serverId is required" } as HubResponse),
            {
              status: 400,
              headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
            }
          );
        }
        const { deleteUserServer } = await import("./lib/server_management.ts");
        const deleteResult = await deleteUserServer(supabase, user.id, body.serverId);
        if (!deleteResult.success) {
          return new Response(
            JSON.stringify({ error: deleteResult.error } as HubResponse),
            {
              status: 400,
              headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
            }
          );
        }
        return new Response(
          JSON.stringify({ success: true } as HubResponse),
          {
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          }
        );

      case "list_servers":
        const { listUserServers } = await import("./lib/server_management.ts");
        const servers = await listUserServers(supabase, user.id);
        return new Response(
          JSON.stringify({ servers } as HubResponse),
          {
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          }
        );

      case "get_job_status":
        if (!body.jobId) {
          return new Response(
            JSON.stringify({ error: "jobId is required" } as HubResponse),
            {
              status: 400,
              headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
            }
          );
        }
        const { getJobStatus } = await import("./lib/job_queue.ts");
        const jobStatus = await getJobStatus(supabase, body.jobId);
        return new Response(
          JSON.stringify(jobStatus as HubResponse),
          {
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          }
        );

      case "health_check":
        const { healthCheck } = await import("./lib/hub.ts");
        const healthResults = await healthCheck(supabase, user.id);
        return new Response(
          JSON.stringify({ servers: healthResults } as HubResponse),
          {
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          }
        );

      default:
        return new Response(
          JSON.stringify({ error: `Unsupported action: ${body.action}` } as HubResponse),
          {
            status: 400,
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          }
        );
    }
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      } as HubResponse),
      {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  }
});
