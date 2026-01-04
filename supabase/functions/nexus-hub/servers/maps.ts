/**
 * Google Maps Grounding Adapter
 * Handles Google Maps Grounding Lite MCP server integration
 */

import type { ServerConfig } from "../lib/types.ts";

const GOOGLE_GROUNDING_URL = "https://mapstools.googleapis.com/mcp";

/**
 * Ensure Google Maps config has required API key
 */
export function ensureMapsConfig(config: ServerConfig): ServerConfig {
  const apiKey = Deno.env.get("GOOGLE_MAPS_GROUNDING_API_KEY");
  if (!apiKey) {
    throw new Error("Missing GOOGLE_MAPS_GROUNDING_API_KEY environment variable");
  }

  return {
    ...config,
    transport: "http",
    url: GOOGLE_GROUNDING_URL,
    headers: {
      ...config.headers,
      "X-Goog-Api-Key": apiKey,
    },
  };
}
