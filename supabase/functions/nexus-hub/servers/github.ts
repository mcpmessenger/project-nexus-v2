/**
 * GitHub Adapter
 * Handles GitHub API integration via Octokit
 */

import { Octokit } from "npm:octokit@3";
import type { ServerConfig } from "../lib/types.ts";

/**
 * Create GitHub client from config
 */
export function createGitHubClient(config: ServerConfig): Octokit {
  // Extract token from headers or config
  const token = config.headers?.Authorization?.replace("Bearer ", "") ||
                config.headers?.Authorization?.replace("token ", "") ||
                Deno.env.get("GITHUB_TOKEN");

  if (!token) {
    throw new Error("GitHub token not found in config or environment");
  }

  return new Octokit({
    auth: token,
  });
}

/**
 * Convert GitHub operations to MCP tool format
 * This adapter can be extended to provide GitHub-specific tool wrappers
 */
export class GitHubAdapter {
  private octokit: Octokit;

  constructor(config: ServerConfig) {
    this.octokit = createGitHubClient(config);
  }

  /**
   * Get GitHub client for direct API access
   */
  getClient(): Octokit {
    return this.octokit;
  }
}
