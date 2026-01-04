/**
 * Job Queue
 * Handles async job creation and execution for long-running operations
 */

import { createClient } from "jsr:@supabase/supabase-js@2";
import { getAllServers, getServerById } from "../servers/registry.ts";
import { McpClient } from "./mcp_client.ts";

export interface JobParams {
  userId: string;
  jobType: 'tool_invoke' | 'resource_fetch' | 'prompt_execute';
  serverId: string;
  toolName?: string;
  params: Record<string, unknown>;
}

/**
 * Create a new async job and trigger execution via pg_net
 * The job will be executed asynchronously by pg_net calling the /internal/job-executor endpoint
 */
export async function createJob(
  supabase: ReturnType<typeof createClient>,
  jobParams: JobParams
): Promise<string> {
  // Insert job record
  const { data: job, error: insertError } = await supabase
    .from('job_results')
    .insert({
      user_id: jobParams.userId,
      job_type: jobParams.jobType,
      server_id: jobParams.serverId,
      tool_name: jobParams.toolName || null,
      params: jobParams.params,
      status: 'pending'
    })
    .select('id')
    .single();

  if (insertError || !job) {
    throw new Error(`Failed to create job: ${insertError?.message}`);
  }

  const jobId = job.id;

  // Trigger background execution via pg_net (calls PostgreSQL function)
  const { error: triggerError } = await supabase.rpc('execute_job_via_pg_net', {
    job_id: jobId
  });

  if (triggerError) {
    // Mark job as failed if trigger fails
    await supabase
      .from('job_results')
      .update({ 
        status: 'failed', 
        error: `Failed to trigger job execution: ${triggerError.message}` 
      })
      .eq('id', jobId);
    
    throw new Error(`Failed to trigger job execution: ${triggerError.message}`);
  }
  
  return jobId;
}

/**
 * Get job status and result
 */
export async function getJobStatus(
  supabase: ReturnType<typeof createClient>,
  jobId: string
) {
  const { data, error } = await supabase
    .from('job_results')
    .select('*')
    .eq('id', jobId)
    .single();

  if (error) {
    throw new Error(`Failed to get job status: ${error.message}`);
  }

  return data;
}

/**
 * Execute job (called by pg_net or internal executor)
 */
export async function executeJob(
  supabase: ReturnType<typeof createClient>,
  jobId: string,
  jobType: string,
  serverId: string,
  toolName: string | null,
  params: Record<string, unknown>,
  userId: string
) {
  try {
    // Update job status to running (if not already)
    await supabase
      .from('job_results')
      .update({ status: 'running', started_at: new Date().toISOString() })
      .eq('id', jobId)
      .eq('status', 'pending');

    // Get server configuration
    const servers = await getAllServers(supabase, userId);
    const server = servers.find((s) => s.id === serverId);

    if (!server) {
      throw new Error(`Server not found: ${serverId}`);
    }

    // Execute the actual job (call MCP server, etc.)
    if (jobType === 'tool_invoke' && toolName) {
      const client = new McpClient(server.config);
      const result = await client.invokeTool(toolName, params);

      // Update job with result
      await supabase
        .from('job_results')
        .update({
          status: 'completed',
          result: result,
          completed_at: new Date().toISOString()
        })
        .eq('id', jobId);
    } else {
      throw new Error(`Unsupported job type: ${jobType}`);
    }
  } catch (error) {
    // Update job with error
    await supabase
      .from('job_results')
      .update({
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        completed_at: new Date().toISOString()
      })
      .eq('id', jobId);

    throw error;
  }
}

/**
 * Cancel a job
 */
export async function cancelJob(
  supabase: ReturnType<typeof createClient>,
  jobId: string
): Promise<void> {
  await supabase
    .from('job_results')
    .update({
      status: 'cancelled',
      completed_at: new Date().toISOString()
    })
    .eq('id', jobId)
    .in('status', ['pending', 'running']);
}
