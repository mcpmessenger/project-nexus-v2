/**
 * Server Management
 * Handles adding, updating, and deleting user servers
 */

import { createClient } from "jsr:@supabase/supabase-js@2";
import { encryptConfig } from "./vault.ts";
import { refreshToolCache } from "./cache.ts";
import { McpClient } from "./mcp_client.ts";
import type { ServerConfig } from "./types.ts";
import { getAllServers, type ServerRecord } from "../servers/registry.ts";

/**
 * Validate server configuration by calling list_tools
 */
export async function validateServer(config: ServerConfig): Promise<boolean> {
  try {
    const client = new McpClient(config);
    await client.health();
    return true;
  } catch (error) {
    console.error("Server validation failed:", error);
    return false;
  }
}

/**
 * Add a new user server
 */
export async function addUserServer(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  serverId: string,
  name: string,
  transport: 'http' | 'stdio',
  config: ServerConfig
): Promise<{ id: string; success: boolean; error?: string }> {
  try {
    // Validate server is accessible
    const isValid = await validateServer(config);
    if (!isValid) {
      return { id: '', success: false, error: "Server validation failed. Check URL and credentials." };
    }

    // Encrypt config
    const encryptedConfig = await encryptConfig(config);

    // Insert server
    const { data, error } = await supabase
      .from("user_servers")
      .insert({
        user_id: userId,
        server_id: serverId,
        name,
        transport,
        config_encrypted: Array.from(encryptedConfig), // Convert Uint8Array to array for JSON
        enabled: true,
      })
      .select("id")
      .single();

    if (error || !data) {
      return { id: '', success: false, error: error?.message || "Failed to create server" };
    }

    // Refresh tool cache for this server (async - don't wait)
    try {
      const servers = await getAllServers(supabase, userId);
      const newServer = servers.find((s) => s.id === serverId && s.serverType === 'user');
      if (newServer) {
        await refreshToolCache(supabase, newServer);
      }
    } catch (cacheError) {
      console.error("Error refreshing cache after server add:", cacheError);
      // Don't fail the request if cache refresh fails
    }

    return { id: data.id, success: true };
  } catch (error) {
    return {
      id: '',
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Update an existing user server
 */
export async function updateUserServer(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  serverId: string,
  updates: {
    name?: string;
    config?: ServerConfig;
    enabled?: boolean;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get existing server
    const { data: existing, error: fetchError } = await supabase
      .from("user_servers")
      .select("*")
      .eq("id", serverId)
      .eq("user_id", userId)
      .single();

    if (fetchError || !existing) {
      return { success: false, error: "Server not found" };
    }

    // Prepare update object
    const updateData: Record<string, unknown> = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.enabled !== undefined) updateData.enabled = updates.enabled;
    if (updates.config) {
      // Validate if config is being updated
      const isValid = await validateServer(updates.config);
      if (!isValid) {
        return { success: false, error: "Server validation failed. Check URL and credentials." };
      }
      const encryptedConfig = await encryptConfig(updates.config);
      updateData.config_encrypted = Array.from(encryptedConfig);
    }

    // Update server
    const { error } = await supabase
      .from("user_servers")
      .update(updateData)
      .eq("id", serverId)
      .eq("user_id", userId);

    if (error) {
      return { success: false, error: error.message };
    }

    // Refresh cache if config or enabled status changed
    if (updates.config || updates.enabled !== undefined) {
      try {
        const servers = await getAllServers(supabase, userId);
        const updatedServer = servers.find((s) => s.id === existing.server_id && s.serverType === 'user');
        if (updatedServer) {
          await refreshToolCache(supabase, updatedServer);
        }
      } catch (cacheError) {
        console.error("Error refreshing cache after server update:", cacheError);
      }
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Delete a user server
 */
export async function deleteUserServer(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  serverId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Delete server
    const { error } = await supabase
      .from("user_servers")
      .delete()
      .eq("id", serverId)
      .eq("user_id", userId);

    if (error) {
      return { success: false, error: error.message };
    }

    // Delete cached tools for this server
    // Note: We need to get the server_ref_id first, but since we deleted it,
    // we'll need to clean up cache by user_id and server_id pattern
    // For now, cache cleanup can be handled by TTL expiration

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * List all servers for a user
 */
export async function listUserServers(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<Array<{ id: string; server_id: string; name: string; enabled: boolean; created_at: string }>> {
  const { data, error } = await supabase
    .from("user_servers")
    .select("id, server_id, name, enabled, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error listing user servers:", error);
    return [];
  }

  return (data || []).map((server) => ({
    id: server.id,
    server_id: server.server_id,
    name: server.name,
    enabled: server.enabled,
    created_at: server.created_at,
  }));
}
