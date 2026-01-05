import { NextResponse } from "next/server"
import OpenAI from "openai"
import { getAvailableToolsAsOpenAIFunctions, invokeToolByName } from "@/lib/tools-helper"
import { readFileSync } from "fs"
import { existsSync } from "fs"

// Test endpoint
export async function GET() {
  return NextResponse.json({ 
    message: "Messages API is working",
    hasOpenAIKey: !!process.env.OPENAI_API_KEY,
    hasBraveKey: !!process.env.BRAVE_API_KEY,
    braveKeyLength: process.env.BRAVE_API_KEY?.length || 0,
    braveKeyPreview: process.env.BRAVE_API_KEY ? `${process.env.BRAVE_API_KEY.substring(0, 10)}...` : 'not set',
    allBraveEnvVars: Object.keys(process.env).filter(key => key.includes('BRAVE')),
    cwd: process.cwd(),
  })
}

// Ingest endpoint for submitting messages to OpenAI
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { content, imageUrl, provider = "openai", apiKey } = body

    // Get API key based on provider
    let apiKeyToUse: string | undefined
    if (provider === "openai") {
      apiKeyToUse = apiKey || process.env.OPENAI_API_KEY
    } else if (provider === "anthropic") {
      apiKeyToUse = apiKey || process.env.ANTHROPIC_API_KEY
    } else if (provider === "google") {
      apiKeyToUse = apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
    }

    // Validate API key
    if (!apiKeyToUse) {
      return NextResponse.json(
        { error: `${provider === "openai" ? "OpenAI" : provider === "anthropic" ? "Anthropic" : "Gemini"} API key is not configured. Please add your API key in Settings.` },
        { status: 500 }
      )
    }

    // Trim and validate API key format
    apiKeyToUse = apiKeyToUse.trim()
    
    // Debug logging (only first/last few chars for security)
    if (apiKeyToUse) {
      const keyPreview = apiKeyToUse.length > 20 
        ? `${apiKeyToUse.substring(0, 10)}...${apiKeyToUse.substring(apiKeyToUse.length - 4)}`
        : `${apiKeyToUse.substring(0, Math.min(10, apiKeyToUse.length))}...`
      console.log(`[API] Using ${provider} API key (length: ${apiKeyToUse.length}, preview: ${keyPreview})`)
    }
    
    // Basic format validation for OpenAI keys
    // OpenAI keys typically start with 'sk-' and are at least 20 characters
    // We'll do a lenient check and let OpenAI's API handle actual validation
    if (provider === "openai") {
      // Check if key starts with 'sk-' (covers sk-, sk-proj-, sk-org-, etc.)
      if (!apiKeyToUse.startsWith('sk-')) {
        console.error(`[API] Invalid OpenAI API key format. Key starts with: ${apiKeyToUse.substring(0, Math.min(10, apiKeyToUse.length))}`)
        return NextResponse.json(
          { error: "Invalid OpenAI API key format. Keys should start with 'sk-'. Please check your key and try again." },
          { status: 400 }
        )
      }
      
      // Basic length check (very lenient - OpenAI will validate the actual format)
      if (apiKeyToUse.length < 20) {
        console.error(`[API] OpenAI API key seems too short. Key length: ${apiKeyToUse.length}`)
        return NextResponse.json(
          { error: "OpenAI API key appears to be too short. Please check your key and try again." },
          { status: 400 }
        )
      }
    }

    // Only handle OpenAI for now (other providers can be added later with their respective SDKs)
    if (provider !== "openai") {
      return NextResponse.json(
        { error: `Provider ${provider} is not yet fully implemented. API key is saved, but API integration is coming soon.` },
        { status: 400 }
      )
    }

    // Initialize OpenAI client only when needed and after validation
    const openai = new OpenAI({
      apiKey: apiKeyToUse,
    })

    if (!content && !imageUrl) {
      return NextResponse.json(
        { error: "Content or image is required" },
        { status: 400 }
      )
    }

    // Prepare messages for OpenAI
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = []

    // Add system message explaining MCP slash commands
    messages.push({
      role: "system",
      content: `You have access to MCP (Model Context Protocol) tools. When a user types a slash command like /playwright, /github, /brave, or /maps, they want you to USE that specific MCP server's tools - NOT write code examples.

CRITICAL: You MUST call the appropriate function/tool when users request actions. Do NOT write code examples or Python scripts. Instead, use the function calling mechanism to execute the tools directly.

Function names follow the format: server_toolname (e.g., playwright_browser_navigate, playwright_browser_take_screenshot, maps_search_places).

🚨 SCREENSHOT REQUESTS - READ THIS FIRST:
If the user requests a screenshot, image, or visual capture of a webpage:
1. Call playwright_browser_navigate with the URL
2. IMMEDIATELY call playwright_browser_take_screenshot (no arguments)
DO NOT call playwright_browser_select_option, playwright_browser_snapshot, or any other tool. ONLY playwright_browser_take_screenshot produces images.

CRITICAL FOR GOOGLE MAPS:
- When users ask about locations, places, businesses, or directions, you MUST use the Maps tools (tools starting with "maps_")
- DO NOT just return Google Maps links - you MUST call the Maps API tools to get structured data
- Common Maps tools include: maps_search_places, maps_get_place_details, maps_get_directions, etc.
- After calling Maps tools, present the structured data (names, addresses, ratings, etc.) to the user in a helpful format
- Examples:
  * User says "find me coffee shops in Des Moines" → Call maps_search_places with query="coffee shops in Des Moines" or location="Des Moines" and type="cafe"
  * User says "where is the nearest gas station" → Call maps_search_places with appropriate location and type parameters
  * User says "directions from A to B" → Call maps_get_directions with origin and destination
- Always use the actual Maps API tools to get real data, not just links

CRITICAL FOR PLAYWRIGHT SCREENSHOTS:
- When users request screenshots, you MUST use the tool named EXACTLY: playwright_browser_take_screenshot
- DO NOT use playwright_browser_snapshot (this returns text, not images)
- DO NOT use playwright_browser_select_option or any other tool - ONLY playwright_browser_take_screenshot produces images
- DO NOT use any tool with "snapshot" in the name - only tools with "take_screenshot" in the name produce images
- The browser uses a PERSISTENT process that maintains context across tool calls within a session.
- You can chain navigation and screenshot operations: first call playwright_browser_navigate with url parameter, then call playwright_browser_take_screenshot.
- The system automatically waits for networkidle on navigation to ensure pages are fully loaded before screenshots.
- CRITICAL: Do NOT open multiple tabs. Use the existing browser page/tab. If a page is already open, reuse it by navigating to the new URL rather than opening a new tab.
- If you encounter "browser is currently in use" or "browser is already in use" errors, the system automatically resets the browser process. Simply inform the user that the browser was reset and they can try their request again. The next tool call will use a fresh browser session.

SCREENSHOT WORKFLOW (MANDATORY - FOLLOW EXACTLY):
- User requests screenshot → 
  1. Call playwright_browser_navigate with url parameter (e.g., url="https://example.com")
  2. IMMEDIATELY call playwright_browser_take_screenshot with NO arguments (this is the ONLY tool that produces images - do NOT use playwright_browser_snapshot, do NOT use playwright_browser_select_option, do NOT use any other tool)

Examples:
- User says "/playwright go to example.com and take a screenshot" → 
  1. Call playwright_browser_navigate with url="https://example.com"
  2. Call playwright_browser_take_screenshot (NO arguments needed - NOT playwright_browser_snapshot, NOT playwright_browser_select_option)
- User says "show me a screenshot of example.com" → 
  1. Call playwright_browser_navigate with url="https://example.com"
  2. Call playwright_browser_take_screenshot (NO arguments needed - NOT playwright_browser_snapshot, NOT playwright_browser_select_option)
- User says "take a screenshot of example.com" → 
  1. Call playwright_browser_navigate with url="https://example.com"
  2. Call playwright_browser_take_screenshot (NO arguments needed - this is MANDATORY for screenshots)
🚨 CRITICAL FOR GITHUB - READ THIS FIRST (HIGHEST PRIORITY):
- When a user types "/github" followed by ANY text, they want you to use GitHub MCP tools to interact with GitHub
- DO NOT use Brave Search, DO NOT use Playwright, DO NOT provide web search results when users type "/github"
- DO NOT provide general knowledge or documentation links when users type "/github"
- You MUST call the GitHub MCP tools to get real GitHub data
- GitHub MCP server provides many tools. Tool names are prefixed with "github_" when available (e.g., github_list_repositories, github_get_repository, github_search_code, github_get_file_contents, github_list_issues, github_create_issue, etc.)
- When users type "/github" followed by a request, identify the appropriate GitHub tool and call it
- IMPORTANT: To list repositories, use the tool github_search_repositories. The GitHub MCP server does NOT have a list_repositories tool - it uses search_repositories instead. DO NOT use github_list_issues when the user asks to list repositories - that's for listing issues, not repositories.
- CRITICAL: When the user asks to list "my repositories", you MUST first get the authenticated user's actual GitHub username. The GitHub search API does NOT support "user:me" - you need the real username. To get the authenticated user's username, make a direct HTTP request to the GitHub API: GET https://api.github.com/user with the Authorization header. The response will contain a "login" field with the username. Then use that username in the search query: {"query": "user:ACTUAL_USERNAME"}.
- Examples:
  * User says "/github list my repositories" or "/github list repositories" → First, make an HTTP request to https://api.github.com/user to get the authenticated user's GitHub username (the "login" field). Then call github_search_repositories with {"query": "user:ACTUAL_USERNAME"} where ACTUAL_USERNAME is the real GitHub username from the API response. DO NOT use "user:me" or the literal string "USERNAME" - that will fail. DO NOT call github_list_issues - that's the wrong tool.
  * User says "/github get info about github/github-mcp-server" → Call github_get_repository with owner="github" and repo="github-mcp-server"
  * User says "/github search for MCP in code" → Call github_search_code with query="MCP"
  * User says "/github get README from github/github-mcp-server" → Call github_get_file_contents with owner="github", repo="github-mcp-server", path="README.md"
  * User says "/github list issues in github/github-mcp-server" → Call github_list_issues with owner="github" and repo="github-mcp-server"
- DO NOT respond with web search results or documentation links when users explicitly use "/github" - you MUST call the GitHub MCP tools
- DO NOT call unrelated tools (like list_issues) when the user asks to list repositories - find and use the correct repository listing tool
- GitHub tools return structured data (repository info, file contents, issues, etc.) - present this data to the user in a clear, formatted way
- If a GitHub tool call fails or returns an error, explain the error to the user clearly. Do NOT just say "Tool execution completed" - always explain what happened
- If a GitHub tool returns empty results, explain that to the user (e.g., "The tool returned no repositories. This might mean you need to authenticate or the tool requires different parameters.")
- If a GitHub tool call succeeds but returns data, present that data to the user in a helpful, readable format
- NEVER respond with just "Tool execution completed" - always provide context about what the tool did and what it returned
- If a GitHub tool call fails, check the error message and try alternative tool names or parameters. Do NOT fall back to web search or other tools.

- User says "/brave X" (e.g., "/brave ai developments in late 2025") → IMMEDIATELY call brave_web_search with query="X" (e.g., query="ai developments in late 2025")
- User says "/brave search for X" or "search for X using Brave" → Use Brave Search MCP tools (brave_web_search, brave_image_search, brave_news_search, or brave_summarizer)
- User says "find coffee shops in Des Moines" → Call maps_search_places with appropriate parameters to get actual place data

🚨 CRITICAL FOR BRAVE SEARCH - READ THIS FIRST (HIGHEST PRIORITY):
- When a user types "/brave" followed by ANY text, they want you to SEARCH for that information using Brave Search tools
- DO NOT use Playwright, DO NOT navigate to websites, DO NOT take screenshots when users type "/brave"
- DO NOT provide general knowledge or information from your training data when users type "/brave"
- You MUST call the Brave Search tools to get real, current search results
- Brave Search is an MCP server with multiple tools: brave_web_search, brave_image_search, brave_news_search, and brave_summarizer
- When users type "/brave" followed by a query, use brave_web_search with the query parameter containing the full search query
- When users request image searches, use brave_image_search
- When users request news searches, use brave_news_search
- Examples:
  * User says "/brave ai developments in late 2025" → IMMEDIATELY call brave_web_search with query="ai developments in late 2025" (DO NOT use Playwright)
  * User says "/brave TypeScript" → IMMEDIATELY call brave_web_search with query="TypeScript" (DO NOT use Playwright)
  * User says "search for AI news" → Call brave_web_search with query="AI news"
- DO NOT respond with general knowledge when users explicitly use "/brave" - you MUST call the search tool
- DO NOT use playwright_browser_navigate or playwright_browser_take_screenshot when users type "/brave" - use brave_web_search instead
- Brave Search returns web search results with titles, URLs, and snippets - present these to the user in a helpful format

ALWAYS use function calling when tools are available. Never write code examples when you can use the tools directly. Always call the actual API tools to get real data, not just return links or generic responses.

CRITICAL: When you call tools and receive results, you MUST explain what happened:
- If a tool succeeds and returns data, present that data to the user in a clear, helpful format
- If a tool fails or returns an error, explain the error clearly to the user
- If a tool returns empty results, explain why that might be (e.g., authentication needed, wrong parameters, etc.)
- NEVER respond with just "Tool execution completed" or similar generic messages - always provide context about what the tool did and what it returned
- Always interpret tool results and present them in a user-friendly way`
    })

    // Handle text content
    if (content) {
      messages.push({
        role: "user",
        content: content,
      })
    }

    // Handle image (if provided)
    if (imageUrl) {
      // If imageUrl is a data URL, extract the base64 part
      let imageBase64 = imageUrl
      if (imageUrl.startsWith("data:image")) {
        imageBase64 = imageUrl.split(",")[1]
      }

      const imageContent: OpenAI.Chat.Completions.ChatCompletionContentPartImage = {
        type: "image_url",
        image_url: {
          url: imageUrl.startsWith("data:") ? imageUrl : `data:image/png;base64,${imageBase64}`,
        },
      }

      // If there's text content, combine it with the image
      if (content) {
        messages[messages.length - 1].content = [
          { type: "text", text: content },
          imageContent,
        ] as any
      } else {
        messages.push({
          role: "user",
          content: [imageContent] as any,
        })
      }
    }

    // Get available tools and convert to OpenAI format
    let tools: OpenAI.Chat.Completions.ChatCompletionTool[] = []
    try {
      tools = await getAvailableToolsAsOpenAIFunctions()
      console.log(`[API Messages] Loaded ${tools.length} tools for function calling`)
      if (tools.length > 0) {
        console.log(`[API Messages] First 5 tool names:`, tools.slice(0, 5).map(t => t.function.name))
        
        // Check if screenshot tool is available and log it
        const screenshotTool = tools.find(t => t.function.name === 'playwright_browser_take_screenshot')
        if (screenshotTool) {
          console.log(`[API Messages] ✅ Screenshot tool found: playwright_browser_take_screenshot`)
          console.log(`[API Messages] Screenshot tool description (first 200 chars):`, screenshotTool.function.description?.substring(0, 200))
        } else {
          console.warn(`[API Messages] ⚠️ Screenshot tool NOT found in available tools!`)
          // Log all tool names to help debug
          const allToolNames = tools.map(t => t.function.name).sort()
          console.warn(`[API Messages] Available tool names: ${allToolNames.join(', ')}`)
          // Check if there's a similar tool name
          const similarTools = tools.filter(t => t.function.name.includes('screenshot') || t.function.name.includes('snapshot'))
          if (similarTools.length > 0) {
            console.warn(`[API Messages] Found similar tools: ${similarTools.map(t => t.function.name).join(', ')}`)
          }
        }
        
        // Check if user is requesting a screenshot
        const screenshotKeywords = ['screenshot', 'capture', 'image', 'picture', 'visual', 'show me']
        const isScreenshotRequest = screenshotKeywords.some(keyword => 
          content?.toLowerCase().includes(keyword)
        )
        if (isScreenshotRequest) {
          console.log(`[API Messages] 🎯 User requested screenshot - ensuring screenshot tool is available`)
          if (!screenshotTool) {
            console.error(`[API Messages] ❌ CRITICAL: Screenshot tool not available but user requested screenshot!`)
          }
        }
        
        // Check if user is requesting Brave Search
        const isBraveRequest = content?.toLowerCase().startsWith('/brave') || content?.toLowerCase().includes('/brave ')
        if (isBraveRequest) {
          console.log(`[API Messages] 🔍 User requested Brave Search - checking if Brave tools are available`)
          const braveTools = tools.filter(t => t.function.name.startsWith('brave_'))
          if (braveTools.length === 0) {
            console.error(`[API Messages] ❌ CRITICAL: No Brave Search tools available! User typed "/brave" but tools are not loaded.`)
            console.error(`[API Messages] Available tool prefixes: ${[...new Set(tools.map(t => t.function.name.split('_')[0]))].join(', ')}`)
          } else {
            console.log(`[API Messages] ✅ Found ${braveTools.length} Brave Search tools: ${braveTools.map(t => t.function.name).join(', ')}`)
            const webSearchTool = braveTools.find(t => t.function.name === 'brave_web_search' || t.function.name.includes('web_search'))
            if (webSearchTool) {
              console.log(`[API Messages] ✅ brave_web_search tool is available and should be used`)
            } else {
              console.warn(`[API Messages] ⚠️ brave_web_search tool NOT found! Available Brave tools: ${braveTools.map(t => t.function.name).join(', ')}`)
            }
          }
        }
      } else {
        console.warn(`[API Messages] No tools loaded! This means function calling won't work.`)
      }
    } catch (error) {
      console.error("[API Messages] Error loading tools:", error)
      // Continue without tools if loading fails
    }
    
    // Call OpenAI API with function calling support
    const requestOptions: OpenAI.Chat.Completions.ChatCompletionCreateParams = {
      model: imageUrl ? "gpt-4o" : "gpt-4o-mini", // Use vision model if image is present
      messages: messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
      max_tokens: 1000,
    }
    
    // Only add tools if we have any
    if (tools.length > 0) {
      requestOptions.tools = tools
      requestOptions.tool_choice = "auto"
      console.log(`[API Messages] Calling OpenAI with ${tools.length} tools available`)
    } else {
      console.log(`[API Messages] Calling OpenAI without tools (no tools loaded)`)
    }
    
    let completion = await openai.chat.completions.create(requestOptions)

    let assistantMessage = completion.choices[0]?.message?.content || ""
    let toolCalls = completion.choices[0]?.message?.tool_calls || []

    // Detect screenshot requests and ensure screenshot tool is called
    const screenshotKeywords = ['screenshot', 'capture', 'image', 'picture', 'visual', 'show me']
    const isScreenshotRequest = screenshotKeywords.some(keyword => 
      content?.toLowerCase().includes(keyword)
    )
    
    if (isScreenshotRequest && toolCalls.length > 0) {
      // Check if screenshot tool was called
      const screenshotToolCalled = toolCalls.some(tc => tc.function.name === 'playwright_browser_take_screenshot')
      const navigateToolCalled = toolCalls.some(tc => tc.function.name === 'playwright_browser_navigate')
      
      // If navigate was called but screenshot wasn't, we'll add it after navigation completes
      // For now, just log a warning
      if (navigateToolCalled && !screenshotToolCalled) {
        console.warn(`[API Messages] ⚠️ Screenshot requested but screenshot tool not called in initial tool calls. Will check after navigation.`)
      } else if (!navigateToolCalled && !screenshotToolCalled) {
        console.warn(`[API Messages] ⚠️ Screenshot requested but neither navigate nor screenshot tools were called.`)
      }
    }

    // Store all tool results for image extraction
    const allToolResults: Array<{ rawResult: any; name: string }> = []

    // Handle tool calls if any
    if (toolCalls.length > 0) {
      // Add assistant message with tool calls to conversation
      messages.push({
        role: "assistant",
        content: null,
        tool_calls: toolCalls.map((tc) => ({
          id: tc.id,
          type: "function",
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments,
          },
        })),
      })

      // Execute tool calls and collect results
      const toolResults = await Promise.all(
        toolCalls.map(async (toolCall) => {
          try {
            const args = JSON.parse(toolCall.function.arguments)
            console.log(`[API] Calling tool: ${toolCall.function.name} with args:`, JSON.stringify(args).substring(0, 200))
            const result = await invokeToolByName(toolCall.function.name, args)
            console.log(`[API] Tool ${toolCall.function.name} returned:`, JSON.stringify(result).substring(0, 500))
            allToolResults.push({ rawResult: result, name: toolCall.function.name })
            
            // If result is empty or null, add a note to help LLM understand
            const resultContent = result === null || result === undefined 
              ? JSON.stringify({ error: "Tool returned no data. Check API key configuration." })
              : JSON.stringify(result)
            
            return {
              tool_call_id: toolCall.id,
              role: "tool" as const,
              name: toolCall.function.name,
              content: resultContent,
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error"
            console.error(`[API] Tool call failed: ${toolCall.function.name}`, errorMessage)
            if (error instanceof Error && error.stack) {
              console.error(`[API] Tool call error stack:`, error.stack.substring(0, 300))
            }
            return {
              tool_call_id: toolCall.id,
              role: "tool" as const,
              name: toolCall.function.name,
              content: JSON.stringify({
                error: errorMessage,
              }),
            }
          }
        })
      )

      // Add tool results to messages
      messages.push(...toolResults)

      // Get final response from OpenAI with tool results
      completion = await openai.chat.completions.create({
        model: imageUrl ? "gpt-4o" : "gpt-4o-mini",
        messages: messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
        tools: tools.length > 0 ? tools : undefined,
        tool_choice: tools.length > 0 ? "auto" : undefined,
        max_tokens: 2000,
      })

      assistantMessage = completion.choices[0]?.message?.content || "Tool execution completed."

      // Auto-inject screenshot tool call if screenshot was requested but not called
      if (isScreenshotRequest && allToolResults.length > 0) {
        console.log(`[API Messages] 🔍 Checking for screenshot auto-injection. Tool results: ${allToolResults.map(tr => tr.name).join(', ')}`)
        const screenshotToolCalled = allToolResults.some(tr => tr.name === 'playwright_browser_take_screenshot')
        const navigateResult = allToolResults.find(tr => tr.name === 'playwright_browser_navigate')
        
        // Check if navigation succeeded - look for success indicators, not just absence of errors
        // Navigation succeeds if we see "Page URL", "Page state", or "Page Title" in the result
        // Console errors are normal and don't indicate failure
        let navigateSucceeded = false
        if (navigateResult) {
          const resultStr = JSON.stringify(navigateResult.rawResult).toLowerCase()
          // Success indicators
          const hasPageUrl = resultStr.includes('page url') || resultStr.includes('url:')
          const hasPageState = resultStr.includes('page state') || resultStr.includes('page snapshot')
          const hasPageTitle = resultStr.includes('page title')
          // Failure indicators (actual failures, not console errors)
          const hasActualError = resultStr.includes('"error"') || resultStr.includes('failed to navigate') || resultStr.includes('navigation failed')
          
          navigateSucceeded = (hasPageUrl || hasPageState || hasPageTitle) && !hasActualError
          console.log(`[API Messages] 🔍 Navigation check: hasPageUrl=${hasPageUrl}, hasPageState=${hasPageState}, hasPageTitle=${hasPageTitle}, hasActualError=${hasActualError}, navigateSucceeded=${navigateSucceeded}`)
        }
        
        console.log(`[API Messages] 🔍 Screenshot tool called: ${screenshotToolCalled}, Navigation succeeded: ${!!navigateSucceeded}`)
        
        if (navigateSucceeded && !screenshotToolCalled) {
          console.log(`[API Messages] 🔧 Auto-injecting screenshot tool call after successful navigation`)
          try {
            // Wait a moment for page to fully load after navigation
            await new Promise(resolve => setTimeout(resolve, 1000))
            
            const screenshotResult = await invokeToolByName('playwright_browser_take_screenshot', {})
            console.log(`[API Messages] 📸 Screenshot result type: ${typeof screenshotResult}, keys: ${screenshotResult && typeof screenshotResult === 'object' ? Object.keys(screenshotResult).join(', ') : 'N/A'}`)
            console.log(`[API Messages] 📸 Screenshot result preview: ${JSON.stringify(screenshotResult).substring(0, 500)}`)
            
            allToolResults.push({ rawResult: screenshotResult, name: 'playwright_browser_take_screenshot' })
            console.log(`[API Messages] ✅ Auto-injected screenshot tool call completed. Total tool results: ${allToolResults.length}`)
            // Note: We don't add this to messages - it will be extracted from allToolResults
          } catch (error) {
            console.error(`[API Messages] ❌ Auto-injected screenshot tool call failed:`, error)
            if (error instanceof Error && error.stack) {
              console.error(`[API Messages] Error stack:`, error.stack.substring(0, 500))
            }
            // Still add error result so we know it failed
            const errorMessage = error instanceof Error ? error.message : "Unknown error"
            allToolResults.push({ 
              rawResult: { error: errorMessage }, 
              name: 'playwright_browser_take_screenshot' 
            })
          }
        } else if (!navigateSucceeded && !screenshotToolCalled) {
          console.warn(`[API Messages] ⚠️ Screenshot requested but navigation failed or not called. Cannot auto-inject screenshot.`)
          if (navigateResult) {
            console.warn(`[API Messages] Navigation result: ${JSON.stringify(navigateResult.rawResult).substring(0, 300)}`)
          } else {
            console.warn(`[API Messages] No navigation result found in tool results`)
          }
        } else if (screenshotToolCalled) {
          console.log(`[API Messages] ✅ Screenshot tool was already called, no need to auto-inject`)
        }
      } else if (isScreenshotRequest) {
        console.warn(`[API Messages] ⚠️ Screenshot requested but no tool results yet (allToolResults.length: ${allToolResults.length})`)
      }

      // Handle additional tool calls if needed (up to 3 iterations to avoid infinite loops)
      let iteration = 0
      while (
        completion.choices[0]?.message?.tool_calls &&
        completion.choices[0].message.tool_calls.length > 0 &&
        iteration < 3
      ) {
        iteration++
        const additionalToolCalls = completion.choices[0].message.tool_calls

        messages.push({
          role: "assistant",
          content: completion.choices[0].message.content,
          tool_calls: additionalToolCalls.map((tc) => ({
            id: tc.id,
            type: "function",
            function: {
              name: tc.function.name,
              arguments: tc.function.arguments,
            },
          })),
        })

        const additionalResults = await Promise.all(
          additionalToolCalls.map(async (toolCall) => {
            try {
              const args = JSON.parse(toolCall.function.arguments)
              console.log(`[API] Additional tool call: ${toolCall.function.name} with args:`, JSON.stringify(args).substring(0, 200))
              const result = await invokeToolByName(toolCall.function.name, args)
              console.log(`[API] Additional tool ${toolCall.function.name} returned:`, JSON.stringify(result).substring(0, 500))
              
              // Add to allToolResults for screenshot extraction
              allToolResults.push({ rawResult: result, name: toolCall.function.name })
              
              return {
                tool_call_id: toolCall.id,
                role: "tool" as const,
                name: toolCall.function.name,
                content: JSON.stringify(result),
                rawResult: result, // Store raw result for image extraction
              }
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : "Unknown error"
              console.error(`[API] Additional tool call failed: ${toolCall.function.name}`, errorMessage)
              if (error instanceof Error && error.stack) {
                console.error(`[API] Additional tool call error stack:`, error.stack.substring(0, 300))
              }
              return {
                tool_call_id: toolCall.id,
                role: "tool" as const,
                name: toolCall.function.name,
                content: JSON.stringify({
                  error: errorMessage,
                }),
              }
            }
          })
        )

        messages.push(...additionalResults)

        completion = await openai.chat.completions.create({
          model: imageUrl ? "gpt-4o" : "gpt-4o-mini",
          messages: messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
          tools: tools.length > 0 ? tools : undefined,
          tool_choice: tools.length > 0 ? "auto" : undefined,
          max_tokens: 2000,
        })

        assistantMessage = completion.choices[0]?.message?.content || "Tool execution completed. Please check the tool results above for any errors or empty responses."
      }
    }

    // Extract image data from tool results (e.g., Playwright screenshots)
    let extractedImageData: string | null = null
    if (allToolResults.length > 0) {
      try {
        console.log(`[API] Checking ${allToolResults.length} tool results for screenshot data`)
        // Log all tool names to see what was actually called
        const toolNames = allToolResults.map(tr => tr.name).join(", ")
        console.log(`[API] Tools called: ${toolNames}`)
        
        // Look through all tool results for screenshot data
        for (const toolResult of allToolResults) {
          try {
            const resultContent = toolResult.rawResult
            const resultStr = JSON.stringify(resultContent).substring(0, 500)
            console.log(`[API] Checking tool result from ${toolResult.name}:`, resultStr)
            
            // Warn if screenshot tool wasn't called
            if (toolResult.name.includes("playwright") && !toolResult.name.includes("take_screenshot")) {
              console.warn(`[API] ⚠️ Playwright tool '${toolResult.name}' was called, but it's not the screenshot tool. Screenshots require 'playwright_browser_take_screenshot'.`)
            }
            
            // Special logging for screenshot tool results
            if (toolResult.name === 'playwright_browser_take_screenshot') {
              console.log(`[API] 🔍 Screenshot tool result structure:`, JSON.stringify(resultContent, null, 2).substring(0, 1000))
              console.log(`[API] 🔍 Screenshot tool result type:`, typeof resultContent)
              if (resultContent && typeof resultContent === 'object') {
                console.log(`[API] 🔍 Screenshot tool result keys:`, Object.keys(resultContent))
              }
            }
            
            // Playwright MCP screenshot format: { content: [{ type: "image", data: "base64...", mimeType: "image/png" }] }
            // OR: File path returned (e.g., "C:\Users\...\screenshot.png")
            
            // First check if result itself is a file path string
            if (typeof resultContent === "string" && resultContent.length > 0 && (resultContent.includes("\\") || resultContent.includes("/") || resultContent.endsWith(".png"))) {
              // Might be a file path - check if it exists
              try {
                if (existsSync(resultContent)) {
                  const imageBuffer = readFileSync(resultContent)
                  const base64Data = imageBuffer.toString('base64')
                  extractedImageData = `data:image/png;base64,${base64Data}`
                  console.log(`[API] ✅ Extracted screenshot from direct file path: ${toolResult.name} (${base64Data.length} bytes)`)
                  break
                }
              } catch (fileError) {
                // Not a valid file path, continue with other checks
                console.log(`[API] String result is not a valid file path: ${resultContent.substring(0, 100)}`)
              }
            }
            
            if (resultContent && typeof resultContent === "object") {
              // Check if result contains a file path (Playwright MCP may save to file)
              if (resultContent.path && typeof resultContent.path === "string") {
                const filePath = resultContent.path
                console.log(`[API] Found file path in result.path: ${filePath}`)
                try {
                  if (existsSync(filePath)) {
                    const imageBuffer = readFileSync(filePath)
                    const base64Data = imageBuffer.toString('base64')
                    extractedImageData = `data:image/png;base64,${base64Data}`
                    console.log(`[API] ✅ Extracted screenshot from file path: ${toolResult.name} (${base64Data.length} bytes)`)
                    break
                  } else {
                    console.warn(`[API] File path does not exist: ${filePath}`)
                  }
                } catch (fileError) {
                  console.error(`[API] Error reading file ${filePath}:`, fileError)
                }
              }
              // Check for Playwright MCP format with content array
              if (Array.isArray(resultContent.content)) {
                for (const item of resultContent.content) {
                  if (item && typeof item === "object" && item.type === "image" && item.data) {
                    const mimeType = item.mimeType || "image/png"
                    extractedImageData = `data:${mimeType};base64,${item.data}`
                    console.log(`[API] ✅ Extracted screenshot from content array: ${toolResult.name} (${item.data.length} bytes)`)
                    break
                  }
                }
                if (extractedImageData) break
              }
              
              // Check for legacy format: { success: true, data: "base64...", format: "png" }
              if (resultContent.data && resultContent.format === "png" && resultContent.success) {
                extractedImageData = `data:image/png;base64,${resultContent.data}`
                console.log(`[API] ✅ Extracted screenshot (legacy format): ${toolResult.name} (${resultContent.data.length} bytes)`)
                break
              }
              
              // Check for direct data field
              if (resultContent.data && typeof resultContent.data === "string" && resultContent.data.length > 100) {
                if (resultContent.data.match(/^[A-Za-z0-9+\/]+=*$/)) {
                  extractedImageData = `data:image/png;base64,${resultContent.data}`
                  console.log(`[API] ✅ Extracted image data (direct): ${toolResult.name} (${resultContent.data.length} bytes)`)
                  break
                }
              }
              
              // Check for nested result structure
              if (resultContent.result && typeof resultContent.result === "object") {
                const nested = resultContent.result
                if (Array.isArray(nested.content)) {
                  for (const item of nested.content) {
                    if (item && typeof item === "object" && item.type === "image" && item.data) {
                      const mimeType = item.mimeType || "image/png"
                      extractedImageData = `data:${mimeType};base64,${item.data}`
                      console.log(`[API] ✅ Extracted screenshot from nested content: ${toolResult.name}`)
                      break
                    }
                  }
                  if (extractedImageData) break
                }
                if (nested.data && nested.format === "png" && nested.success) {
                  extractedImageData = `data:image/png;base64,${nested.data}`
                  console.log(`[API] ✅ Extracted screenshot from nested result: ${toolResult.name}`)
                  break
                }
              }
            }
          } catch (e) {
            console.error(`[API] Error parsing tool result from ${toolResult.name}:`, e)
            continue
          }
        }
        if (!extractedImageData) {
          console.log(`[API] ❌ No screenshot data found in ${allToolResults.length} tool results`)
          
          // Check if screenshot tool was called at all
          const screenshotToolCalled = allToolResults.some(tr => tr.name === 'playwright_browser_take_screenshot')
          if (!screenshotToolCalled) {
            const playwrightToolsCalled = allToolResults.filter(tr => tr.name.includes('playwright')).map(tr => tr.name)
            console.warn(`[API] ⚠️ CRITICAL: Screenshot tool 'playwright_browser_take_screenshot' was NOT called!`)
            console.warn(`[API] ⚠️ Playwright tools that WERE called: ${playwrightToolsCalled.join(', ') || 'none'}`)
            console.warn(`[API] ⚠️ This means the AI did not follow the screenshot workflow. User requested screenshot but tool was not invoked.`)
          } else {
            // Screenshot tool was called but extraction failed - log the result structure
            const screenshotResult = allToolResults.find(tr => tr.name === 'playwright_browser_take_screenshot')
            if (screenshotResult) {
              console.warn(`[API] ⚠️ Screenshot tool WAS called but extraction failed!`)
              console.warn(`[API] ⚠️ Screenshot result type: ${typeof screenshotResult.rawResult}`)
              console.warn(`[API] ⚠️ Screenshot result structure: ${JSON.stringify(screenshotResult.rawResult).substring(0, 1000)}`)
            }
          }
        } else {
          console.log(`[API] ✅ Screenshot data extracted successfully! Size: ${extractedImageData.length} characters`)
        }
      } catch (error) {
        console.error("[API] Error extracting image from tool results:", error)
      }
    }

    // Create message structure for logging
    const message = {
      message_id: crypto.randomUUID(),
      org_id: body.org_id || "org-123",
      user_id: body.user_id || "user-123",
      type: imageUrl ? "vision" : "chat",
      created_at: new Date().toISOString(),
      payload: {
        content: assistantMessage,
        model: completion.model,
        usage: completion.usage,
      },
      meta: body.meta || {},
    }

    console.log("[API] Message processed:", message)

    return NextResponse.json({
      success: true,
      message_id: message.message_id,
      content: assistantMessage,
      imageUrl: extractedImageData || undefined,
      model: completion.model,
    })
  } catch (error: any) {
    console.error("[API] Error processing message:", error)
    
    // Provide more specific error messages
    let errorMessage = "Failed to process message"
    let statusCode = 500
    
    if (error.message?.includes("API key")) {
      errorMessage = error.message
      statusCode = 401
    } else if (error.message) {
      errorMessage = error.message
    }
    
    return NextResponse.json(
      {
        error: errorMessage,
        details: error.message || "Unknown error",
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      },
      { status: statusCode }
    )
  }
}
