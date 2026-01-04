/**
 * Playwright MCP Adapter
 * Handles Playwright browser automation via official Playwright MCP server
 * Uses stdio transport with npx @playwright/mcp@latest
 */

import type { ServerConfig } from "../lib/types.ts";

/**
 * Ensure Playwright MCP config uses stdio transport with npx command and headless mode
 * Headless mode prevents browser window flashing and reduces resource contention on Windows
 */
export function ensurePlaywrightConfig(config: ServerConfig): ServerConfig {
  // If config already has stdio transport with command, ensure headless is included
  if (config.transport === "stdio" && config.command === "npx" && config.args?.includes("@playwright/mcp@latest")) {
    // Ensure --headless flag is present
    const args = config.args || []
    if (!args.includes("--headless")) {
      return {
        ...config,
        args: [...args, "--headless"],
      }
    }
    return config
  }

  // Default to stdio transport with npx command and headless mode
  return {
    transport: "stdio",
    command: "npx",
    args: ["@playwright/mcp@latest", "--headless"],
  };
}
