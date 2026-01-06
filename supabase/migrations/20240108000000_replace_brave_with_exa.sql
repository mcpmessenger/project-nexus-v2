-- Migration: Replace Brave Search with Exa Search
-- Description: Removes Brave Search and ensures Exa Search is properly configured

-- Remove Brave Search if it exists
DELETE FROM system_servers WHERE id = 'brave';

-- Ensure Exa Search is properly configured
INSERT INTO system_servers (id, name, config, enabled, rate_limit_per_minute, logo_url) VALUES
  ('exa', 'Exa Search', '{"transport": "http", "url": "https://mcp.exa.ai/mcp", "headers": {"Accept": "application/json"}}', true, 60, '/images/exa-color.png')
ON CONFLICT (id) DO UPDATE
SET 
  name = EXCLUDED.name,
  config = EXCLUDED.config,
  enabled = EXCLUDED.enabled,
  rate_limit_per_minute = EXCLUDED.rate_limit_per_minute,
  logo_url = EXCLUDED.logo_url;
