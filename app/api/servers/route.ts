import { NextResponse } from "next/server"
import { getAuthenticatedUser, getSupabaseClient } from "@/lib/get-user-session"

// Get servers endpoint - fetches from Supabase when authenticated, returns empty user servers when not
export async function GET() {
  // Fetch system servers from database
  let systemServers: any[] = []
  try {
    const supabase = await getSupabaseClient()
    const { data, error } = await supabase
      .from("system_servers")
      .select("id, name, config, enabled, rate_limit_per_minute, logo_url")
      .eq("enabled", true)
      .order("name", { ascending: true })
    
    if (!error && data) {
      systemServers = data.map((server: any) => {
        // Extract transport from config
        const config = typeof server.config === 'string' 
          ? JSON.parse(server.config) 
          : server.config
        const transport = config.transport || "http"
        
        // Generate description based on server name/type
        let description = `MCP server: ${server.name}`
        if (server.id === "exa") {
          description = "Exa AI-powered live web search and deep research tools"
        } else if (server.id === "maps") {
          description = "Location search and mapping services"
        } else if (server.id === "playwright") {
          description = "Browser automation and web scraping using Playwright MCP"
        } else if (server.id === "github") {
          description = "GitHub repository and code management via official GitHub MCP server"
        } else if (server.id === "langchain") {
          description = "LangChain agent executor with multi-step reasoning and tool execution"
        } else if (server.id === "google-workspace") {
          description = "Google Workspace integration (Gmail, Drive, Calendar, Docs, Sheets, Slides, Forms, Tasks, Chat)"
        } else if (server.id === "sequential-thinking") {
          description = "Chain-of-thought reasoning and structured problem-solving for AI agents"
        } else if (server.id === "notion") {
          description = "Notion workspace management, page search, database operations, and knowledge organization"
        } else if (server.id === "n8n") {
          description = "Visual workflow building, triggers, and integrations with thousands of services"
        }
        
        return {
          id: server.id,
          name: server.name,
          type: "system" as const,
          enabled: server.enabled,
          logoUrl: server.logo_url || "/images/mcpwhtbggd.png", // Fallback to MCP logo
          transport: transport as "http" | "stdio",
          rateLimit: server.rate_limit_per_minute || 60,
          description,
          config: config, // Include full config for tool fetching
          url: config.url, // Include URL for convenience
        }
      })
    } else if (error) {
      console.error("[API Servers] Error fetching system servers:", error)
    }
  } catch (error) {
    console.error("[API Servers] Error fetching system servers:", error)
    // Fallback to empty array on error
  }

  // Fetch user servers from Supabase if authenticated
  let userServers: any[] = []
  const user = await getAuthenticatedUser()
  
  if (user) {
    try {
      const supabase = await getSupabaseClient()
      const { data, error } = await supabase
        .from("user_servers")
        .select("id, server_id, name, transport, enabled, logo_url, created_at, updated_at")
        .eq("user_id", user.id)
        .eq("enabled", true)
        .order("created_at", { ascending: false })
      
      if (!error && data) {
        userServers = data.map((server: any) => ({
          id: server.server_id,
          name: server.name,
          type: "user" as const,
          enabled: server.enabled,
          logoUrl: server.logo_url || undefined,
          transport: server.transport as "http" | "stdio",
          rateLimit: 60, // Default
          description: `Custom MCP server: ${server.name}`,
        }))
      }
    } catch (error) {
      console.error("[API Servers] Error fetching user servers:", error)
      // Continue with empty array on error
    }
  }

  return NextResponse.json({
    system: systemServers,
    user: userServers,
  })
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, url, transport, apiKey, logoUrl, description } = body

    if (!name || !url || !transport) {
      return NextResponse.json(
        { error: "Missing required fields: name, url, transport" },
        { status: 400 }
      )
    }

    const user = await getAuthenticatedUser()
    
    // Generate a unique ID for the server
    const serverId = `user-${Date.now()}-${Math.random().toString(36).substring(7)}`

    if (user) {
      // Save to Supabase when authenticated
      try {
        const supabase = await getSupabaseClient()
        
        // Build config object (store as JSONB for now - can add encryption later)
        const config = {
          url,
          apiKey: apiKey || undefined,
          headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
        }
        
        const { data, error } = await supabase
          .from("user_servers")
          .insert({
            user_id: user.id,
            server_id: serverId,
            name,
            transport: transport as "http" | "stdio",
            config_encrypted: Buffer.from(JSON.stringify(config)), // Store as bytea (will encrypt later)
            enabled: true,
            logo_url: logoUrl || null,
          })
          .select("id, server_id, name, transport, enabled, logo_url")
          .single()
        
        if (error) {
          console.error("[API Servers] Error saving to Supabase:", error)
          return NextResponse.json(
            { error: error.message || "Failed to save server to database" },
            { status: 500 }
          )
        }
        
        const newServer = {
          id: data.server_id,
          name: data.name,
          type: "user" as const,
          enabled: data.enabled,
          logoUrl: data.logo_url || undefined,
          transport: data.transport as "http" | "stdio",
          rateLimit: 60,
          description: description || `Custom MCP server: ${data.name}`,
          url,
          apiKey: apiKey || undefined,
        }
        
        return NextResponse.json({ server: newServer }, { status: 201 })
      } catch (error) {
        console.error("[API Servers] Error:", error)
        return NextResponse.json(
          { error: error instanceof Error ? error.message : "Failed to create server" },
          { status: 500 }
        )
      }
    } else {
      // Not authenticated - return server for localStorage storage
      const newServer = {
        id: serverId,
        name,
        type: "user" as const,
        enabled: true,
        logoUrl: logoUrl || undefined,
        transport: transport as "http" | "stdio",
        rateLimit: 60,
        description: description || `Custom MCP server: ${name}`,
        url,
        apiKey: apiKey || undefined,
      }
      
      return NextResponse.json({ server: newServer }, { status: 201 })
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create server" },
      { status: 500 }
    )
  }
}
