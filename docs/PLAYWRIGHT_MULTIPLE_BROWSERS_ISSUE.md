# Playwright Multiple Browser Instances Issue

## Issue Summary
After implementing the persistent client solution, a new issue emerged: Playwright is creating multiple browser instances/contexts, resulting in:
- Multiple `about:blank` browser tabs/windows opening
- "Browser is currently in use" errors
- Browser lock/contention issues preventing navigation

## Severity
**High** - Blocks screenshot functionality even with persistent client

## Environment
- **Platform**: Windows 10 (win32 10.0.26100)
- **Implementation**: Persistent Playwright MCP Client (`lib/playwright-client.ts`)
- **Playwright MCP**: `@playwright/mcp@latest` (via npx, persistent process)
- **Transport**: stdio (persistent process)

## Observed Behavior

### User Reports
1. **03:40 AM**: "this time it kept opening blank browsers" when requesting screenshot of example.com
2. **Error Message**: "It seems that the browser is currently in use and I cannot navigate or take a screenshot at this time."
3. **Visual Evidence**: Multiple `about:blank` browser tabs visible in browser window

### Technical Observations
- Persistent process is working (process stays alive)
- Multiple browser instances/contexts being created
- Browser appears locked/in-use after first instance
- Navigation commands may not be reaching the browser or browser contexts aren't being reused
- Screenshots not being captured due to browser lock

## Root Cause Analysis

### Hypothesis 1: Multiple Browser Context Creation
Each tool call (navigate, screenshot) might be creating a new browser context instead of reusing an existing one.

**Evidence**:
- Multiple `about:blank` tabs visible
- "Browser is currently in use" error suggests resource contention
- Playwright MCP might default to creating new contexts per operation

### Hypothesis 2: Browser Context Not Shared Between Tools
Playwright MCP's browser_navigate and browser_screenshot tools might not share the same browser context by default.

**Evidence**:
- Persistent process maintains connection
- But browser contexts might be isolated per tool call
- Need to verify if Playwright MCP supports context reuse

### Hypothesis 3: Browser Instance Lock
The first browser instance created locks the browser resource, preventing subsequent operations.

**Evidence**:
- Error explicitly states "browser is currently in use"
- Suggests Playwright's browser instances aren't designed for concurrent access
- May need explicit context management/reuse

## What We've Tried

### 1. Persistent Client Implementation
**Attempt**: Implemented singleton process manager to keep Playwright MCP process alive.

**Result**: ✅ Process stays alive, but browser instances are accumulating

### 2. Auto-Recovery Logic (2024-01-04)
**Attempt**: Added error detection in `PlaywrightMcpManager.call()` to detect browser lock errors ("browser is currently in use", "browser context is closed", etc.) and automatically reset the process.

**Implementation**: Wrapped the resolve function to check for browser lock errors before resolving. When detected, automatically calls `cleanup()` to force process reset on next call.

**Result**: ✅ Auto-recovery implemented - process will reset automatically when browser lock errors are detected

### 3. System Message Update (2024-01-04)
**Attempt**: Updated system message to explicitly instruct AI to NOT open multiple tabs and to reuse existing browser pages.

**Result**: ✅ System message updated to prevent multiple tab creation

### 4. Headless Mode Configuration (2024-01-04)
**Attempt**: Added `--headless` flag to Playwright MCP configuration to prevent browser window flashing and reduce resource contention on Windows.

**Implementation**: 
- Updated `applyServerConfig` in `lib/tools-helper.ts` to add `--headless` to Playwright args
- Updated `ensurePlaywrightConfig` in `supabase/functions/nexus-hub/servers/playwright.ts` to ensure `--headless` is present
- Updated database migration to include `--headless` for new installations

**Result**: ✅ Headless mode enabled - browser will run without visible windows, reducing Windows-specific window-focus locking issues

## Recommended Next Steps

### High Priority

1. **Investigate Playwright MCP Browser Context Management**
   - Check Playwright MCP documentation for browser context lifecycle
   - Verify if contexts are shared between tool calls or created per call
   - Look for context reuse/reference mechanisms

2. **Add Browser Context Cleanup**
   - Implement browser context cleanup between operations if needed
   - Check if Playwright MCP has a "close browser" or "reset context" tool
   - Consider closing browser instances after screenshot operations

3. **Test Browser Context Reuse**
   - Check if Playwright MCP maintains a single browser context across calls
   - Verify if browser_navigate and browser_screenshot share the same context
   - Test if multiple contexts are causing the lock

4. **Review Playwright MCP Tool Documentation**
   - Check official Playwright MCP documentation for browser context management
   - Look for best practices on context reuse
   - Verify if there's a recommended pattern for navigation + screenshot workflows

### Medium Priority

5. **Add Process/Browser Reset Capability**
   - Implement a way to reset the Playwright process if browser gets stuck
   - Add cleanup between request sessions
   - Consider restarting process if browser lock errors occur

6. **Investigate Browser Instance Limits**
   - Check if there's a limit on concurrent browser instances
   - Verify if Playwright MCP enforces single-instance policy
   - Test if multiple instances are expected or a bug

## Code Locations Reference

- **Persistent Client**: `lib/playwright-client.ts`
- **Tool Invocation**: `lib/tools-helper.ts`
- **System Message**: `app/api/messages/route.ts` (lines 81-85)

## Related Issues
- Original timing/process lifecycle issue (RESOLVED with persistent client)
- Browser context management (NEW ISSUE)

## Status
**PARTIALLY RESOLVED** - Auto-recovery logic implemented to detect and reset on browser lock errors. System message updated to prevent multiple tab creation. Monitoring for effectiveness.

## Priority
**High** - Blocks screenshot functionality

## Labels
`bug`, `playwright`, `mcp`, `browser-context`, `persistent-client`, `high-priority`
