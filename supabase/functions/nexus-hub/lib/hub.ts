/**
 * Hub Core Logic
 * Tool aggregation, routing, and orchestration
 */

import { createClient } from "jsr:@supabase/supabase-js@2";
import { getAllServers, getServerById, type ServerRecord } from "../servers/registry.ts";
import { getCachedTools } from "./cache.ts";
import { McpClient } from "./mcp_client.ts";
import { checkRateLimit } from "./rate_limiter.ts";
import { createJob } from "./job_queue.ts";
import { reportToolCallUsage } from "./stripe_billing.ts";
import type { ToolSchema } from "./types.ts";

/**
 * Aggregate tools from all enabled servers (cache-first)
 */
export async function aggregateTools(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<ToolSchema[]> {
  // Get cached tools (fast path)
  const cachedTools = await getCachedTools(supabase, userId);
  
  // If we have cached tools, return them
  // TODO: Check if any servers need cache refresh
  if (cachedTools.length > 0) {
    return cachedTools;
  }

  // Fallback: If no cache, this shouldn't happen in production
  // but we'll return empty array for now
  // In production, cache should be pre-populated when servers are added
  return [];
}

/**
 * Invoke a tool by namespaced name
 * Returns sync result or job_id for async operations
 */
export async function invokeTool(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  toolName: string,
  params: Record<string, unknown>,
  forceAsync: boolean = false
): Promise<{ result?: unknown; job_id?: string; sync: boolean }> {
  // Parse namespaced tool name (e.g., "brave_search" -> server: "brave", tool: "search")
  const parts = toolName.split("_");
  if (parts.length < 2) {
    throw new Error(`Invalid tool name format: ${toolName}. Expected format: server_tool`);
  }

  const serverId = parts[0];
  const actualToolName = parts.slice(1).join("_");

  // Get server configuration
  const servers = await getAllServers(supabase, userId);
  const server = servers.find((s) => s.id === serverId);

  if (!server) {
    throw new Error(`Server not found: ${serverId}`);
  }

  // Check rate limit
  const rateLimit = server.rateLimitPerMinute || 60;
  const withinLimit = await checkRateLimit(supabase, serverId, userId, rateLimit);
  if (!withinLimit) {
    throw new Error(`Rate limit exceeded for server ${serverId}. Limit: ${rateLimit} requests/minute`);
  }

  // Determine if tool should be async (long-running tools like Playwright)
  const isLongRunning = serverId === "playwright" || forceAsync;
  
  if (isLongRunning) {
    // Create async job
    const jobId = await createJob(supabase, {
      userId,
      jobType: "tool_invoke",
      serverId,
      toolName: actualToolName,
      params,
    });

    return {
      job_id: jobId,
      sync: false,
    };
  }

  // Execute synchronously
  const client = new McpClient(server.config);
  
  try {
    const result = await client.invokeTool(actualToolName, params);
    
    // Report usage to Stripe (non-blocking)
    reportToolCallUsage(supabase, {
      userId,
      toolName: actualToolName,
      serverId,
      metadata: {
        sync: true,
      },
    }).catch((error) => {
      console.error("Failed to report usage to Stripe:", error);
      // Non-blocking - continue even if reporting fails
    });
    
    return {
      result,
      sync: true,
    };
  } catch (error) {
    throw new Error(
      `Tool invocation failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Health check for all servers
 */
export async function healthCheck(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<Array<{ id: string; healthy: boolean; message?: string }>> {
  const servers = await getAllServers(supabase, userId);
  const healthResults = [];

  for (const server of servers) {
    try {
      const client = new McpClient(server.config);
      const health = await client.health();
      healthResults.push({
        id: server.id,
        healthy: health.healthy,
        message: health.message,
      });
    } catch (error) {
      healthResults.push({
        id: server.id,
        healthy: false,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return healthResults;
}
