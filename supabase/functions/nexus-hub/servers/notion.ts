/**
 * Notion MCP Adapter
 * Handles Notion MCP server integration via @notionhq/notion-mcp-server
 * Requires Notion API key for authentication
 */

import type { ServerConfig } from "../lib/types.ts";

/**
 * Ensure Notion config has required API key
 * The API key is passed via environment variable to the npx process
 */
export function ensureNotionConfig(config: ServerConfig): ServerConfig {
  // Check for Notion API key in environment
  const apiKey = Deno.env.get("NOTION_API_KEY");

  // If API key is missing, log a warning but don't fail
  // The server will prompt for API key if not available
  if (!apiKey) {
    console.warn(
      "Notion MCP: NOTION_API_KEY environment variable is recommended. " +
      "The server will prompt for API key if not available."
    );
  }

  // Ensure stdio transport with npx command
  if (config.transport === "stdio" && config.command === "npx") {
    const args = config.args || [];
    // Ensure @notionhq/notion-mcp-server is in args
    if (!args.some(arg => arg.includes("notion-mcp-server"))) {
      return {
        ...config,
        args: ["-y", "@notionhq/notion-mcp-server"],
        env: {
          ...(config.env || {}),
          ...(apiKey ? { NOTION_API_KEY: apiKey } : {}),
        },
      };
    }
    // Add API key to env if not already present
    if (apiKey && (!config.env || !config.env.NOTION_API_KEY)) {
      return {
        ...config,
        env: {
          ...(config.env || {}),
          NOTION_API_KEY: apiKey,
        },
      };
    }
    return config;
  }

  // Default configuration
  return {
    transport: "stdio",
    command: "npx",
    args: ["-y", "@notionhq/notion-mcp-server"],
    env: {
      ...(apiKey ? { NOTION_API_KEY: apiKey } : {}),
    },
  };
}
