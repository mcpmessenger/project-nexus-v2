import { NextResponse } from "next/server"
import {
  McpClient,
  McpRouteRequest,
  buildMcpConfig,
  ensureManagedGoogleConfig,
  validateManagedServerConfig,
  getCachedToolSchema,
} from "@/lib/mcpClient"
import { reportToolCallUsage, logUsageEventToDatabase } from "@/lib/stripe-billing"

const GOOGLE_GROUNDING_ID = "google-maps-grounding"

export async function GET() {
  return NextResponse.json({
    message: "POST a JSON-RPC payload to proxy through an MCP transport.",
  })
}

export async function POST(request: Request) {
  let payload: McpRouteRequest
  try {
    payload = await request.json()
  } catch (error) {
    return NextResponse.json(
      { error: "Invalid JSON body", details: (error as Error).message },
      { status: 400 }
    )
  }

  if (!payload?.config) {
    return NextResponse.json({ error: "Missing MCP server configuration" }, { status: 400 })
  }

  try {
    let config = buildMcpConfig(payload.config)
    // Check for both "maps" and "google-maps-grounding" server IDs
    if (config.id === "maps" || config.id === GOOGLE_GROUNDING_ID) {
      config = ensureManagedGoogleConfig(config)
    }

    validateManagedServerConfig(config)

    const client = new McpClient(config)

    switch (payload.action) {
      case "list_tools": {
        const tools = await client.listTools()
        const cached = Boolean(getCachedToolSchema(config.id))
        return NextResponse.json({ tools, cached })
      }

      case "health": {
        const status = await client.health()
        return NextResponse.json({ status })
      }

      case "invoke": {
        if (!payload.method) {
          return NextResponse.json({ error: "Missing method for invocation" }, { status: 400 })
        }

        const result = await client.call(payload.method, payload.params ?? {})

        // Report usage to Stripe (non-blocking)
        // Extract user ID from session - for now using mock user, in production get from auth
        const userId = payload.userId || "user-123" // TODO: Get from actual auth session
        const serverId = config.id || "unknown"
        const toolName = payload.method.replace("tools/call", "").replace("/", "") || "unknown"

        // Report usage asynchronously (don't await to avoid blocking response)
        reportToolCallUsage({
          userId,
          toolName,
          serverId,
          metadata: {
            method: payload.method,
          },
        }).then((usageResult) => {
          if (usageResult.success && usageResult.stripeEventId) {
            // Log to database with Stripe event ID
            logUsageEventToDatabase({
              userId,
              toolName,
              serverId,
              stripeEventId: usageResult.stripeEventId,
              metadata: {
                method: payload.method,
              },
            })
          }
        }).catch((error) => {
          console.error("Failed to report usage:", error)
          // Non-blocking - continue even if reporting fails
        })

        return NextResponse.json({ result })
      }

      default:
        return NextResponse.json(
          { error: "Unsupported action. Use list_tools, invoke, or health." },
          { status: 400 }
        )
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    console.error("[API MCP] Error:", error)
    if (error instanceof Error && error.stack) {
      console.error("[API MCP] Stack Trace:", error.stack)
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
