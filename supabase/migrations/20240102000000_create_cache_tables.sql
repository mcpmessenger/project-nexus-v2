-- Migration: Create Cache Tables for Nexus Hub
-- Description: Creates tool_cache, resource_cache, and prompt_cache tables with TTL support

-- Tool Cache Table
CREATE TABLE IF NOT EXISTS tool_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_ref_id uuid NOT NULL,  -- References system_servers.ref_id or user_servers.id
  server_type text NOT NULL CHECK (server_type IN ('system', 'user')),
  user_id uuid,  -- NULL for system servers, user_id for user servers
  tool_name text NOT NULL,
  namespaced_name text NOT NULL,  -- e.g., "brave_search"
  schema_json jsonb NOT NULL,
  metadata jsonb,  -- {category, priority, tags, estimatedDuration}
  enabled boolean DEFAULT true,
  last_updated timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '24 hours'),  -- TTL for cache invalidation
  UNIQUE(server_ref_id, server_type, user_id, tool_name),
  INDEX idx_tool_cache_user_enabled (user_id, enabled),
  INDEX idx_tool_cache_namespaced (namespaced_name),
  INDEX idx_tool_cache_expires (expires_at)  -- For TTL cleanup
);

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
  UNIQUE(server_ref_id, server_type, user_id, resource_uri),
  INDEX idx_resource_cache_expires (expires_at)
);

-- Prompt Cache Table
CREATE TABLE IF NOT EXISTS prompt_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_ref_id uuid NOT NULL,
  server_type text NOT NULL CHECK (server_type IN ('system', 'user')),
  user_id uuid,
  prompt_name text NOT NULL,
  prompt_template text NOT NULL,
  arguments jsonb,  -- Expected arguments schema
  metadata jsonb,
  expires_at timestamptz DEFAULT (now() + interval '24 hours'),
  last_updated timestamptz DEFAULT now(),
  UNIQUE(server_ref_id, server_type, user_id, prompt_name),
  INDEX idx_prompt_cache_expires (expires_at)
);

-- Function to refresh expired cache entries
CREATE OR REPLACE FUNCTION refresh_expired_cache_entries()
RETURNS TABLE(server_ref_id uuid, server_type text, user_id uuid) AS $$
BEGIN
  -- Return expired cache entries that need refresh
  RETURN QUERY
  SELECT DISTINCT tc.server_ref_id, tc.server_type, tc.user_id
  FROM tool_cache tc
  WHERE tc.expires_at < now() 
    AND tc.enabled = true
  UNION
  SELECT DISTINCT rc.server_ref_id, rc.server_type, rc.user_id
  FROM resource_cache rc
  WHERE rc.expires_at < now()
  UNION
  SELECT DISTINCT pc.server_ref_id, pc.server_type, pc.user_id
  FROM prompt_cache pc
  WHERE pc.expires_at < now();
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE tool_cache IS 'Cached tool schemas to eliminate runtime list_tools calls';
COMMENT ON TABLE resource_cache IS 'Cached resource definitions (MCP Resources)';
COMMENT ON TABLE prompt_cache IS 'Cached prompt templates (MCP Prompts)';
