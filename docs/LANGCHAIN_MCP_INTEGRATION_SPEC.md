# LangChain MCP Server Integration Specification

## Overview
This document specifies the requirements for integrating the LangChain Agent MCP server (`https://langchain-agent-mcp-server-554655392699.us-central1.run.app`) with Project Nexus.

## Current Status
- ✅ **PRODUCTION READY** (Dec 26, 2024)
- ✅ Tool name identified: `agent_executor`
- ✅ Request format: `{ tool: "agent_executor", arguments: { query: "..." } }`
- ✅ Server error fixed: `system_instruction` parameter now properly supported
- ✅ Tool listing endpoint added: `GET /tools` now available
- ✅ All endpoints tested and operational
- ✅ Client integration complete and tested

## Request Format

### Tool Invocation
**Endpoint:** `POST /mcp/invoke`

**Request Body:**
```json
{
  "tool": "agent_executor",
  "arguments": {
    "query": "user's query here"
  }
}
```

**Expected Response:**
```json
{
  "content": [
    {
      "type": "text",
      "text": "agent response here"
    }
  ],
  "isError": false
}
```

## Server Changes - **COMPLETED** ✅

### 1. Fix system_instruction Parameter Handling - **COMPLETED** ✅
**Status:** ✅ **DEPLOYED** (Dec 26, 2024)

**Changes Made:**
- ✅ Updated the `agent_executor` handler to only pass `system_instruction` to `get_agent()` if provided
- ✅ Enhanced parameter validation to handle `None`, empty strings, and whitespace-only values
- ✅ Improved error handling and fallback logic

### 2. Add Tool Listing Support - **COMPLETED** ✅
**Status:** ✅ **DEPLOYED** (Dec 26, 2024)

**Changes Made:**
- ✅ Added `GET /tools` endpoint that returns available tools
- ✅ Returns tools in MCP-compatible format

**Actual Response Format:**
```json
{
  "tools": [
    {
      "name": "agent_executor",
      "description": "Execute a complex, multi-step reasoning task...",
      "inputSchema": {
        "type": "object",
        "properties": {
          "query": {
            "type": "string",
            "description": "The user's query or task"
          },
          "system_instruction": {
            "type": "string",
            "description": "Optional system-level instructions"
          }
        },
        "required": ["query"]
      }
    }
  ]
}
```

## Testing

### Test Case 1: Basic Query
**Request:**
```json
{
  "tool": "agent_executor",
  "arguments": {
    "query": "What is 2+2?"
  }
}
```

**Expected:** Successful response with answer

### Test Case 2: Query with system_instruction (After Fix)
**Request:**
```json
{
  "tool": "agent_executor",
  "arguments": {
    "query": "What is 2+2?",
    "system_instruction": "You are a math teacher. Explain step by step."
  }
}
```

**Expected:** Successful response with step-by-step explanation

### Test Case 3: Tool Listing (After Implementation)
**Request:**
```json
{
  "tool": "list_tools",
  "arguments": {}
}
```

**Expected:** List of available tools including `agent_executor`

## References
- Server Repository: https://github.com/mcpmessenger/langchain-mcp
- Live Server: https://langchain-agent-mcp-server-554655392699.us-central1.run.app
- API Documentation: https://langchain-agent-mcp-server-554655392699.us-central1.run.app/docs

## Summary

**Status:** ✅ **PRODUCTION READY** (Dec 26, 2024)

**Server-Side Fixes (Completed):**
1. ✅ Fixed `system_instruction` parameter handling in `get_agent()` function
   - Parameter is now optional and only passed when provided
   - Server gracefully handles missing/empty values

2. ✅ Added tool listing support via `GET /tools` endpoint
   - Returns tools in MCP-compatible format
   - Enables dynamic tool discovery

3. ✅ All endpoints tested and operational
   - Health check: `/health`
   - Tool discovery: `/tools`
   - MCP manifest: `/mcp/manifest`
   - Agent execution: `/mcp/invoke`

**Client Code Status:**
- ✅ Updated to use `/tools` endpoint for tool discovery
- ✅ Supports `system_instruction` parameter (optional)
- ✅ Fallback hardcoded tool available if endpoint unavailable
- ✅ Comprehensive error handling and logging
- ✅ Production ready and tested

**Integration Status:**
- ✅ Client-server communication working
- ✅ Tool discovery functional
- ✅ Request/response format validated
- ✅ Error handling implemented
- ✅ Ready for production use
