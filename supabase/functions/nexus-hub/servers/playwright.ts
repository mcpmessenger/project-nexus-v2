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
  // If config already has stdio transport with command, ensure headless and isolated flags are included
  if (config.transport === "stdio" && config.command === "npx" && config.args?.includes("@playwright/mcp@latest")) {
    const args = config.args || []
    let updated = false
    const newArgs = [...args]
    
    // Ensure --headless flag is present
    if (!newArgs.includes("--headless")) {
      newArgs.push("--headless")
      updated = true
    }
    
    // Ensure --isolated flag is present (prevents browser lock conflicts)
    if (!newArgs.includes("--isolated")) {
      newArgs.push("--isolated")
      updated = true
    }
    
    if (updated) {
      return {
        ...config,
        args: newArgs,
      }
    }
    return config
  }

  // Default to stdio transport with npx command, headless mode, and isolated mode
  // Isolated mode prevents browser lock conflicts
  return {
    transport: "stdio",
    command: "npx",
    args: ["@playwright/mcp@latest", "--headless", "--isolated"],
  };
}
