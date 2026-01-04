/**
 * Type definitions for Nexus Hub
 */

export interface ServerConfig {
  transport: 'http' | 'stdio';
  url?: string;
  headers?: Record<string, string>;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface ToolSchema {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  metadata?: {
    category?: 'search' | 'code' | 'automation' | 'data' | 'other';
    priority?: number; // 1-10
    tags?: string[];
    estimatedDuration?: 'fast' | 'medium' | 'slow';
  };
}

export interface HubRequest {
  action: 'list_tools' | 'list_resources' | 'list_prompts' | 'invoke' | 'get_resource' | 'get_prompt' | 'health' | 'health_check' | 'add_server' | 'update_server' | 'delete_server' | 'list_servers' | 'get_job_status';
  userId?: string;
  toolName?: string;
  resourceUri?: string;
  promptName?: string;
  params?: Record<string, unknown>;
  config?: ServerConfig;
  serverId?: string;
  jobId?: string;  // For get_job_status
}

export interface HubResponse {
  tools?: ToolSchema[];
  resources?: Array<{ uri: string; name: string; mimeType?: string }>;
  prompts?: Array<{ name: string; description?: string }>;
  result?: unknown;
  job_id?: string;
  status?: string;
  cached?: boolean;
  timestamp?: string;
  error?: string;
}

export interface UserServerRecord {
  id: string;
  user_id: string;
  server_id: string;
  name: string;
  transport: 'http' | 'stdio';
  config_encrypted: Uint8Array;
  enabled: boolean;
  logo_url?: string;
  created_at: string;
  updated_at: string;
}

export interface SystemServerRecord {
  id: string;
  ref_id: string;
  name: string;
  config: Record<string, unknown>;
  enabled: boolean;
  rate_limit_per_minute: number;
  logo_url?: string;
  created_at: string;
}
