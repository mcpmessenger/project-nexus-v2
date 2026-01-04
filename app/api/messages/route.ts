import { NextResponse } from "next/server"
import OpenAI from "openai"
import { getAvailableToolsAsOpenAIFunctions, invokeToolByName } from "@/lib/tools-helper"
import { readFileSync } from "fs"
import { existsSync } from "fs"

// Test endpoint
export async function GET() {
  return NextResponse.json({ 
    message: "Messages API is working",
    hasOpenAIKey: !!process.env.OPENAI_API_KEY 
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
    
    // Basic format validation for OpenAI keys
    if (provider === "openai" && !apiKeyToUse.match(/^sk-[a-zA-Z0-9\-_]{20,}$/)) {
      console.error(`[API] Invalid OpenAI API key format. Key length: ${apiKeyToUse.length}, starts with: ${apiKeyToUse.substring(0, 5)}`)
      return NextResponse.json(
        { error: "Invalid OpenAI API key format. Keys should start with 'sk-' and be at least 20 characters long. Please check your key and try again." },
        { status: 400 }
      )
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

Function names follow the format: server_toolname (e.g., playwright_browser_navigate, playwright_browser_screenshot).

CRITICAL FOR PLAYWRIGHT SCREENSHOTS:
- When users request screenshots, you MUST use the tool named EXACTLY: playwright_browser_screenshot
- DO NOT use playwright_browser_snapshot (this returns text, not images)
- DO NOT use any tool with "snapshot" in the name - only tools with "screenshot" in the name produce images
- The browser uses a PERSISTENT process that maintains context across tool calls within a session.
- You can chain navigation and screenshot operations: first call playwright_browser_navigate with url parameter, then call playwright_browser_screenshot.
- The system automatically waits for networkidle on navigation to ensure pages are fully loaded before screenshots.
- CRITICAL: Do NOT open multiple tabs. Use the existing browser page/tab. If a page is already open, reuse it by navigating to the new URL rather than opening a new tab.
- If you encounter "browser is currently in use" or "browser is already in use" errors, the system automatically resets the browser process. Simply inform the user that the browser was reset and they can try their request again. The next tool call will use a fresh browser session.

SCREENSHOT WORKFLOW (MANDATORY):
- User requests screenshot → 
  1. Call playwright_browser_navigate with url parameter
  2. Call playwright_browser_screenshot (this is the ONLY tool that produces images - do NOT use playwright_browser_snapshot)

Examples:
- User says "/playwright go to example.com and take a screenshot" → 
  1. Call playwright_browser_navigate with url="https://example.com"
  2. Call playwright_browser_screenshot (NOT playwright_browser_snapshot)
- User says "show me a screenshot of example.com" → 
  1. Call playwright_browser_navigate with url="https://example.com"
  2. Call playwright_browser_screenshot (NOT playwright_browser_snapshot)
- User says "/github list repos" → Call github_list_repositories
- User says "/brave search for X" → Call brave_search

ALWAYS use function calling when tools are available. Never write code examples when you can use the tools directly.`
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
    const toolCalls = completion.choices[0]?.message?.tool_calls || []

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
            const result = await invokeToolByName(toolCall.function.name, args)
            allToolResults.push({ rawResult: result, name: toolCall.function.name })
            return {
              tool_call_id: toolCall.id,
              role: "tool" as const,
              name: toolCall.function.name,
              content: JSON.stringify(result),
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
              const result = await invokeToolByName(toolCall.function.name, args)
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

        assistantMessage = completion.choices[0]?.message?.content || "Tool execution completed."
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
            if (toolResult.name.includes("playwright") && !toolResult.name.includes("screenshot")) {
              console.warn(`[API] ⚠️ Playwright tool '${toolResult.name}' was called, but it's not the screenshot tool. Screenshots require 'playwright_browser_screenshot'.`)
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
