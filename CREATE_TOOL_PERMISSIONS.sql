-- Create Tool Permissions Table
-- Run this after creating job tables

CREATE TABLE IF NOT EXISTS tool_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  server_id text NOT NULL,
  tool_name text NOT NULL,
  enabled boolean DEFAULT true,
  UNIQUE(user_id, server_id, tool_name)
);

CREATE INDEX IF NOT EXISTS idx_tool_permissions_user ON tool_permissions(user_id, enabled);

-- RLS Policy for tool_permissions
ALTER TABLE tool_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own permissions"
  ON tool_permissions FOR ALL
  USING (auth.uid() = user_id);

COMMENT ON TABLE tool_permissions IS 'Tool-level permissions for fine-grained user control';
