-- Migration: Add LangChain Agent MCP Server
-- Description: Adds LangChain Agent as a system server

-- Insert LangChain server (using ON CONFLICT to make it idempotent)
INSERT INTO system_servers (id, name, config, enabled, rate_limit_per_minute, logo_url) VALUES
  (
    'langchain',
    'LangChain Agent',
    '{"transport": "http", "url": "https://langchain-agent-mcp-server-554655392699.us-central1.run.app"}',
    true,
    60,
    '/images/mcpwhtbggd.png'
  )
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  config = EXCLUDED.config,
  enabled = EXCLUDED.enabled,
  rate_limit_per_minute = EXCLUDED.rate_limit_per_minute,
  logo_url = EXCLUDED.logo_url;
