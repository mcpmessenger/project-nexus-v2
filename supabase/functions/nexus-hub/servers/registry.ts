/**
 * Server Registry
 * Loads and manages system and user server configurations
 */

import { createClient } from "jsr:@supabase/supabase-js@2";
import { decryptConfig } from "../lib/vault.ts";
import { ensureMapsConfig } from "./maps.ts";
import { ensurePlaywrightConfig } from "./playwright.ts";
import type { ServerConfig, SystemServerRecord, UserServerRecord } from "../lib/types.ts";

export interface ServerRecord {
  id: string;
  refId: string;
  name: string;
  config: ServerConfig;
  enabled: boolean;
  serverType: 'system' | 'user';
  userId?: string;
  rateLimitPerMinute?: number;
  logoUrl?: string;
}

/**
 * Load all servers for a user (system + user servers)
 */
export async function getAllServers(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<ServerRecord[]> {
  const servers: ServerRecord[] = [];

  // Load system servers
  const { data: systemServers, error: systemError } = await supabase
    .from("system_servers")
    .select("*")
    .eq("enabled", true);

  if (systemError) {
    console.error("Error loading system servers:", systemError);
  } else {
    for (const server of (systemServers || []) as SystemServerRecord[]) {
      let config = server.config as ServerConfig;
      
      // Apply server-specific config transformations
      if (server.id === 'maps') {
        try {
          config = ensureMapsConfig(config);
        } catch (error) {
          console.error("Error configuring Maps server:", error);
          continue; // Skip this server if config fails
        }
      }
      
      if (server.id === 'playwright') {
        try {
          config = ensurePlaywrightConfig(config);
        } catch (error) {
          console.error("Error configuring Playwright server:", error);
          continue; // Skip this server if config fails
        }
      }
      
      servers.push({
        id: server.id,
        refId: server.ref_id,
        name: server.name,
        config,
        enabled: server.enabled,
        serverType: 'system',
        rateLimitPerMinute: server.rate_limit_per_minute,
        logoUrl: server.logo_url,
      });
    }
  }

  // Load user servers
  const { data: userServers, error: userError } = await supabase
    .from("user_servers")
    .select("*")
    .eq("user_id", userId)
    .eq("enabled", true);

  if (userError) {
    console.error("Error loading user servers:", userError);
  } else {
    for (const server of (userServers || []) as UserServerRecord[]) {
      try {
        // Decrypt config
        const configBytes = new Uint8Array(server.config_encrypted);
        const config = await decryptConfig(configBytes);

        servers.push({
          id: server.server_id,
          refId: server.id,
          name: server.name,
          config: {
            transport: server.transport,
            ...config,
          } as ServerConfig,
          enabled: server.enabled,
          serverType: 'user',
          userId: server.user_id,
          logoUrl: server.logo_url,
        });
      } catch (error) {
        console.error(`Error decrypting config for server ${server.id}:`, error);
        // Skip servers with decryption errors
      }
    }
  }

  return servers;
}

/**
 * Get a specific server by ID
 */
export async function getServerById(
  supabase: ReturnType<typeof createClient>,
  serverId: string,
  userId: string,
  serverType: 'system' | 'user' = 'system'
): Promise<ServerRecord | null> {
  if (serverType === 'system') {
    const { data, error } = await supabase
      .from("system_servers")
      .select("*")
      .eq("id", serverId)
      .single();

    if (error || !data) {
      return null;
    }

    const server = data as SystemServerRecord;
    return {
      id: server.id,
      refId: server.ref_id,
      name: server.name,
      config: server.config as ServerConfig,
      enabled: server.enabled,
      serverType: 'system',
      rateLimitPerMinute: server.rate_limit_per_minute,
      logoUrl: server.logo_url,
    };
  } else {
    const { data, error } = await supabase
      .from("user_servers")
      .select("*")
      .eq("id", serverId)
      .eq("user_id", userId)
      .single();

    if (error || !data) {
      return null;
    }

    const server = data as UserServerRecord;
    try {
      const configBytes = new Uint8Array(server.config_encrypted);
      const config = await decryptConfig(configBytes);

      return {
        id: server.server_id,
        refId: server.id,
        name: server.name,
        config: {
          transport: server.transport,
          ...config,
        } as ServerConfig,
        enabled: server.enabled,
        serverType: 'user',
        userId: server.user_id,
        logoUrl: server.logo_url,
      };
    } catch (error) {
      console.error(`Error decrypting config for server ${server.id}:`, error);
      return null;
    }
  }
}
