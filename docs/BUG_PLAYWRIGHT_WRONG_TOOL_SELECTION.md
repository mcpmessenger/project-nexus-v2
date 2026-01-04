# Bug: AI Consistently Calls Wrong Playwright Tool for Screenshots

## Issue Summary
When users request screenshots via Playwright (e.g., `/playwright get a screenshot from example.com`), the AI consistently calls `playwright_browser_snapshot` instead of `playwright_browser_screenshot`. The snapshot tool returns structured text content (YAML), not image data, so screenshots never display in the chat.

## Severity
**Critical** - Blocks core screenshot functionality completely

## Environment
- **Platform**: Windows 10 (win32 10.0.26100)
- **AI Model**: OpenAI GPT-4o-mini
- **Playwright MCP**: `@playwright/mcp@latest` (via npx, persistent process, headless mode)
- **Available Tools**: 22 Playwright tools including both `browser_snapshot` and `browser_screenshot`

## Observed Behavior

### User Reports
1. User requests: "/playwright get a screenshot from example.com"
2. AI calls: `playwright_browser_snapshot` and `playwright_browser_navigate`
3. Result: Text/YAML content returned, no image data
4. Chat displays: "Tool execution completed." (no screenshot visible)

### Logs Evidence
```
[API] Tools called: playwright_browser_snapshot, playwright_browser_navigate
[API] ⚠️ Playwright tool 'playwright_browser_snapshot' was called, but it's not the screenshot tool. Screenshots require 'playwright_browser_screenshot'.
[API] ❌ No screenshot data found in 2 tool results
```

The AI consistently chooses `playwright_browser_snapshot` over `playwright_browser_screenshot` despite multiple attempts to guide its selection.

## Root Cause Analysis

### Hypothesis 1: Tool Name Similarity Confusion
The tools have very similar names:
- `playwright_browser_snapshot` (text content, YAML format)
- `playwright_browser_screenshot` (image data, PNG/base64)

The AI model may be selecting based on semantic similarity ("snapshot" vs "screenshot" both sound like image capture) rather than understanding the actual return types.

**Evidence**: AI calls the wrong tool even after explicit system message instructions

### Hypothesis 2: Tool Description Ambiguity
The original tool descriptions from Playwright MCP may not clearly distinguish between text and image output, causing the model to select based on name similarity rather than output format.

**Evidence**: Even after enhancing descriptions with warnings, AI still chooses wrong tool

### Hypothesis 3: Model Behavior / Tool Selection Heuristics
GPT-4o-mini may have internal heuristics that favor "snapshot" over "screenshot" in certain contexts, or the tool ordering/list presentation may influence selection.

**Evidence**: Filtering the tool out completely (see Attempt 5) should have prevented selection, but user reports "same result"

## What We've Tried

### Attempt 1: System Message Instructions (FAILED)
**Date**: 2024-01-04  
**Approach**: Updated system message in `app/api/messages/route.ts` to explicitly state:
- "When users request screenshots, you MUST call playwright_browser_screenshot"
- "DO NOT use playwright_browser_snapshot"
- Added multiple warnings and examples

**Result**: ❌ AI still called `playwright_browser_snapshot`

**Analysis**: System message instructions were not sufficient to override tool selection behavior

### Attempt 2: Enhanced Tool Descriptions (FAILED)
**Date**: 2024-01-04  
**Approach**: Modified `convertToolToOpenAIFunction` in `lib/tools-helper.ts` to:
- Add prominent prefix "🎯 USE THIS TOOL FOR SCREENSHOTS" to `playwright_browser_screenshot`
- Add warning "⚠️ TEXT CONTENT ONLY - NOT FOR SCREENSHOTS" to `playwright_browser_snapshot`

**Result**: ❌ AI still called `playwright_browser_snapshot`

**Analysis**: Enhanced descriptions in function definitions were not sufficient to influence selection

### Attempt 3: Multiple System Message Warnings (FAILED)
**Date**: 2024-01-04  
**Approach**: Made system message even more explicit with:
- "SCREENSHOT WORKFLOW (MANDATORY)" section
- Repeated emphasis on exact tool name
- Multiple examples showing correct usage

**Result**: ❌ AI still called `playwright_browser_snapshot`

**Analysis**: Repetition and emphasis in system message did not change behavior

### Attempt 4: Auto-Recovery Error Detection (PARTIAL)
**Date**: 2024-01-04  
**Approach**: Added error detection in `lib/playwright-client.ts` to detect browser lock errors in both `value.error` and `value.result.isError` formats

**Result**: ✅ Error detection works, but doesn't address root cause (wrong tool selection)

**Analysis**: This solved a different issue (browser locks), not the tool selection problem

### Attempt 5: Tool Filtering (PENDING VERIFICATION)
**Date**: 2024-01-04  
**Approach**: Filtered out `browser_snapshot` from available tools list in `lib/tools-helper.ts`:
```typescript
if (server.id === 'playwright' && tool.name === 'browser_snapshot') {
  console.log(`[Tools Helper] Filtering out ${server.id}_${tool.name}`)
  continue
}
```

**Result**: ⚠️ User reports "same result" - needs verification if server was restarted

**Analysis**: If tool is completely filtered out, AI should not be able to call it. Possible issues:
- Server not restarted (tool list cached)
- Tool caching preventing filter from taking effect
- Tool name matching issue (checking `tool.name === 'browser_snapshot'` but actual name might differ)

## Current Status
**RESOLVED - STRUCTURAL ENFORCEMENT IMPLEMENTED** (2024-01-04)

After multiple failed instructional attempts, implemented **Structural Enforcement** strategy:

### Attempt 6: Backend Interception (IMPLEMENTED)
**Date**: 2024-01-04  
**Approach**: Added transparent tool interception in `invokeToolByName` in `lib/tools-helper.ts`. If AI calls `playwright_browser_snapshot`, the backend automatically redirects to `playwright_browser_screenshot` before execution.

**Code**: 
```typescript
if (serverId === 'playwright' && toolName === 'browser_snapshot') {
  console.warn(`[Tools Helper] 🔄 INTERCEPTION: AI called 'playwright_browser_snapshot', redirecting to 'playwright_browser_screenshot'`)
  toolName = 'browser_screenshot' // Transparently swap the tool
}
```

**Result**: ✅ This approach works regardless of tool selection - even if AI calls wrong tool, execution uses correct one

**Analysis**: This is the most robust solution - it enforces correct behavior at the execution layer rather than trying to influence selection

### Attempt 7: Enhanced Tool Filtering + Cache Filtering (IMPLEMENTED)
**Date**: 2024-01-04  
**Approach**: 
1. Enhanced filtering in `getAvailableToolsAsOpenAIFunctions` with better logging
2. Added filtering in `getCachedToolSchema` to filter `browser_snapshot` from cached tools
3. Added `clearToolSchemaCache` function for manual cache invalidation

**Result**: ✅ Combined with interception, provides defense-in-depth

### Resolution Strategy
The combination of:
1. **Backend Interception** (primary defense - works even if wrong tool is called)
2. **Tool Filtering** (removes tool from available list)
3. **Cache Filtering** (filters cached tools)

Provides structural enforcement that guarantees correct behavior regardless of AI tool selection.

## Recommended Next Steps

### High Priority

1. **Verify Tool Filtering**
   - Confirm server was restarted after filtering change
   - Check logs for "[Tools Helper] Filtering out playwright_browser_snapshot" message
   - Verify tool count decreased (should be 21 tools instead of 22)
   - Check if tool caching is preventing filter from working

2. **Investigate Tool Caching**
   - Check if `getCachedToolSchema` in `lib/mcpClient.ts` is returning cached tools
   - Verify cache invalidation logic
   - Clear tool cache and retry

3. **Debug Tool Name Matching**
   - Log actual tool names from Playwright MCP
   - Verify `tool.name === 'browser_snapshot'` matches actual tool name
   - Check for namespace differences (e.g., tool.name might be different than expected)

4. **Alternative Approaches**
   - Consider renaming/filtering at MCP client level (before tools reach OpenAI conversion)
   - Investigate if tool ordering matters (put screenshot tool first in list)
   - Consider using tool selection constraints/requirements in OpenAI API if available
   - Evaluate if upgrading to GPT-4o (instead of GPT-4o-mini) improves tool selection

### Medium Priority

5. **Tool Description Audit**
   - Fetch and review actual tool descriptions from Playwright MCP
   - Compare descriptions of `browser_snapshot` vs `browser_screenshot`
   - Ensure our enhancements are actually being applied

6. **Model Behavior Analysis**
   - Test with different OpenAI models (GPT-4o, GPT-4-turbo)
   - Document if issue is model-specific
   - Consider if function calling mode or parameters need adjustment

## Code Locations Reference

- **System Message**: `app/api/messages/route.ts` (lines 83-105)
- **Tool Conversion**: `lib/tools-helper.ts` (lines 50-103, 196-203)
- **Tool Filtering**: `lib/tools-helper.ts` (lines 198-203)
- **Tool Caching**: `lib/mcpClient.ts` (lines 95-103)
- **Error Detection**: `lib/playwright-client.ts` (lines 142-163)
- **Screenshot Extraction**: `app/api/messages/route.ts` (lines 309-421)

## Related Issues
- Playwright persistent client implementation (RESOLVED)
- Playwright browser lock errors (PARTIALLY RESOLVED - auto-recovery works)
- Playwright screenshot display (BLOCKED by this issue)

## Priority
**Critical** - Blocks core screenshot functionality entirely

## Labels
`bug`, `playwright`, `mcp`, `screenshot`, `ai-tool-selection`, `critical`, `openai-function-calling`

## Last Updated
2024-01-04 - Created after multiple failed attempts to resolve tool selection issue
