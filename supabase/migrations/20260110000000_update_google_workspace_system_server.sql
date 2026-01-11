-- Update Google Workspace System Server
-- Description: Updates the Google Workspace server to use the new Cloud Run HTTP endpoint

INSERT INTO system_servers (id, name, config, enabled, rate_limit_per_minute, logo_url) VALUES
  ('google-workspace', 'Google Workspace', '{"transport": "http", "url": "https://google-workspace-mcp-server-554655392699.us-central1.run.app/mcp"}', true, 60, 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/google/google-original.svg')
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  config = EXCLUDED.config,
  enabled = EXCLUDED.enabled,
  rate_limit_per_minute = EXCLUDED.rate_limit_per_minute,
  logo_url = EXCLUDED.logo_url;
