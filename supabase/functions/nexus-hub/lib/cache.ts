/**
 * Cache Manager
 * Handles tool/resource/prompt schema caching and refresh
 */

import { createClient } from "jsr:@supabase/supabase-js@2";
import { McpClient } from "./mcp_client.ts";
import type { ToolSchema } from "./types.ts";
import type { ServerRecord } from "../servers/registry.ts";

/**
 * Extract metadata from tool schema
 */
function extractMetadata(tool: ToolSchema): ToolSchema["metadata"] {
  // Try to extract category from description or name
  let category: ToolSchema["metadata"]["category"] = "other";
  const name = tool.name.toLowerCase();
  const desc = (tool.description || "").toLowerCase();

  if (name.includes("search") || desc.includes("search")) {
    category = "search";
  } else if (name.includes("code") || desc.includes("code") || desc.includes("github")) {
    category = "code";
  } else if (name.includes("browser") || name.includes("playwright") || desc.includes("browser")) {
    category = "automation";
  } else if (desc.includes("data") || desc.includes("database")) {
    category = "data";
  }

  // Default priority based on category
  let priority = 5;
  if (category === "search") priority = 8;
  else if (category === "code") priority = 7;
  else if (category === "automation") priority = 6;

  return {
    category,
    priority,
    tags: [],
    estimatedDuration: "fast",
  };
}

/**
 * Refresh tool cache for a server
 */
export async function refreshToolCache(
  supabase: ReturnType<typeof createClient>,
  server: ServerRecord
): Promise<void> {
  try {
    // Create MCP client and fetch tools
    const client = new McpClient(server.config);
    const tools = await client.listTools();

    // Clear existing cache for this server
    await supabase
      .from("tool_cache")
      .delete()
      .eq("server_ref_id", server.refId)
      .eq("server_type", server.serverType)
      .eq("user_id", server.userId || null);

    // Insert new cache entries
    const cacheEntries = tools.map((tool) => {
      const namespacedName = `${server.id}_${tool.name}`;
      return {
        server_ref_id: server.refId,
        server_type: server.serverType,
        user_id: server.userId || null,
        tool_name: tool.name,
        namespaced_name: namespacedName,
        schema_json: tool,
        metadata: extractMetadata(tool),
        enabled: true,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
      };
    });

    if (cacheEntries.length > 0) {
      const { error } = await supabase.from("tool_cache").insert(cacheEntries);
      if (error) {
        console.error(`Error caching tools for server ${server.id}:`, error);
      }
    }
  } catch (error) {
    console.error(`Error refreshing tool cache for server ${server.id}:`, error);
    throw error;
  }
}

/**
 * Get cached tools for a user (non-expired only)
 * Applies tool-level permissions filtering
 */
export async function getCachedTools(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<ToolSchema[]> {
  const { data, error } = await supabase
    .from("tool_cache")
    .select("*")
    .or(`user_id.eq.${userId},user_id.is.null`)
    .eq("enabled", true)
    .gte("expires_at", new Date().toISOString())
    .order("namespaced_name");

  if (error) {
    console.error("Error fetching cached tools:", error);
    return [];
  }

  // Get disabled tool permissions
  const { data: disabledTools } = await supabase
    .from("tool_permissions")
    .select("server_id, tool_name")
    .eq("user_id", userId)
    .eq("enabled", false);

  const disabledSet = new Set(
    (disabledTools || []).map((dt) => `${dt.server_id}_${dt.tool_name}`)
  );

  // Convert cached entries to ToolSchema format and filter by permissions
  const tools = (data || [])
    .map((entry) => ({
      ...entry.schema_json,
      name: entry.namespaced_name, // Use namespaced name
      metadata: entry.metadata || extractMetadata(entry.schema_json as ToolSchema),
    }))
    .filter((tool) => {
      // Check if tool is disabled via permissions
      return !disabledSet.has(tool.name);
    }) as ToolSchema[];

  return tools;
}

/**
 * Refresh cache for all expired entries (to be called by scheduled job)
 */
export async function refreshExpiredCache(
  supabase: ReturnType<typeof createClient>
): Promise<void> {
  // This would need to load servers and refresh their caches
  // For now, this is a placeholder - full implementation would
  // call refresh_expired_cache_entries() RPC and refresh each server
  console.log("Cache refresh not fully implemented yet");
}
