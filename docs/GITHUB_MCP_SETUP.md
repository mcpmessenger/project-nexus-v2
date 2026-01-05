# GitHub MCP Server Setup

This guide explains how to configure the GitHub MCP server for Project Nexus v2.

## Overview

The GitHub MCP server is the [official GitHub MCP server](https://github.com/github/github-mcp-server) that provides access to GitHub repositories, issues, pull requests, and more through the Model Context Protocol.

## Prerequisites

1. **GitHub Personal Access Token** - Required for authentication
2. **Node.js** - For running the MCP server via npx (if using npm package)

## Step 1: Get a GitHub Personal Access Token

1. Go to [GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)](https://github.com/settings/tokens)
2. Click **Generate new token** → **Generate new token (classic)**
3. Give it a descriptive name (e.g., "Project Nexus MCP")
4. Select the scopes you need:
   - **repo** - Full control of private repositories (for private repo access)
   - **read:org** - Read org and team membership (if needed)
   - **read:user** - Read user profile information
   - **gist** - Create gists (if needed)
5. Click **Generate token**
6. **Copy the token immediately** - you won't be able to see it again!

## Step 2: Set Environment Variable

Add the token to your `.env.local` file:

```bash
GITHUB_PERSONAL_ACCESS_TOKEN=ghp_your_token_here
```

Or alternatively:

```bash
GITHUB_TOKEN=ghp_your_token_here
```

## Step 3: Install GitHub MCP Server

The GitHub MCP server can be run in several ways:

### Option A: Using npx (Recommended for Development)

The server will be automatically downloaded and run via npx when first used. No manual installation needed.

### Option B: Using Docker

If you prefer Docker:

```bash
docker pull ghcr.io/github/github-mcp-server
```

Then run with:

```bash
docker run -i --rm \
  -e GITHUB_PERSONAL_ACCESS_TOKEN=your_token_here \
  ghcr.io/github/github-mcp-server
```

### Option C: Using Binary

Download the binary from the [GitHub releases page](https://github.com/github/github-mcp-server/releases) and run:

```bash
./github-mcp-server
```

## Step 4: Verify Configuration

1. Go to the **Monitoring** page in Project Nexus
2. Find the **GitHub** server card
3. Click to edit the server
4. The server should show:
   - **Transport**: stdio
   - **API Key**: (your token should be set via environment variable)
5. Click **Test** to verify the connection

## Available Tools

The GitHub MCP server provides access to many GitHub operations:

### Repository Management
- List repositories
- Get repository details
- Create/update/delete repositories
- Manage branches and tags

### Issues & Pull Requests
- List/create/update issues
- List/create/update pull requests
- Manage comments and reviews
- Merge pull requests

### Code Operations
- Search code
- Get file contents
- Create/update files
- Manage commits

### And More
- User management
- Organization operations
- Gist management
- Security advisories

For a complete list, see the [GitHub MCP Server documentation](https://github.com/github/github-mcp-server).

## Troubleshooting

### "GITHUB_PERSONAL_ACCESS_TOKEN not set"

- Make sure you've added the token to `.env.local`
- Restart your development server after adding the token
- Check that the variable name is exactly `GITHUB_PERSONAL_ACCESS_TOKEN` or `GITHUB_TOKEN`

### "Connection failed" or "404 Not Found"

- Verify your token has the correct scopes
- Check that the token hasn't expired
- Ensure the GitHub MCP server package is available (for npx, it will auto-download)

### "Permission denied" errors

- Your token may not have the required scopes
- For private repositories, ensure the token has `repo` scope
- Check that the token hasn't been revoked

## Security Best Practices

1. **Never commit tokens to version control** - Always use `.env.local` (which should be in `.gitignore`)
2. **Use fine-grained tokens** when possible - More secure than classic tokens
3. **Rotate tokens regularly** - Generate new tokens and revoke old ones periodically
4. **Limit token scopes** - Only grant the minimum permissions needed
5. **Use environment-specific tokens** - Different tokens for development, staging, and production

## Additional Resources

- [GitHub MCP Server Repository](https://github.com/github/github-mcp-server)
- [GitHub Personal Access Tokens Documentation](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)
- [MCP Protocol Documentation](https://modelcontextprotocol.io/)
