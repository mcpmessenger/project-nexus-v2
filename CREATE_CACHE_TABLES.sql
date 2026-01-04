-- Create Cache Tables for Nexus Hub
-- Run this after creating the core tables

-- Tool Cache Table
CREATE TABLE IF NOT EXISTS tool_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_ref_id uuid NOT NULL,
  server_type text NOT NULL CHECK (server_type IN ('system', 'user')),
  user_id uuid,
  tool_name text NOT NULL,
  namespaced_name text NOT NULL,
  schema_json jsonb NOT NULL,
  metadata jsonb,
  enabled boolean DEFAULT true,
  last_updated timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '24 hours'),
  UNIQUE(server_ref_id, server_type, user_id, tool_name)
);

CREATE INDEX IF NOT EXISTS idx_tool_cache_user_enabled ON tool_cache(user_id, enabled);
CREATE INDEX IF NOT EXISTS idx_tool_cache_namespaced ON tool_cache(namespaced_name);
CREATE INDEX IF NOT EXISTS idx_tool_cache_expires ON tool_cache(expires_at);

-- Resource Cache Table
CREATE TABLE IF NOT EXISTS resource_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_ref_id uuid NOT NULL,
  server_type text NOT NULL CHECK (server_type IN ('system', 'user')),
  user_id uuid,
  resource_uri text NOT NULL,
  resource_name text NOT NULL,
  mime_type text,
  description text,
  metadata jsonb,
  expires_at timestamptz DEFAULT (now() + interval '24 hours'),
  last_updated timestamptz DEFAULT now(),
  UNIQUE(server_ref_id, server_type, user_id, resource_uri)
);

CREATE INDEX IF NOT EXISTS idx_resource_cache_expires ON resource_cache(expires_at);

-- Prompt Cache Table
CREATE TABLE IF NOT EXISTS prompt_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_ref_id uuid NOT NULL,
  server_type text NOT NULL CHECK (server_type IN ('system', 'user')),
  user_id uuid,
  prompt_name text NOT NULL,
  prompt_template text NOT NULL,
  arguments jsonb,
  metadata jsonb,
  last_updated timestamptz DEFAULT now(),
  UNIQUE(server_ref_id, server_type, user_id, prompt_name)
);

COMMENT ON TABLE tool_cache IS 'Cached tool schemas from MCP servers';
COMMENT ON TABLE resource_cache IS 'Cached resource metadata from MCP servers';
COMMENT ON TABLE prompt_cache IS 'Cached prompt templates from MCP servers';
