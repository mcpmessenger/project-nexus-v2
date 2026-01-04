# Bug Report: Playwright Screenshot Timing Issue

## Issue Summary
Playwright MCP server attempts to take screenshots, but the browser opens and closes too quickly, resulting in no screenshot being captured. The page briefly flashes (visible in the browser window), but the screenshot is either empty, blank, or the operation fails before completion.

## Severity
**High** - Core functionality (screenshot capture) is non-functional

## Environment
- **Platform**: Windows 10 (win32 10.0.26100)
- **Node.js**: Available (npx working)
- **Playwright MCP**: `@playwright/mcp@latest` (via npx)
- **Transport**: stdio (spawn process)
- **Application**: Next.js API route (`/api/messages`)

## Observed Behavior

### User Reports
1. **First observation**: "the page flashed 2 x that time but its too fast for the page to load or playwright to grab a screenshot"
2. **Second observation**: Browser opens and closes rapidly, but no screenshot appears in chat
3. **Network response**: "imageUrl: null" in API response payload
4. **AI response**: "I am currently unable to install the browser or navigate to the page due to a technical issue"
5. **Observation (03:19 AM)**: "flashed 4 times so it trying" - Browser flashes 4 times indicating multiple attempts
6. **Error message (03:19 AM)**: "It appears that the browser context is closed, and I'm unable to open a new tab or perform any actions at the moment. Would you like me to try reinstalling the browser or proceed with a different request?"
7. **NEW Issue (03:40 AM)**: After persistent client implementation: "this time it kept opening blank browsers" - Multiple `about:blank` browser tabs/windows opening, browser appears locked/in-use. Error: "It seems that the browser is currently in use and I cannot navigate or take a screenshot at this time."

### Technical Observations
- Browser window briefly appears (flash visible)
- Playwright MCP process spawns successfully
- Tool calls are being made (`playwright_browser_navigate`, `playwright_browser_screenshot`)
- No screenshot data is extracted from tool results
- No errors in initial tool execution (process spawns successfully)

## Root Cause Analysis

### Hypothesis 1: Timing Issue (Most Likely)
The browser opens, navigates to the page, but the screenshot is taken before the page fully loads. Playwright's `browser_screenshot` tool may not be waiting for the page's load event.

**Evidence**:
- User reports "too fast for the page to load"
- Browser window flashes but no content captured
- No explicit wait between navigation and screenshot in current implementation

### Hypothesis 2: MCP Process Lifecycle (ROOT CAUSE - CONFIRMED)
The stdio process closes immediately after each tool call, causing browser context to be lost between navigation and screenshot operations. This is a **stateless implementation issue** where each tool call spawns a brand-new process.

**Evidence**:
- Each tool call spawns a new `npx @playwright/mcp@latest` process
- Browser context is not persistent between calls (process terminates after JSON response)
- Process closes immediately after JSON response is received
- Error message explicitly states "browser context is closed"
- Browser flashes 4 times, suggesting multiple rapid spawn/close cycles
- Navigation wait enhancement didn't help, indicating issue is at process lifecycle level, not timing
- **ROOT CAUSE**: On Windows, `spawn` terminates the child process immediately upon receiving the final data chunk. When `browser_navigate` completes, its process dies. When `browser_screenshot` is called, it spawns a NEW process with no memory of the previous navigation, leading to "browser context is closed" error.

**Analysis**: The current implementation is stateless. BrowserContext in Playwright lives in memory - if the process restarts between tools, the context is wiped. The 4 flashes are the AI retrying/chain-commanding, with each attempt spawning a window that closes before capture.

### Hypothesis 3: Browser Installation
Playwright browsers may not be installed, causing operations to fail silently or with unclear errors.

**Evidence**:
- AI mentions "unable to install the browser"
- First-time Playwright setup requires `npx playwright install`
- No explicit browser installation check in code

### Hypothesis 4: Error Handling
Errors from Playwright MCP might not be properly captured or logged, making it difficult to diagnose the actual failure.

**Evidence**:
- Limited error logging in stdio transport
- Errors may be swallowed or not properly propagated
- User sees generic error messages

## What We've Tried

### 1. System Message Updates
**Attempt**: Updated system message to instruct AI to wait after navigation before taking screenshot.

**Code Location**: `app/api/messages/route.ts` (lines 61-75)

**Changes**:
- Added explicit instructions: "After calling playwright_browser_navigate, wait 2-3 seconds or use playwright_browser_wait_for_load_state before taking the screenshot"

**Result**: ❌ No improvement - AI still attempts screenshot too quickly

### 2. Error Logging Enhancement
**Attempt**: Added detailed error logging to capture stderr output from Playwright processes.

**Code Location**: `lib/mcpClient.ts` (callStdioTransport function)

**Changes**:
- Added real-time stderr logging
- Added process exit code logging
- Added command execution logging

**Result**: ⚠️ Partially reverted by user - logging may not be active

### 3. Screenshot Extraction Logic
**Attempt**: Enhanced screenshot extraction to handle multiple response formats from Playwright MCP.

**Code Location**: `app/api/messages/route.ts` (lines 282-354)

**Changes**:
- Added extraction for `content` array format: `{ content: [{ type: "image", data: "base64...", mimeType: "image/png" }] }`
- Added extraction for legacy/direct data formats
- Added nested result extraction
- Added detailed logging for debugging

**Result**: ✅ Code is in place, but no screenshot data is being received from Playwright

### 4. Function Name Fix
**Attempt**: Fixed OpenAI function naming to use underscores instead of slashes.

**Code Location**: `lib/tools-helper.ts`

**Changes**:
- Changed from `server/toolname` to `server_toolname` format
- Updated parsing logic in `invokeToolByName`

**Result**: ✅ Fixed OpenAI API compatibility, but timing issue persists

### 5. Windows npx Execution Fix
**Attempt**: Fixed Windows-specific npx execution using `npx.cmd` and shell mode.

**Code Location**: `lib/mcpClient.ts` (callStdioTransport)

**Changes**:
- Detect Windows platform
- Use `npx.cmd` on Windows
- Enable shell mode for Windows

**Result**: ✅ Process spawns successfully, but timing issue persists

### 6. Automatic Navigation Wait Enhancement (LATEST)
**Attempt**: Automatically inject `waitUntil: 'networkidle'` parameter into Playwright navigation calls to ensure pages load fully before screenshots.

**Code Location**: `lib/tools-helper.ts` (enhancePlaywrightNavigationArgs function, lines 202-212)

**Changes**:
- Created `enhancePlaywrightNavigationArgs` function that intercepts `browser_navigate` tool calls
- Automatically adds `waitUntil: 'networkidle'` and `timeout: 30000` to navigation arguments
- Applied enhancement in `invokeToolByName` for all Playwright server tool calls
- Added logging when navigation args are enhanced

**Result**: ❌ Issue persists - Browser still flashes 4 times, error: "browser context is closed, and I'm unable to open a new tab or perform any actions"

**Observation**: The browser context appears to be closing immediately after opening, suggesting the MCP process lifecycle issue (Hypothesis 2) may be the root cause rather than just a timing issue.

### 7. Windows Buffer Delay (LATEST)
**Attempt**: Add a 1-second delay after screenshot operations on Windows to allow frame buffer to capture image data.

**Code Location**: `lib/tools-helper.ts` (invokeToolByName function, after tool execution)

**Changes**:
- Added platform check for Windows (`process.platform === 'win32'`)
- Added 1-second delay after `browser_screenshot` tool calls on Windows
- Delay occurs after tool execution but before returning result

**Result**: ❌ No improvement - Browser context closes before delay can take effect

## What We Haven't Tried (Potential Solutions)

### Solution 1: Add Explicit Wait in Tool Call
**Approach**: Modify the tool invocation to include a wait parameter or call a wait tool between navigation and screenshot.

**Challenges**:
- Requires AI to make multiple tool calls in sequence
- No guarantee AI will wait the correct amount of time
- Depends on AI following instructions correctly

### Solution 2: Combine Navigation and Screenshot in Single Call
**Approach**: Create a wrapper tool that combines navigation + wait + screenshot in one atomic operation.

**Challenges**:
- Would need to modify Playwright MCP server (not our code)
- Or create a custom wrapper tool
- Increases complexity

### Solution 3: Increase Timeout/Add Retry Logic
**Approach**: Add timeout configuration to Playwright tool calls, or implement retry logic with delays.

**Challenges**:
- Need to understand Playwright MCP timeout options
- May need to modify stdio transport to support timeouts
- Retry logic adds complexity

### Solution 4: Check Browser Installation
**Approach**: Add a pre-flight check to ensure Playwright browsers are installed before attempting screenshots.

**Implementation**:
```typescript
// Check if browsers are installed
await exec('npx playwright install --dry-run')
```

**Challenges**:
- Adds startup overhead
- May not solve timing issue if browsers are installed

### Solution 5: Use Playwright's waitForLoadState
**Approach**: Ensure the AI calls `browser_wait_for_load_state` tool between navigate and screenshot.

**Challenges**:
- Requires AI to make the correct sequence of calls
- Depends on system message instructions being followed
- May need to make this more explicit in tool descriptions

### Solution 6: Persistent Browser Context
**Approach**: Maintain a persistent browser context across multiple tool calls instead of spawning new processes.

**Challenges**:
- Requires significant architecture changes
- MCP stdio transport spawns new process per call
- Would need custom Playwright integration outside of MCP

### Solution 7: Add Delay Parameter to Screenshot Tool
**Approach**: Modify screenshot tool call to include an explicit delay parameter.

**Challenges**:
- Need to check if Playwright MCP screenshot tool supports delay
- Would need to modify tool parameters
- May not be supported by Playwright MCP server

## Recommended Next Steps (UPDATED)

### High Priority - IMPLEMENTATION REQUIRED

1. **Implement Persistent Playwright MCP Client** (CRITICAL - ROOT CAUSE FIX)
   - **Problem**: Current implementation is stateless - each tool call spawns new process
   - **Solution**: Create a persistent/singleton client that maintains the Playwright MCP process across multiple tool calls
   - **Approach Options**:
     a. **Persistent Process Manager**: Refactor `lib/mcpClient.ts` to maintain a long-running process for Playwright
     b. **Session Wrapper**: Implement an atomic wrapper in `lib/tools-helper.ts` that executes multiple Playwright commands within the same process execution
     c. **Combined Tool**: Check if Playwright MCP supports a tool that performs navigation + screenshot in a single call
   - **Implementation Notes**:
     - Use singleton pattern similar to `PulsarClient` in `lib/pulsar-client.ts`
     - Process should stay alive for the duration of a request session (or longer with cleanup)
     - Need to handle process cleanup on application shutdown
     - May need to implement connection pooling or session management

2. **Add Detailed Process Logging**
   - Log process spawn time, execution time, and close time for each Playwright tool call
   - Capture full stderr/stdout output from Playwright MCP process
   - Log process exit codes and any error messages
   - This will confirm if processes are closing prematurely

3. **Test Playwright MCP Directly**
   - Test Playwright MCP server manually via command line to verify it works standalone
   - Use `npx @playwright/mcp@latest` directly and send JSON-RPC commands
   - Verify if browser context persists across multiple tool calls in standalone mode
   - This will isolate if issue is with our integration or Playwright MCP itself

### Medium Priority

4. **Check Playwright Browser Installation**
   - Run `npx playwright install` to ensure browsers are installed
   - Add installation check to startup or error handling
   - Verify browser binaries are accessible

5. **Review Playwright MCP Documentation**
   - Check official Playwright MCP documentation for best practices
   - Look for examples of navigation + screenshot workflows
   - Verify if there are known issues with browser context lifecycle
   - Check if there's a recommended pattern for multi-step operations

### Lower Priority

6. **Consider Alternative Approaches**
   - Evaluate if stdio transport is appropriate for Playwright (may need persistent connection)
   - Consider if HTTP/SSE transport would work better for long-running operations
   - Research if other MCP servers handle similar timing/lifecycle issues
   - Investigate if we need a different integration pattern for browser automation

7. **Test with Simpler URLs**
   - Try with very simple pages (e.g., plain HTML)
   - Test if timing varies with page complexity
   - Verify if issue is universal or page-specific

## Code Locations Reference

- **Main API Route**: `app/api/messages/route.ts`
- **MCP Client**: `lib/mcpClient.ts`
- **Tool Helper**: `lib/tools-helper.ts`
- **System Message**: `app/api/messages/route.ts` (lines 61-75)
- **Screenshot Extraction**: `app/api/messages/route.ts` (lines 282-354)
- **Playwright Config**: `supabase/migrations/20240101000000_create_core_tables.sql` (line 68)

## Related Issues
- Initial Playwright integration setup
- Windows npx execution fix
- OpenAI function naming compatibility
- Screenshot extraction and display in chat UI

## Status
**PARTIALLY RESOLVED** - Hypothesis 2 (MCP Process Lifecycle) was confirmed and persistent client implemented. However, new issue emerged: persistent process is creating multiple browser instances/contexts, causing browser lock errors and multiple blank browser windows.

**Current State (2024-01-04)**:
- ✅ Persistent client implemented - process stays alive across tool calls
- ❌ New issue: Multiple browser instances being created, causing "browser is currently in use" errors
- ❌ Browser contexts not being properly reused/cleaned up
- ❌ Multiple `about:blank` tabs/windows opening instead of navigating to target URL

## Confirmed Root Cause (2024-01-XX)

**The Problem**: The current implementation spawns a new `npx @playwright/mcp@latest` process for each tool call. When `browser_navigate` completes, its process terminates. When `browser_screenshot` is called, it spawns a NEW process with no memory of the previous navigation, leading to "browser context is closed" error.

**Why it happens**:
- On Windows, `spawn` terminates the child process immediately upon receiving the final data chunk
- BrowserContext in Playwright lives in process memory - when the process dies, the context is wiped
- The 4 flashes are the AI retrying/chain-commanding, with each attempt spawning a window that closes before capture

**The Fix Required**: Move from stateless (spawn-per-call) to stateful (persistent process) architecture for Playwright MCP.

## Priority
**High** - Blocks core screenshot functionality

## Assignee
TBD

## Labels
`bug`, `playwright`, `mcp`, `screenshot`, `timing`, `high-priority`
