-- Migration: Create Core Tables for Nexus Hub
-- Description: Creates system_servers and user_servers tables with RLS policies

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- System Servers Table
-- Pre-configured system servers available to all users
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

-- User Servers Table
-- User-configured custom MCP servers with encrypted credentials
CREATE TABLE IF NOT EXISTS user_servers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  server_id text NOT NULL,
  name text NOT NULL,
  transport text NOT NULL CHECK (transport IN ('http', 'stdio')),
  config_encrypted bytea NOT NULL,  -- Encrypted with vault key
  enabled boolean DEFAULT true,
  logo_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes for user_servers
CREATE INDEX IF NOT EXISTS idx_user_servers_user_id ON user_servers(user_id);
CREATE INDEX IF NOT EXISTS idx_user_servers_enabled ON user_servers(user_id, enabled);

-- RLS Policies for user_servers
ALTER TABLE user_servers ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their own servers
-- Drop policy if it exists to make migration idempotent
DROP POLICY IF EXISTS "Users can only access their own servers" ON user_servers;

CREATE POLICY "Users can only access their own servers"
  ON user_servers
  FOR ALL
  USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at on user_servers
-- Drop trigger if it exists to make migration idempotent
DROP TRIGGER IF EXISTS update_user_servers_updated_at ON user_servers;

CREATE TRIGGER update_user_servers_updated_at
  BEFORE UPDATE ON user_servers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Seed initial system servers with logos
INSERT INTO system_servers (id, name, config, enabled, rate_limit_per_minute, logo_url) VALUES
  ('brave', 'Brave Search', '{"transport": "stdio", "command": "npx", "args": ["-y", "@brave/brave-search-mcp-server"]}', true, 60, 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/brave/brave-original.svg'),
  ('maps', 'Google Maps Grounding', '{"transport": "http", "url": "https://mapstools.googleapis.com/mcp"}', true, 100, 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/google/google-original.svg'),
  ('github', 'GitHub', '{"transport": "http", "url": "https://api.github.com"}', true, 60, 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/github/github-original.svg'),
  ('playwright', 'Playwright', '{"transport": "stdio", "command": "npx", "args": ["@playwright/mcp@latest", "--headless"]}', true, 10, 'https://playwright.dev/img/playwright-logo.svg')
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE system_servers IS 'Pre-configured system MCP servers available to all users';
COMMENT ON TABLE user_servers IS 'User-configured custom MCP servers with encrypted credentials';
COMMENT ON COLUMN user_servers.config_encrypted IS 'AES-256-GCM encrypted server configuration (URL, headers, credentials)';
COMMENT ON COLUMN system_servers.logo_url IS 'URL to server logo/image (optional)';
COMMENT ON COLUMN user_servers.logo_url IS 'URL to server logo/image (optional)';
