-- Migration: Create Tool Permissions Table
-- Description: Allows fine-grained control over which tools are enabled per user

CREATE TABLE IF NOT EXISTS tool_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  server_id text NOT NULL,
  tool_name text NOT NULL,
  enabled boolean DEFAULT true,
  UNIQUE(user_id, server_id, tool_name),
  INDEX idx_tool_permissions_user (user_id, enabled)
);

-- RLS Policy for tool_permissions
ALTER TABLE tool_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own permissions"
  ON tool_permissions FOR ALL
  USING (auth.uid() = user_id);

COMMENT ON TABLE tool_permissions IS 'Tool-level permissions for fine-grained user control';
