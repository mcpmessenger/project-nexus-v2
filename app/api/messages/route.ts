import { NextResponse } from "next/server"
import OpenAI from "openai"

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

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: imageUrl ? "gpt-4o" : "gpt-4o-mini", // Use vision model if image is present
      messages: messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
      max_tokens: 1000,
    })

    const assistantMessage = completion.choices[0]?.message?.content || "No response generated"

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
      model: completion.model,
    })
  } catch (error: any) {
    console.error("[API] Error processing message:", error)
    return NextResponse.json(
      {
        error: "Failed to process message",
        details: error.message || "Unknown error",
      },
      { status: 500 }
    )
  }
}
