/**
 * MCP Client for Deno
 * Ported from Node.js implementation with HTTP/SSE transport support
 */

import type { ServerConfig, ToolSchema } from "./types.ts";

interface JsonRpcEnvelope {
  jsonrpc: "2.0";
  id: string;
  method: string;
  params: Record<string, unknown>;
}

interface JsonRpcResponse<T = unknown> {
  jsonrpc: "2.0";
  id?: string;
  result?: T;
  error?: {
    code?: number;
    message: string;
    data?: unknown;
  };
}

/**
 * Extract tools from JSON-RPC response
 */
function extractTools(response: JsonRpcResponse): ToolSchema[] {
  if (!response) return [];
  
  const candidate = response.result ?? response;
  
  if (Array.isArray(candidate)) {
    return candidate as ToolSchema[];
  }
  
  if (typeof candidate === "object" && candidate !== null && "tools" in candidate) {
    const raw = (candidate as { tools?: unknown }).tools;
    if (Array.isArray(raw)) {
      return raw as ToolSchema[];
    }
  }
  
  return [];
}

/**
 * Read JSON from SSE stream
 */
async function readSseJson(
  stream: ReadableStream<Uint8Array> | null
): Promise<JsonRpcResponse> {
  if (!stream) {
    throw new Error("Empty SSE stream");
  }

  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let lastPayload: JsonRpcResponse | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";
    
    for (const chunk of chunks) {
      const event = chunk.trim();
      if (!event) continue;
      
      const dataLine = event
        .split("\n")
        .map((line) => line.trim())
        .find((line) => line.startsWith("data:"));
      
      if (!dataLine) continue;
      
      const payload = dataLine.slice("data:".length).trim();
      if (!payload || payload === "[DONE]") continue;
      
      try {
        lastPayload = JSON.parse(payload);
      } catch (error) {
        console.warn("Unable to parse SSE payload", error);
      }
    }
  }

  // Handle trailing buffer
  if (buffer) {
    const dataLine = buffer
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.startsWith("data:"));
    
    if (dataLine) {
      const payload = dataLine.slice("data:".length).trim();
      if (payload && payload !== "[DONE]") {
        try {
          lastPayload = JSON.parse(payload);
        } catch (error) {
          console.warn("Unable to parse trailing SSE payload", error);
        }
      }
    }
  }

  if (!lastPayload) {
    throw new Error("No JSON-RPC payload received from SSE stream");
  }

  return lastPayload;
}

/**
 * Call MCP server via HTTP/SSE transport
 */
async function callSseTransport(
  config: ServerConfig,
  payload: JsonRpcEnvelope
): Promise<JsonRpcResponse> {
  if (!config.url) {
    throw new Error("HTTP transport requires a target URL");
  }

  const response = await fetch(config.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      ...(config.headers || {}),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const bodyText = await response.text();
    throw new Error(
      `MCP HTTP transport responded with ${response.status}. Body: ${bodyText}`
    );
  }

  const parsed = await readSseJson(response.body);
  if (parsed.error) {
    throw new Error(parsed.error.message);
  }

  return parsed;
}

/**
 * MCP Client class for Deno
 */
export class McpClient {
  constructor(public config: ServerConfig) {}

  /**
   * Call an MCP method
   */
  async call(method: string, params: Record<string, unknown> = {}): Promise<JsonRpcResponse> {
    const payload: JsonRpcEnvelope = {
      jsonrpc: "2.0",
      id: `mcp-${crypto.randomUUID()}`,
      method,
      params,
    };

    if (this.config.transport === "stdio") {
      throw new Error("Stdio transport not supported in Deno Edge Functions");
    }

    return callSseTransport(this.config, payload);
  }

  /**
   * List available tools from the MCP server
   */
  async listTools(): Promise<ToolSchema[]> {
    try {
      const response = await this.call("tools/list", {});
      return extractTools(response);
    } catch (error) {
      console.error("Failed to list tools:", error);
      throw error;
    }
  }

  /**
   * List available resources from the MCP server
   */
  async listResources(): Promise<Array<{ uri: string; name: string; mimeType?: string }>> {
    try {
      const response = await this.call("resources/list", {});
      const result = response.result;
      
      if (Array.isArray(result)) {
        return result;
      }
      
      if (typeof result === "object" && result !== null && "resources" in result) {
        const resources = (result as { resources?: unknown }).resources;
        if (Array.isArray(resources)) {
          return resources;
        }
      }
      
      return [];
    } catch (error) {
      console.error("Failed to list resources:", error);
      return [];
    }
  }

  /**
   * List available prompts from the MCP server
   */
  async listPrompts(): Promise<Array<{ name: string; description?: string }>> {
    try {
      const response = await this.call("prompts/list", {});
      const result = response.result;
      
      if (Array.isArray(result)) {
        return result;
      }
      
      if (typeof result === "object" && result !== null && "prompts" in result) {
        const prompts = (result as { prompts?: unknown }).prompts;
        if (Array.isArray(prompts)) {
          return prompts;
        }
      }
      
      return [];
    } catch (error) {
      console.error("Failed to list prompts:", error);
      return [];
    }
  }

  /**
   * Invoke a tool
   */
  async invokeTool(toolName: string, params: Record<string, unknown>): Promise<unknown> {
    const response = await this.call("tools/call", {
      name: toolName,
      arguments: params,
    });
    
    if (response.error) {
      throw new Error(response.error.message);
    }
    
    return response.result;
  }

  /**
   * Health check
   */
  async health(): Promise<{ healthy: boolean; message?: string }> {
    try {
      const tools = await this.listTools();
      return {
        healthy: true,
        message: `Responding with ${tools.length} tool(s)`,
      };
    } catch (error) {
      return {
        healthy: false,
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}
