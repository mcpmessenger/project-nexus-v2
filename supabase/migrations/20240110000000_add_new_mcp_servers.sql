-- Migration: Add New MCP Servers
-- Description: Adds Google Workspace, Sequential Thinking, Notion, and n8n MCP servers as system servers

-- Insert Google Workspace MCP Server
-- Uses uvx workspace-mcp with stdio transport
-- Requires GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET environment variables
INSERT INTO system_servers (id, name, config, enabled, rate_limit_per_minute, logo_url) VALUES
  (
    'google-workspace',
    'Google Workspace',
    '{"transport": "stdio", "command": "uvx", "args": ["workspace-mcp", "--transport", "streamable-http"]}',
    true,
    60,
    'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/google/google-original.svg'
  )
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  config = EXCLUDED.config,
  enabled = EXCLUDED.enabled,
  rate_limit_per_minute = EXCLUDED.rate_limit_per_minute,
  logo_url = EXCLUDED.logo_url;

-- Insert Sequential Thinking MCP Server
-- Uses mcp-sequentialthinking-tools package with stdio transport
INSERT INTO system_servers (id, name, config, enabled, rate_limit_per_minute, logo_url) VALUES
  (
    'sequential-thinking',
    'Sequential Thinking',
    '{"transport": "stdio", "command": "npx", "args": ["-y", "mcp-sequentialthinking-tools"]}',
    true,
    100,
    'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nodejs/nodejs-original.svg'
  )
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  config = EXCLUDED.config,
  enabled = EXCLUDED.enabled,
  rate_limit_per_minute = EXCLUDED.rate_limit_per_minute,
  logo_url = EXCLUDED.logo_url;

-- Insert Notion MCP Server
-- Uses @notionhq/notion-mcp-server package with stdio transport
-- Requires NOTION_API_KEY environment variable
INSERT INTO system_servers (id, name, config, enabled, rate_limit_per_minute, logo_url) VALUES
  (
    'notion',
    'Notion',
    '{"transport": "stdio", "command": "npx", "args": ["-y", "@notionhq/notion-mcp-server"]}',
    true,
    60,
    '/images/Notion-logo.svg.png'
  )
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  config = EXCLUDED.config,
  enabled = EXCLUDED.enabled,
  rate_limit_per_minute = EXCLUDED.rate_limit_per_minute,
  logo_url = EXCLUDED.logo_url;

-- Insert n8n MCP Server
-- Uses n8n-mcp-server package with stdio transport
-- May require n8n instance URL and API key configuration
INSERT INTO system_servers (id, name, config, enabled, rate_limit_per_minute, logo_url) VALUES
  (
    'n8n',
    'n8n Automation',
    '{"transport": "stdio", "command": "npx", "args": ["-y", "n8n-mcp-server"]}',
    true,
    60,
    '/images/N8n-logo-new.svg.png'
  )
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  config = EXCLUDED.config,
  enabled = EXCLUDED.enabled,
  rate_limit_per_minute = EXCLUDED.rate_limit_per_minute,
  logo_url = EXCLUDED.logo_url;
