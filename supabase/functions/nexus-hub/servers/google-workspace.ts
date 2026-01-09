/**
 * Google Workspace MCP Adapter
 * Handles Google Workspace MCP server integration via python -m main
 * Requires OAuth2 credentials for authentication
 */

import type { ServerConfig } from "../lib/types.ts";

/**
 * Ensure Google Workspace config has required OAuth2 credentials
 * These are passed via environment variables to the Python process
 */
export function ensureGoogleWorkspaceConfig(config: ServerConfig): ServerConfig {
  // Check for OAuth credentials in environment
  const clientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET");

  // If credentials are missing, log a warning but don't fail
  // The server will handle authentication when needed
  if (!clientId || !clientSecret) {
    console.warn(
      "Google Workspace MCP: GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET " +
      "environment variables are recommended for full functionality. " +
      "The server will prompt for OAuth flow if credentials are not available."
    );
  }

  // Ensure stdio transport with Python command
  if (config.transport === "stdio" && config.command === "python") {
    // Ensure --transport streamable-http is in args
    const args = config.args || [];
    if (!args.includes("--transport") && !args.includes("streamable-http")) {
      return {
        ...config,
        args: [...args, "--transport", "streamable-http"],
      };
    }
    return config;
  }

  // Default configuration
  return {
    transport: "stdio",
    command: "python",
    args: ["-m", "main", "--transport", "stdio"],
    env: {
      ...(config.env || {}),
      ...(clientId ? { GOOGLE_OAUTH_CLIENT_ID: clientId } : {}),
      ...(clientSecret ? { GOOGLE_OAUTH_CLIENT_SECRET: clientSecret } : {}),
    },
  };
}
