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
    hasExaKey: !!process.env.EXA_API_KEY,
    exaKeyLength: process.env.EXA_API_KEY?.length || 0,
    exaKeyPreview: process.env.EXA_API_KEY ? `${process.env.EXA_API_KEY.substring(0, 10)}...` : 'not set',
    allExaEnvVars: Object.keys(process.env).filter(key => key.includes('EXA')),
    cwd: process.cwd(),
  })
}

// Ingest endpoint for submitting messages to OpenAI
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { content, imageUrl, provider = "openai", apiKey, history = [] } = body
    const mapsApiKey = body.mapsApiKey?.trim() || null
    const mapsProjectId = body.mapsProjectId?.trim() || null
    const notionApiKey = body.notionApiKey?.trim() || null
    const githubToken = body.githubToken?.trim() || null
    const exaApiKey = body.exaApiKey?.trim() || null
    const googleOauthClientId = body.googleOauthClientId?.trim() || null
    const googleOauthClientSecret = body.googleOauthClientSecret?.trim() || null
    const googleOauthSessionId = body.googleOauthSessionId?.trim() || null
    const googleOauthAccessToken = body.googleOauthAccessToken?.trim() || null
    const googleOauthRefreshToken = body.googleOauthRefreshToken?.trim() || null

    // Debug logging for Maps API key and Project ID
    console.log(`[API Messages] Request body keys: ${Object.keys(body).join(', ')}`)
    console.log(`[API Messages] mapsApiKey in body: ${body.mapsApiKey ? `PRESENT (length: ${body.mapsApiKey.length})` : 'MISSING'}`)
    console.log(`[API Messages] mapsProjectId in body: ${body.mapsProjectId ? `PRESENT (${body.mapsProjectId})` : 'MISSING'}`)

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
    if (provider === "openai") {
      if (!apiKeyToUse.startsWith('sk-')) {
        console.error(`[API] Invalid OpenAI API key format. Key starts with: ${apiKeyToUse.substring(0, Math.min(10, apiKeyToUse.length))}`)
        return NextResponse.json(
          { error: "Invalid OpenAI API key format. Keys should start with 'sk-'. Please check your key and try again." },
          { status: 400 }
        )
      }

      if (apiKeyToUse.length < 20) {
        console.error(`[API] OpenAI API key seems too short. Key length: ${apiKeyToUse.length}`)
        return NextResponse.json(
          { error: "OpenAI API key appears to be too short. Please check your key and try again." },
          { status: 400 }
        )
      }
    }

    // Only handle OpenAI for now
    if (provider !== "openai") {
      return NextResponse.json(
        { error: `Provider ${provider} is not yet fully implemented. API key is saved, but API integration is coming soon.` },
        { status: 400 }
      )
    }

    const openai = new OpenAI({
      apiKey: apiKeyToUse,
    })

    if (!content && !imageUrl) {
      return NextResponse.json(
        { error: "Content or image is required" },
        { status: 400 }
      )
    }

    // Load tools first
    const invocationOptions: any = {}
    if (mapsApiKey) {
      invocationOptions.googleMapsApiKey = mapsApiKey
      invocationOptions.googleMapsProjectId = mapsProjectId
    }
    if (notionApiKey) {
      invocationOptions.notionApiKey = notionApiKey
    }
    if (githubToken) {
      invocationOptions.githubToken = githubToken
    }
    if (exaApiKey) {
      invocationOptions.exaApiKey = exaApiKey
    }
    if (googleOauthClientId) {
      invocationOptions.googleOauthClientId = googleOauthClientId
    }
    if (googleOauthClientSecret) {
      invocationOptions.googleOauthClientSecret = googleOauthClientSecret
    }
    if (googleOauthSessionId) {
      invocationOptions.googleOauthSessionId = googleOauthSessionId
    }
    if (googleOauthAccessToken) {
      invocationOptions.googleOauthAccessToken = googleOauthAccessToken
    }
    if (googleOauthRefreshToken) {
      invocationOptions.googleOauthRefreshToken = googleOauthRefreshToken
    }
    const hasOptions = Object.keys(invocationOptions).length > 0

    let tools: OpenAI.Chat.Completions.ChatCompletionTool[] = []
    try {
      tools = await getAvailableToolsAsOpenAIFunctions(hasOptions ? invocationOptions : undefined)
      console.log(`[API Messages] Loaded ${tools.length} tools for function calling`)
    } catch (error) {
      console.error("[API] Error loading tools:", error)
    }

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = []

    // System message
    messages.push({
      role: "system",
      content: `You have access to MCP (Model Context Protocol) tools. When a user types a slash command like /google-workspace, /playwright, /github, /exa, /maps, or any custom server command, they want you to USE that specific MCP server's tools - NOT write code examples.

IMPORTANT: Use tools prefixed with the requested server's name.

🚨 GOOGLE WORKSPACE:
Use google-workspace_* tools for Gmail (search_gmail_messages), Drive (search_drive_files), and Calendar (list_calendars) tasks.

🚨 SCREENSHOT REQUESTS:
1. Call playwright_browser_navigate with the URL
2. IMMEDIATELY call playwright_browser_take_screenshot (no arguments)
ONLY playwright_browser_take_screenshot produces images.

🚨 GITHUB:
To list repositories, use github_search_repositories with {"query": "user:ACTUAL_USERNAME"}. Get the username from https://api.github.com/user first if needed.

🚨 EXA:
Always use exa_web_search_exa for web searches.

CRITICAL: When tools return results, explain what happened. Do NOT just say "Tool execution completed."`
    })

    // History processing with tool call sequence protection

    if (history && Array.isArray(history)) {
      // Find a safe slice point that doesn't break tool sequences
      let sliceIndex = Math.max(0, history.length - 20)

      // If we land on a tool message, we must move back to include its assistant call
      while (sliceIndex > 0 && history[sliceIndex].role === "tool") {
        sliceIndex--
      }

      // If we land on an assistant message with tool calls, we're good
      // But we should try to include the user message that triggered it if possible
      if (sliceIndex > 0 && history[sliceIndex].role === "assistant" && history[sliceIndex].toolCalls) {
        if (history[sliceIndex - 1].role === "user") {
          sliceIndex--
        }
      }

      const recentHistory = history.slice(sliceIndex)
      console.log(`[API Messages] Slicing history from ${history.length} to ${recentHistory.length} messages (index: ${sliceIndex})`)

      for (const msg of recentHistory) {
        if (msg.role === "user") {
          if (msg.imageUrl) {
            messages.push({
              role: "user",
              content: [
                { type: "text", text: msg.content || "" },
                { type: "image_url", image_url: { url: msg.imageUrl } }
              ] as any
            })
          } else {
            messages.push({
              role: "user",
              content: msg.content || ""
            })
          }
        } else if (msg.role === "assistant") {
          const assistantMsg: OpenAI.Chat.Completions.ChatCompletionAssistantMessageParam = {
            role: "assistant",
            content: msg.content || null
          }
          if (msg.toolCalls && Array.isArray(msg.toolCalls)) {
            // Ensure tool_calls format for OpenAI
            assistantMsg.tool_calls = msg.toolCalls.map((tc: any) => ({
              id: tc.id || tc.tool_call_id,
              type: "function",
              function: {
                name: tc.function?.name || tc.name,
                arguments: tc.function?.arguments || (typeof tc.arguments === 'string' ? tc.arguments : JSON.stringify(tc.arguments)),
              }
            }))
          }
          messages.push(assistantMsg)
        } else if (msg.role === "tool") {
          const toolCallId = msg.toolCallId || msg.tool_call_id
          if (toolCallId) {
            messages.push({
              role: "tool",
              tool_call_id: toolCallId,
              content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
            })
          } else {
            console.warn(`[API] Skipping tool message without toolCallId:`, JSON.stringify(msg).substring(0, 100))
          }
        }
      }
    }

    // User message
    if (content) {
      messages.push({
        role: "user",
        content: content,
      })
    }

    if (imageUrl) {
      const imageContent: OpenAI.Chat.Completions.ChatCompletionContentPartImage = {
        type: "image_url",
        image_url: {
          url: imageUrl,
        },
      }

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

    const requestOptions: OpenAI.Chat.Completions.ChatCompletionCreateParams = {
      model: imageUrl ? "gpt-4o" : "gpt-4o-mini",
      messages: messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
      max_tokens: 2000,
    }

    if (tools.length > 0) {
      requestOptions.tools = tools
      requestOptions.tool_choice = "auto"
    }

    let completion = await openai.chat.completions.create(requestOptions)

    let assistantMessage = completion.choices[0]?.message?.content || ""
    let toolCalls = completion.choices[0]?.message?.tool_calls || []
    const totalToolCalls: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[] = []
    const allToolResults: Array<{ rawResult: any; name: string; tool_call_id?: string }> = []

    let maxTurns = 10
    let currentTurn = 0

    const screenshotKeywords = ['screenshot', 'capture', 'image', 'picture', 'visual', 'show me']
    const isScreenshotRequest = screenshotKeywords.some(keyword =>
      content?.toLowerCase().includes(keyword)
    )

    while (toolCalls.length > 0 && currentTurn < maxTurns) {
      currentTurn++
      totalToolCalls.push(...(toolCalls as any))

      // Add assistant message with tool calls
      messages.push({
        role: "assistant",
        content: assistantMessage || null,
        tool_calls: toolCalls.map((tc) => ({
          id: (tc as any).id,
          type: "function",
          function: {
            name: (tc as any).function.name,
            arguments: (tc as any).function.arguments,
          },
        })),
      })

      // Execute tools
      const toolResults = await Promise.all(
        toolCalls.map(async (toolCall) => {
          try {
            const args = JSON.parse((toolCall as any).function.arguments)
            console.log(`[API][Turn ${currentTurn}] Calling tool: ${(toolCall as any).function.name}`)

            const result = await invokeToolByName((toolCall as any).function.name, args, invocationOptions)

            // Collect result
            allToolResults.push({ rawResult: result, name: (toolCall as any).function.name, tool_call_id: (toolCall as any).id })

            console.log(`[API][Turn ${currentTurn}] Tool result for ${(toolCall as any).id}:`, JSON.stringify(result).substring(0, 500))

            return {
              tool_call_id: (toolCall as any).id,
              role: "tool" as const,
              name: (toolCall as any).function.name,
              content: typeof result === 'string' ? result : JSON.stringify(result),
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error"
            console.error(`[API][Turn ${currentTurn}] Tool failed: ${(toolCall as any).function.name}`, errorMessage)

            allToolResults.push({
              rawResult: { error: errorMessage },
              name: (toolCall as any).function.name,
              tool_call_id: (toolCall as any).id
            })

            return {
              tool_call_id: (toolCall as any).id,
              role: "tool" as const,
              name: (toolCall as any).function.name,
              content: JSON.stringify({ error: errorMessage }),
            }
          }
        })
      )

      messages.push(...toolResults)

      // Next turn
      completion = await openai.chat.completions.create({
        ...requestOptions,
        messages: messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
      })

      assistantMessage = completion.choices[0]?.message?.content || ""
      toolCalls = completion.choices[0]?.message?.tool_calls || []
    }

    if (assistantMessage === "" && toolCalls.length === 0) {
      assistantMessage = "Tool execution completed."
    }

    // Auto-inject screenshot if needed
    if (isScreenshotRequest && allToolResults.length > 0) {
      const screenshotToolCalled = allToolResults.some(tr => tr.name === 'playwright_browser_take_screenshot')
      const navigateResult = allToolResults.find(tr => tr.name === 'playwright_browser_navigate')

      if (navigateResult && !screenshotToolCalled) {
        try {
          console.log(`[API Messages] 🔧 Auto-injecting screenshot`)
          await new Promise(resolve => setTimeout(resolve, 2000))
          const screenshotResult = await invokeToolByName('playwright_browser_take_screenshot', {}, invocationOptions)
          allToolResults.push({ rawResult: screenshotResult, name: 'playwright_browser_take_screenshot' })
        } catch (error) {
          console.error(`[API Messages] ❌ Screenshot auto-injection failed:`, error)
        }
      }
    }

    // Extract image data
    let extractedImageData: string | null = null
    if (allToolResults.length > 0) {
      for (const toolResult of allToolResults) {
        const resultContent = toolResult.rawResult
        if (typeof resultContent === "string" && resultContent.length > 0 && existsSync(resultContent)) {
          const imageBuffer = readFileSync(resultContent)
          extractedImageData = `data:image/png;base64,${imageBuffer.toString('base64')}`
          break
        }

        if (resultContent && typeof resultContent === "object") {
          if (resultContent.path && typeof resultContent.path === "string" && existsSync(resultContent.path)) {
            const imageBuffer = readFileSync(resultContent.path)
            extractedImageData = `data:image/png;base64,${imageBuffer.toString('base64')}`
            break
          }
          if (Array.isArray(resultContent.content)) {
            for (const item of resultContent.content) {
              if (item?.type === "image" && item?.data) {
                extractedImageData = `data:${item.mimeType || "image/png"};base64,${item.data}`
                break
              }
            }
            if (extractedImageData) break
          }
        }
      }
    }

    let cleanedContent = assistantMessage
    if (extractedImageData && assistantMessage) {
      cleanedContent = assistantMessage.replace(/data:image\/[^;]+;base64,[A-Za-z0-9+\/]{100,}={0,2}/g, '[Screenshot image]')
      cleanedContent = cleanedContent.replace(/[A-Za-z0-9+\/]{500,}={0,2}/g, '[Image data]')
    }

    // Handle Google Workspace auth errors
    if (allToolResults.some(tr => (tr.rawResult as any)?.error?.includes("ACTION REQUIRED") || (tr.rawResult as any)?.error?.includes("Authorization URL"))) {
      if (!cleanedContent.includes("Authorization URL") && !cleanedContent.includes("ACTION REQUIRED")) {
        const authResult = allToolResults.find(tr => (tr.rawResult as any)?.error?.includes("ACTION REQUIRED") || (tr.rawResult as any)?.error?.includes("Authorization URL"))
        if (authResult) {
          const authText = (authResult.rawResult as any).error || (authResult.rawResult as any).message || JSON.stringify(authResult.rawResult)
          cleanedContent = `${cleanedContent}\n\n${authText}`
        }
      }
    }

    return NextResponse.json({
      success: true,
      content: cleanedContent,
      imageUrl: extractedImageData || undefined,
      model: completion.model,
      toolCalls: totalToolCalls.length > 0 ? totalToolCalls : undefined,
      toolResults: allToolResults
        .filter(tr => tr.tool_call_id)
        .map(tr => ({
          tool_call_id: tr.tool_call_id,
          role: "tool",
          name: tr.name,
          content: typeof tr.rawResult === 'string' ? tr.rawResult : JSON.stringify(tr.rawResult)
        }))
    });
  } catch (error) {
    console.error("[API] Error processing message:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to process message",
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}
