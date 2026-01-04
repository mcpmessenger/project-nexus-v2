/**
 * Brave Search Adapter
 * Handles Brave Search API integration
 */

import type { ServerConfig } from "../lib/types.ts";
import { McpClient } from "../lib/mcp_client.ts";

const BRAVE_SEARCH_URL = "https://api.search.brave.com/res/v1/web/search";

/**
 * Create Brave Search server config
 */
export function createBraveConfig(apiKey?: string): ServerConfig {
  const key = apiKey || Deno.env.get("BRAVE_API_KEY");
  if (!key) {
    throw new Error("Missing BRAVE_API_KEY environment variable or API key parameter");
  }

  return {
    transport: "http",
    url: BRAVE_SEARCH_URL,
    headers: {
      "X-Subscription-Token": key,
      "Accept": "application/json",
    },
  };
}

/**
 * Brave Search doesn't use MCP protocol directly
 * This is a wrapper that converts Brave API calls to MCP tool format
 */
export class BraveSearchAdapter {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || Deno.env.get("BRAVE_API_KEY") || "";
    if (!this.apiKey) {
      throw new Error("Missing BRAVE_API_KEY");
    }
  }

  /**
   * Search using Brave API
   */
  async search(query: string, count: number = 10): Promise<unknown> {
    const url = new URL(BRAVE_SEARCH_URL);
    url.searchParams.set("q", query);
    url.searchParams.set("count", count.toString());

    const response = await fetch(url.toString(), {
      headers: {
        "X-Subscription-Token": this.apiKey,
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Brave API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }
}
