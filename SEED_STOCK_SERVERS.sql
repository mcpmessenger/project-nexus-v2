-- Seed All Stock Servers
-- This script ensures all system servers are present in the database
-- Can be run multiple times safely (idempotent)
-- Run this in Supabase SQL Editor if stock servers are missing

-- Ensure system_servers table exists (should already exist from migrations)
CREATE TABLE IF NOT EXISTS system_servers (
  id text PRIMARY KEY,
  ref_id uuid UNIQUE DEFAULT gen_random_uuid(),
  name text NOT NULL,
  config jsonb NOT NULL,
  enabled boolean DEFAULT true,
  rate_limit_per_minute integer DEFAULT 60,
  logo_url text,
  created_at timestamptz DEFAULT now()
);

-- Seed all stock servers
-- Using ON CONFLICT DO UPDATE to make it idempotent

-- Exa Search
INSERT INTO system_servers (id, name, config, enabled, rate_limit_per_minute, logo_url) VALUES
  ('exa', 'Exa Search', '{"transport": "http", "url": "https://mcp.exa.ai/mcp", "headers": {"Accept": "application/json"}}', true, 60, '/images/exa-color.png')
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  config = EXCLUDED.config,
  enabled = EXCLUDED.enabled,
  rate_limit_per_minute = EXCLUDED.rate_limit_per_minute,
  logo_url = EXCLUDED.logo_url;

-- Google Maps Grounding
INSERT INTO system_servers (id, name, config, enabled, rate_limit_per_minute, logo_url) VALUES
  ('maps', 'Google Maps Grounding', '{"transport": "http", "url": "https://mapstools.googleapis.com/mcp"}', true, 100, 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/google/google-original.svg')
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  config = EXCLUDED.config,
  enabled = EXCLUDED.enabled,
  rate_limit_per_minute = EXCLUDED.rate_limit_per_minute,
  logo_url = EXCLUDED.logo_url;

-- GitHub
INSERT INTO system_servers (id, name, config, enabled, rate_limit_per_minute, logo_url) VALUES
  ('github', 'GitHub', '{"transport": "stdio", "command": "npx", "args": ["-y", "@modelcontextprotocol/server-github"]}', true, 60, 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/github/github-original.svg')
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  config = EXCLUDED.config,
  enabled = EXCLUDED.enabled,
  rate_limit_per_minute = EXCLUDED.rate_limit_per_minute,
  logo_url = EXCLUDED.logo_url;

-- Playwright
INSERT INTO system_servers (id, name, config, enabled, rate_limit_per_minute, logo_url) VALUES
  ('playwright', 'Playwright', '{"transport": "stdio", "command": "npx", "args": ["-y", "@playwright/mcp@latest", "--headless", "--isolated"]}', true, 10, 'https://playwright.dev/img/playwright-logo.svg')
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  config = EXCLUDED.config,
  enabled = EXCLUDED.enabled,
  rate_limit_per_minute = EXCLUDED.rate_limit_per_minute,
  logo_url = EXCLUDED.logo_url;

-- LangChain Agent
INSERT INTO system_servers (id, name, config, enabled, rate_limit_per_minute, logo_url) VALUES
  ('langchain', 'LangChain Agent', '{"transport": "http", "url": "https://langchain-agent-mcp-server-554655392699.us-central1.run.app"}', true, 60, '/images/mcpwhtbggd.png')
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  config = EXCLUDED.config,
  enabled = EXCLUDED.enabled,
  rate_limit_per_minute = EXCLUDED.rate_limit_per_minute,
  logo_url = EXCLUDED.logo_url;

-- Google Workspace
INSERT INTO system_servers (id, name, config, enabled, rate_limit_per_minute, logo_url) VALUES
  ('google-workspace', 'Google Workspace', '{"transport": "stdio", "command": "python", "args": ["-m", "main", "--transport", "stdio"]}', true, 60, 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/google/google-original.svg')
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  config = EXCLUDED.config,
  enabled = EXCLUDED.enabled,
  rate_limit_per_minute = EXCLUDED.rate_limit_per_minute,
  logo_url = EXCLUDED.logo_url;

-- Sequential Thinking
INSERT INTO system_servers (id, name, config, enabled, rate_limit_per_minute, logo_url) VALUES
  ('sequential-thinking', 'Sequential Thinking', '{"transport": "stdio", "command": "npx", "args": ["-y", "mcp-sequentialthinking-tools"]}', true, 100, 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nodejs/nodejs-original.svg')
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  config = EXCLUDED.config,
  enabled = EXCLUDED.enabled,
  rate_limit_per_minute = EXCLUDED.rate_limit_per_minute,
  logo_url = EXCLUDED.logo_url;

-- Notion
INSERT INTO system_servers (id, name, config, enabled, rate_limit_per_minute, logo_url) VALUES
  ('notion', 'Notion', '{"transport": "stdio", "command": "npx", "args": ["-y", "@notionhq/notion-mcp-server"]}', true, 60, '/images/Notion-logo.svg.png')
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  config = EXCLUDED.config,
  enabled = EXCLUDED.enabled,
  rate_limit_per_minute = EXCLUDED.rate_limit_per_minute,
  logo_url = EXCLUDED.logo_url;

-- n8n
INSERT INTO system_servers (id, name, config, enabled, rate_limit_per_minute, logo_url) VALUES
  ('n8n', 'n8n Automation', '{"transport": "stdio", "command": "npx", "args": ["-y", "n8n-mcp-server"]}', true, 60, '/images/N8n-logo-new.svg.png')
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  config = EXCLUDED.config,
  enabled = EXCLUDED.enabled,
  rate_limit_per_minute = EXCLUDED.rate_limit_per_minute,
  logo_url = EXCLUDED.logo_url;

-- Verify servers were inserted
SELECT id, name, enabled, rate_limit_per_minute FROM system_servers ORDER BY name;
