import { NextResponse } from "next/server"
import { getAuthenticatedUser, getSupabaseClient } from "@/lib/get-user-session"

// Get servers endpoint - fetches from Supabase when authenticated, returns empty user servers when not
export async function GET() {
  const systemServers = [
    {
      id: "brave",
      name: "Brave Search",
      type: "system" as const,
      enabled: true,
      logoUrl: "/images/Brave-web-browser-logo-transparent-PNG-image-jpg.webp",
      transport: "http" as const,
      rateLimit: 60,
      description: "Web search using Brave Search API",
    },
    {
      id: "maps",
      name: "Google Maps Grounding",
      type: "system" as const,
      enabled: true,
      logoUrl: "/images/Google_Maps_icon_(2020).svg",
      transport: "http" as const,
      rateLimit: 100,
      description: "Location search and mapping services",
    },
    {
      id: "playwright",
      name: "Playwright",
      type: "system" as const,
      enabled: true,
      logoUrl: "/images/playwright.png",
      transport: "stdio" as const,
      rateLimit: 10,
      description: "Browser automation and web scraping using Playwright MCP",
    },
    {
      id: "github",
      name: "GitHub",
      type: "system" as const,
      enabled: true,
      logoUrl: "/images/Octicons-mark-github.svg.png",
      transport: "stdio" as const,
      rateLimit: 60,
      description: "GitHub repository and code management via official GitHub MCP server",
    },
    {
      id: "langchain",
      name: "LangChain Agent",
      type: "system" as const,
      enabled: true,
      logoUrl: "/images/mcpwhtbggd.png", // Use MCP logo as fallback
      transport: "http" as const,
      rateLimit: 60,
      description: "LangChain agent executor with multi-step reasoning and tool execution",
    },
  ]

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
