/**
 * Brave Search MCP Adapter
 * Handles Brave Search via official Brave Search MCP server
 * Uses stdio transport with npx @brave/brave-search-mcp-server
 * 
 * Reference: https://github.com/brave/brave-search-mcp-server
 */

import type { ServerConfig } from "../lib/types.ts";

/**
 * Ensure Brave Search MCP config uses stdio transport with npx command
 * Injects BRAVE_API_KEY from environment variables
 */
export function ensureBraveConfig(config: ServerConfig): ServerConfig {
  const apiKey = Deno.env.get("BRAVE_API_KEY");
  if (!apiKey) {
    throw new Error("Missing BRAVE_API_KEY environment variable. Please set BRAVE_API_KEY in your environment.");
  }

  // If config already has stdio transport with command, ensure API key is in args
  if (config.transport === "stdio" && config.command === "npx" && config.args?.includes("@brave/brave-search-mcp-server")) {
    const args = config.args || [];
    // Check if API key is already in args
    const apiKeyIndex = args.findIndex(arg => arg === "--brave-api-key");
    if (apiKeyIndex !== -1 && args[apiKeyIndex + 1] === apiKey) {
      // API key is already correctly set
      return config;
    }
    // Remove old API key if present
    const filteredArgs = args.filter((arg, idx) => 
      arg !== "--brave-api-key" && (idx === 0 || args[idx - 1] !== "--brave-api-key")
    );
    // Add API key argument
    return {
      ...config,
      args: [...filteredArgs, "--brave-api-key", apiKey],
    };
  }

  // Default to stdio transport with npx command
  // The MCP server requires --brave-api-key as a command-line argument
  return {
    transport: "stdio",
    command: "npx",
    args: ["-y", "@brave/brave-search-mcp-server", "--brave-api-key", apiKey],
  };
}
