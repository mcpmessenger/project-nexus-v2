"use client"

import * as React from "react"
import { Suspense } from "react"
import Image from "next/image"
import { useSearchParams, useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Server,
  Plus,
  Upload,
  X,
  Power,
  Trash2,
  CheckCircle2,
  XCircle,
  Loader2,
  Activity,
  ExternalLink,
  Hash,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuth } from "@/components/auth-provider"
import { MetricsChart } from "@/components/metrics-chart"

interface McpServer {
  id: string
  name: string
  type: "system" | "user"
  enabled: boolean
  logoUrl?: string
  transport: "http" | "stdio"
  rateLimit?: number
  description?: string
  apiKey?: string
  naturalLanguageInChat?: boolean
  config?: any
  url?: string
}

interface Tool {
  name: string
  description?: string
  inputSchema?: any
}

function RegistryPageContent() {
  const { user } = useAuth()
  const searchParams = useSearchParams()
  const router = useRouter()
  const [servers, setServers] = React.useState<{ system: McpServer[]; user: McpServer[] }>({
    system: [],
    user: [],
  })
  const [loading, setLoading] = React.useState(true)
  const [addServerOpen, setAddServerOpen] = React.useState(false)
  const [editingServer, setEditingServer] = React.useState<McpServer | null>(null)

  React.useEffect(() => {
    if (searchParams.get("addServer") === "true") {
      setAddServerOpen(true)
      setEditingServer(null)
      router.replace("/monitoring")
    }
  }, [searchParams, router])

  React.useEffect(() => {
    const serverId = searchParams.get("server")
    if (serverId && servers.system.length > 0) {
      const server = servers.system.find((s) => s.id === serverId)
      if (server) {
        setEditingServer(server)
        setAddServerOpen(true)
        router.replace("/monitoring")
      }
    }
  }, [searchParams, servers.system, router])

  const handleEditServer = (server: McpServer) => {
    setEditingServer(server)
    setAddServerOpen(true)
  }

  const handleDeleteServer = async (serverId: string, type: "system" | "user") => {
    if (type === "user") {
      if (user) {
        // Delete from Supabase via API
        try {
          const response = await fetch(`/api/servers/${serverId}`, {
            method: "DELETE",
          })
          
          if (!response.ok) {
            console.error("Failed to delete server from Supabase")
          }
        } catch (error) {
          console.error("Error deleting server:", error)
        }
      } else {
        // Remove from localStorage
        const storedUserServers = localStorage.getItem("user_servers")
        if (storedUserServers) {
          const userServers = JSON.parse(storedUserServers)
          const updatedServers = userServers.filter((s: McpServer) => s.id !== serverId)
          localStorage.setItem("user_servers", JSON.stringify(updatedServers))
        }
      }
      
      // Dispatch custom event to notify other components
      window.dispatchEvent(new Event("userServersUpdated"))
      
      // Refresh server list
      fetchServers()
    }
    
    // Update UI state
    setServers((prev) => ({
      ...prev,
      [type]: prev[type].filter((s) => s.id !== serverId),
    }))
    
    console.log("Deleted server:", serverId, type)
  }

  const fetchServers = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/servers")
      const data = await res.json()
      
      // If user is authenticated, use servers from API (Supabase)
      // Otherwise, fall back to localStorage
      let userServers = data.user || []
      
      if (!user && typeof window !== "undefined") {
        // Not authenticated - load from localStorage
        const storedUserServers = localStorage.getItem("user_servers")
        userServers = storedUserServers ? JSON.parse(storedUserServers) : []
      }
      
      setServers({
        system: data.system || [],
        user: userServers,
      })
    } catch (err) {
      console.error("Failed to fetch servers:", err)
    } finally {
      setLoading(false)
    }
  }, [user])

  React.useEffect(() => {
    fetchServers()
  }, [fetchServers, user])

  const toggleServer = async (serverId: string, type: "system" | "user", enabled: boolean) => {
    // TODO: Implement API call to toggle server
    setServers((prev) => ({
      ...prev,
      [type]: prev[type].map((s) => (s.id === serverId ? { ...s, enabled: !enabled } : s)),
    }))
  }

  const getLogoUrl = (server: McpServer) => {
    // If logoUrl exists and is not empty, use it
    if (server.logoUrl && server.logoUrl.trim() !== "") {
      // Handle both absolute URLs and relative paths
      if (server.logoUrl.startsWith("http") || server.logoUrl.startsWith("/")) {
        return server.logoUrl
      }
      // If it's a relative path without leading slash, add it
      if (!server.logoUrl.startsWith("/")) {
        return `/${server.logoUrl}`
      }
      return server.logoUrl
    }
    // Fallback to MCP logo for servers without logos
    return "/images/mcpwhtbggd.png"
  }

  const allServers = [...servers.system, ...servers.user]

  return (
    <div className="flex flex-col gap-10 p-8">
      {/* AddServerDialog for navbar trigger and editing */}
      <div className="hidden">
        <AddServerDialog 
          onAdd={() => fetchServers()} 
          onDelete={handleDeleteServer}
          open={addServerOpen}
          onOpenChange={(open) => {
            setAddServerOpen(open)
            if (!open) setEditingServer(null)
          }}
          editingServer={editingServer}
        />
      </div>

      {/* MCP Servers */}
      <div className="space-y-6">

        {/* System Servers */}
        {servers.system.length > 0 && (
          <div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {servers.system.map((server) => (
                <ServerCard
                  key={server.id}
                  server={server}
                  onToggle={toggleServer}
                  onEdit={handleEditServer}
                  logoUrl={getLogoUrl(server)}
                />
              ))}
            </div>
          </div>
        )}

        {/* User Servers */}
        {servers.user.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-4">Your Servers</h3>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {servers.user.map((server) => (
                <ServerCard
                  key={server.id}
                  server={server}
                  onToggle={toggleServer}
                  onEdit={handleEditServer}
                  onDelete={handleDeleteServer}
                  logoUrl={getLogoUrl(server)}
                  isUserServer
                />
              ))}
            </div>
          </div>
        )}

        {allServers.length === 0 && !loading && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Server className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-sm font-medium mb-1">No servers configured</p>
              <p className="text-xs text-muted-foreground mb-4">Add your first MCP server to get started</p>
              <AddServerDialog onAdd={() => fetchServers()} />
            </CardContent>
          </Card>
        )}
      </div>

      {/* Worker Monitoring Section - Moved to bottom */}
      <WorkerMonitoringSection />
    </div>
  )
}

function ServerCard({
  server,
  onToggle,
  onEdit,
  onDelete,
  logoUrl,
  isUserServer = false,
}: {
  server: McpServer
  onToggle: (id: string, type: "system" | "user", enabled: boolean) => void
  onEdit?: (server: McpServer) => void
  onDelete?: (id: string, type: "system" | "user") => void
  logoUrl: string
  isUserServer?: boolean
}) {
  const [logoError, setLogoError] = React.useState(false)
  const [tools, setTools] = React.useState<Tool[]>([])
  const [loadingTools, setLoadingTools] = React.useState(false)
  const [toolsError, setToolsError] = React.useState<string | null>(null)

  // Fetch tools for this server
  const fetchTools = React.useCallback(async () => {
    if (!server.enabled) {
      setToolsError("Server must be enabled to fetch tools")
      return
    }

    setLoadingTools(true)
    setToolsError(null)
    
    try {
      // Parse config if it's a string
      let parsedConfig: any = server.config
      if (typeof server.config === 'string') {
        try {
          parsedConfig = JSON.parse(server.config)
        } catch (e) {
          console.warn(`[ServerCard] Failed to parse config for ${server.id}:`, e)
          parsedConfig = {}
        }
      }

      // Build config for the server
      let config: any = {
        id: server.id,
        name: server.name,
        transport: server.transport,
      }

      // Add URL for HTTP transport
      if (server.transport === "http") {
        config.url = server.url || parsedConfig?.url
        // Fallback to known servers if URL not in config
        if (!config.url) {
          const knownServer = KNOWN_SERVERS[server.id.toLowerCase()] || KNOWN_SERVERS[server.name.toLowerCase()]
          if (knownServer?.url && knownServer.url !== "stdio") {
            config.url = knownServer.url
          }
        }
      }

      // Add stdio command/args if available
      if (server.transport === "stdio") {
        if (parsedConfig?.command) {
          config.command = parsedConfig.command
          config.args = parsedConfig.args || []
        } else {
          // Default stdio config based on server ID
          const knownServer = KNOWN_SERVERS[server.id.toLowerCase()] || KNOWN_SERVERS[server.name.toLowerCase()]
          if (knownServer?.transport === "stdio") {
            // We'll need to set command/args based on server type
            if (server.id === "github") {
              config.command = "npx"
              config.args = ["-y", "@modelcontextprotocol/server-github"]
            } else if (server.id === "playwright") {
              config.command = "npx"
              config.args = ["-y", "@playwright/mcp@latest", "--headless", "--isolated"]
            } else if (server.id === "notion") {
              config.command = "npx"
              config.args = ["-y", "@notionhq/notion-mcp-server"]
            } else if (server.id === "google-workspace") {
              config.command = "uvx"
              config.args = ["workspace-mcp", "--transport", "streamable-http"]
            }
          }
        }
      }

      // Start with headers from config if they exist
      const headers: Record<string, string> = parsedConfig?.headers ? { ...parsedConfig.headers } : {}
      const env: Record<string, string> = parsedConfig?.env ? { ...parsedConfig.env } : {}

      // Add API keys from localStorage if needed (these override config headers)
      if (server.id === "maps" || server.id === "google-maps-grounding") {
        const mapsKey = localStorage.getItem("google_maps_api_key")
        if (mapsKey) {
          headers["X-Goog-Api-Key"] = mapsKey.trim()
        }
      } else if (server.id === "exa") {
        // Exa requires Accept header and x-api-key header
        headers["Accept"] = "application/json, text/event-stream"
        const exaKey = localStorage.getItem("exa_api_key")
        if (exaKey && exaKey.trim()) {
          headers["x-api-key"] = exaKey.trim()
        } else {
          // Exa requires an API key - show helpful error
          console.warn("Exa API key not found in localStorage. Exa tools require an API key.")
          // Still try to fetch, but it will likely fail with a clear error
        }
      } else if (server.id === "github") {
        const githubToken = localStorage.getItem("github_personal_access_token")
        if (githubToken) {
          env["GITHUB_PERSONAL_ACCESS_TOKEN"] = githubToken.trim()
        }
      } else if (server.id === "notion") {
        const notionKey = localStorage.getItem("notion_api_key")
        if (notionKey) {
          env["NOTION_API_KEY"] = notionKey.trim()
        }
      }

      // Always set headers and env if they have values
      if (Object.keys(headers).length > 0) {
        config.headers = headers
      }
      if (Object.keys(env).length > 0) {
        config.env = env
      }

      console.log(`[ServerCard] Fetching tools for ${server.id} with config:`, {
        id: config.id,
        transport: config.transport,
        url: config.url,
        hasHeaders: !!config.headers,
        hasEnv: !!config.env,
      })

      const response = await fetch("/api/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "list_tools",
          config,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Failed to fetch tools" }))
        let errorMessage = errorData.error || `HTTP ${response.status}`
        
        // Provide helpful error messages for common issues
        if (server.id === "exa" && response.status === 401) {
          errorMessage = "Exa API key is missing or invalid. Please add your Exa API key in the server settings."
        } else if (server.id === "exa" && response.status === 403) {
          errorMessage = "Exa API key does not have permission to access tools. Please check your API key permissions."
        } else if (response.status === 401 || response.status === 403) {
          errorMessage = `Authentication failed. Please check your API key for ${server.name}.`
        } else if (response.status === 404) {
          errorMessage = `Server endpoint not found. Please check the server URL configuration.`
        }
        
        console.error(`[ServerCard] Error fetching tools for ${server.id}:`, errorMessage, errorData)
        throw new Error(errorMessage)
      }

      const data = await response.json()
      const toolList = data.tools || []
      console.log(`[ServerCard] Received ${toolList.length} tools for ${server.id} (${server.name}):`, toolList.map((t: Tool) => t.name))
      
      if (toolList.length === 0) {
        console.warn(`[ServerCard] No tools returned for ${server.id}. Response:`, data)
      }
      
      setTools(toolList)
    } catch (error) {
      console.error("Error fetching tools:", error)
      setToolsError(error instanceof Error ? error.message : "Failed to fetch tools")
      setTools([])
    } finally {
      setLoadingTools(false)
    }
  }, [server.id, server.enabled, server.transport, server.url, server.config])

  // Reset tools when server changes
  React.useEffect(() => {
    setTools([])
    setToolsError(null)
  }, [server.id])

  // Determine logo-specific styling
  const isGoogleMaps = server.id === "maps"
  const isGitHub = server.id === "github"
  
  const logoClassName = isGoogleMaps
    ? "object-contain scale-[0.6]" // Make Google Maps logo smaller
    : isGitHub
    ? "object-contain dark:brightness-0 dark:invert" // Make GitHub logo visible in dark mode
    : "object-contain"

  return (
    <Card 
      className="relative overflow-hidden cursor-pointer hover:bg-accent/50 transition-colors"
      onClick={() => onEdit?.(server)}
    >
      {/* LED Status Indicator */}
      <div className={`absolute top-3 left-3 h-2.5 w-2.5 rounded-full ${
        server.enabled ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.6)]"
      }`} />
      {/* Power Button - Top Right */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-3 right-3 h-8 w-8 shrink-0 z-10"
        onClick={(e) => {
          e.stopPropagation()
          onToggle(server.id, server.type, server.enabled)
        }}
        title={server.enabled ? "Disable" : "Enable"}
      >
        <Power className={`h-4 w-4 ${server.enabled ? "text-accent" : "text-muted-foreground"}`} />
      </Button>
      {/* Tools Button - Next to Power Button */}
      <DropdownMenu onOpenChange={(open) => {
        if (open) {
          // Always fetch tools when opening, even if we have cached ones (to refresh)
          // Only skip if already loading
          if (!loadingTools) {
            console.log(`[ServerCard] Opening tools dropdown for ${server.id} (${server.name})`)
            fetchTools()
          }
        }
      }}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-3 right-12 h-8 w-8 shrink-0 z-10"
            onClick={(e) => {
              e.stopPropagation()
            }}
            title="View available tools"
            disabled={!server.enabled}
          >
            <Hash className={`h-4 w-4 ${server.enabled ? "text-accent" : "text-muted-foreground"}`} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80 max-h-96 overflow-y-auto">
          <DropdownMenuLabel className="flex items-center justify-between">
            <span>Available Tools - {server.name}</span>
            {loadingTools && <Loader2 className="h-4 w-4 animate-spin" />}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {toolsError && (
            <>
              <div className="px-2 py-1.5 text-sm text-destructive">
                {toolsError}
              </div>
              {toolsError.includes("API key") && (
                <div className="px-2 py-1.5 text-xs text-muted-foreground">
                  Please configure your API key in the server settings.
                </div>
              )}
              <DropdownMenuSeparator />
            </>
          )}
          {tools.length === 0 && !loadingTools && !toolsError && (
            <div className="px-2 py-1.5 text-sm text-muted-foreground">
              No tools available. Click to refresh.
            </div>
          )}
          {tools.map((tool, index) => (
            <DropdownMenuItem
              key={`${server.id}-${tool.name}-${index}`}
              className="flex flex-col items-start gap-1 py-2 px-2 cursor-default"
              onSelect={(e) => e.preventDefault()}
            >
              <div className="font-medium text-sm">{tool.name}</div>
              {tool.description && (
                <div className="text-xs text-muted-foreground line-clamp-2">
                  {tool.description}
                </div>
              )}
            </DropdownMenuItem>
          ))}
          {tools.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <div className="px-2 py-1.5 text-xs text-muted-foreground">
                {tools.length} tool{tools.length !== 1 ? "s" : ""} available for {server.name}
              </div>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <CardHeader className="pb-3">
        <div className="flex items-start mb-2">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="relative h-10 w-10 shrink-0 rounded-lg overflow-hidden bg-muted flex items-center justify-center">
              {logoError ? (
                <Image
                  src="/images/mcpwhtbggd.png"
                  alt="MCP"
                  width={40}
                  height={40}
                  className="object-contain"
                />
              ) : (
                <Image
                  src={logoUrl}
                  alt={server.name}
                  width={40}
                  height={40}
                  className={logoClassName}
                  onError={() => setLogoError(true)}
                />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-sm truncate">{server.name}</CardTitle>
              {server.type === "system" && (
                <Badge variant="outline" className="text-xs mt-1">
                  System
                </Badge>
              )}
            </div>
          </div>
        </div>
        {server.description && (
          <CardDescription className="text-xs line-clamp-2">{server.description}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="capitalize">{server.transport}</span>
          {server.rateLimit && <span>{server.rateLimit}/min</span>}
        </div>
      </CardContent>
    </Card>
  )
}

// Known MCP server configurations
const KNOWN_SERVERS: Record<string, { url: string; requiresApiKey?: boolean; apiKeyLink?: string; transport?: "http" | "stdio" }> = {
  "google maps grounding": { 
    url: "https://mapstools.googleapis.com/mcp", 
    transport: "http",
    requiresApiKey: true,
    apiKeyLink: "https://console.cloud.google.com/apis/credentials"
  },
  "google maps": { 
    url: "https://mapstools.googleapis.com/mcp", 
    transport: "http",
    requiresApiKey: true,
    apiKeyLink: "https://console.cloud.google.com/apis/credentials"
  },
  "maps": { 
    url: "https://mapstools.googleapis.com/mcp", 
    transport: "http",
    requiresApiKey: true,
    apiKeyLink: "https://console.cloud.google.com/apis/credentials"
  },
  "exa": {
    url: "https://mcp.exa.ai/mcp",
    transport: "http",
    requiresApiKey: true,
    apiKeyLink: "https://docs.exa.ai/reference/exa-mcp",
  },
  "exa search": {
    url: "https://mcp.exa.ai/mcp",
    transport: "http",
    requiresApiKey: true,
    apiKeyLink: "https://docs.exa.ai/reference/exa-mcp",
  },
  "exahosted": {
    url: "https://mcp.exa.ai/mcp",
    transport: "http",
    requiresApiKey: true,
    apiKeyLink: "https://docs.exa.ai/reference/exa-mcp",
  },
  "github": { 
    url: "stdio", // GitHub MCP server uses stdio transport
    transport: "stdio",
    requiresApiKey: true,
    apiKeyLink: "https://github.com/settings/tokens"
  },
  "playwright": { 
    url: "stdio", // Playwright uses stdio with npx command
    transport: "stdio",
    requiresApiKey: false 
  },
  "langchain": {
    url: "https://langchain-agent-mcp-server-554655392699.us-central1.run.app",
    transport: "http",
    requiresApiKey: false, // API key is server-side (OPENAI_API_KEY)
    apiKeyLink: undefined
  },
  "langchain mcp": {
    url: "https://langchain-agent-mcp-server-554655392699.us-central1.run.app",
    transport: "http",
    requiresApiKey: false,
    apiKeyLink: undefined
  },
  "langchain agent": {
    url: "https://langchain-agent-mcp-server-554655392699.us-central1.run.app",
    transport: "http",
    requiresApiKey: false,
    apiKeyLink: undefined
  },
  "notion": {
    url: "stdio", // Notion uses stdio with npx command
    transport: "stdio",
    requiresApiKey: true,
    apiKeyLink: "https://www.notion.so/my-integrations"
  },
  "google workspace": {
    url: "stdio", // Google Workspace uses stdio with uvx command
    transport: "stdio",
    requiresApiKey: true,
    apiKeyLink: "https://console.cloud.google.com/apis/credentials"
  },
  "google-workspace": {
    url: "stdio",
    transport: "stdio",
    requiresApiKey: true,
    apiKeyLink: "https://console.cloud.google.com/apis/credentials"
  },
  "n8n": {
    url: "stdio", // n8n uses stdio with npx command
    transport: "stdio",
    requiresApiKey: false, // Optional: may require n8n instance URL and API key
    apiKeyLink: "https://docs.n8n.io/hosting/authentication/"
  },
  "n8n automation": {
    url: "stdio",
    transport: "stdio",
    requiresApiKey: false,
    apiKeyLink: "https://docs.n8n.io/hosting/authentication/"
  },
  "sequential thinking": {
    url: "stdio", // Sequential Thinking uses stdio with npx command
    transport: "stdio",
    requiresApiKey: false,
    apiKeyLink: undefined
  },
  "sequential-thinking": {
    url: "stdio",
    transport: "stdio",
    requiresApiKey: false,
    apiKeyLink: undefined
  },
}

// Helper function to get API key link based on server name or ID
function getApiKeyLink(serverName: string, serverId?: string): string | undefined {
  const normalizedName = serverName.toLowerCase().trim()
  const normalizedId = serverId?.toLowerCase().trim()
  
  // Check by server name first
  if (KNOWN_SERVERS[normalizedName]?.apiKeyLink) {
    return KNOWN_SERVERS[normalizedName].apiKeyLink
  }
  
  // Check by server ID
  if (normalizedId && KNOWN_SERVERS[normalizedId]?.apiKeyLink) {
    return KNOWN_SERVERS[normalizedId].apiKeyLink
  }
  
  // Check if name contains keywords
  if (normalizedName.includes("github")) {
    return "https://github.com/settings/tokens"
  }
  if (normalizedName.includes("exa") || (normalizedName.includes("search") && !normalizedName.includes("github"))) {
    return "https://docs.exa.ai/reference/exa-mcp"
  }
  if (normalizedName.includes("google") || normalizedName.includes("maps")) {
    return "https://console.cloud.google.com/apis/credentials"
  }
  if (normalizedName.includes("notion")) {
    return "https://www.notion.so/my-integrations"
  }
  if (normalizedName.includes("n8n")) {
    return "https://docs.n8n.io/hosting/authentication/"
  }
  
  return undefined
}

function AddServerDialog({ 
  onAdd,
  onDelete,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  editingServer
}: { 
  onAdd: () => void
  onDelete?: (id: string, type: "system" | "user") => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
  editingServer?: McpServer | null
}) {
  const isControlled = controlledOpen !== undefined && controlledOnOpenChange !== undefined
  const [internalOpen, setInternalOpen] = React.useState(false)
  const open = isControlled ? controlledOpen : internalOpen
  const setOpen = isControlled ? controlledOnOpenChange : setInternalOpen
  const [name, setName] = React.useState("")
  const [url, setUrl] = React.useState("")
  const [apiKey, setApiKey] = React.useState("")
  const [naturalLanguageInChat] = React.useState(true) // Always enabled by default
  const [logoFile, setLogoFile] = React.useState<File | null>(null)
  const [logoPreview, setLogoPreview] = React.useState<string | null>(null)
  const [logoDataUrl, setLogoDataUrl] = React.useState<string | null>(null)
  const [testing, setTesting] = React.useState(false)
  const [testResult, setTestResult] = React.useState<{ success: boolean; message: string } | null>(null)
  const [testingApiKey, setTestingApiKey] = React.useState(false)
  const [apiKeyTestResult, setApiKeyTestResult] = React.useState<{ success: boolean; message: string } | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  // Auto-populate URL and transport based on server name
  React.useEffect(() => {
    if (name && !editingServer) {
      const normalizedName = name.toLowerCase().trim()
      const knownServer = KNOWN_SERVERS[normalizedName]
      if (knownServer && !url) {
        setUrl(knownServer.url)
      }
    }
  }, [name, url, editingServer])
  
  // Auto-populate API key from localStorage when server name changes
  React.useEffect(() => {
    if (name && !editingServer && !apiKey) {
      const normalizedName = name.toLowerCase().trim()
      let savedKey = ""
      
      if (normalizedName.includes("github")) {
        savedKey = localStorage.getItem("github_personal_access_token") || ""
      } else if (normalizedName.includes("exa")) {
        savedKey = localStorage.getItem("exa_api_key") || ""
      } else if (normalizedName.includes("maps") || normalizedName.includes("google-maps")) {
        savedKey = localStorage.getItem("google_maps_api_key") || ""
      } else if (normalizedName.includes("notion")) {
        savedKey = localStorage.getItem("notion_api_key") || ""
      }
      
      if (savedKey) {
        setApiKey(savedKey)
      }
    }
  }, [name, editingServer, apiKey])

  React.useEffect(() => {
      if (editingServer) {
      setName(editingServer.name)
      // Prepopulate URL for system servers
      const serverId = editingServer.id.toLowerCase()
      const serverName = editingServer.name.toLowerCase()
      const knownServer = KNOWN_SERVERS[serverId] || KNOWN_SERVERS[serverName]
      const defaultUrl = knownServer?.url || ""
      
      // For stdio servers, show "stdio" as the URL (read-only)
      if (knownServer?.transport === "stdio") {
        setUrl("stdio")
      } else {
        setUrl(defaultUrl)
      }
      
      // Load API key from localStorage if available, otherwise use server's stored key
      let savedApiKey = ""
      if (serverId === "github" || serverId.includes("github")) {
        savedApiKey = localStorage.getItem("github_personal_access_token") || editingServer.apiKey || ""
      } else if (serverId === "exa" || serverId.includes("exa")) {
        savedApiKey = localStorage.getItem("exa_api_key") || editingServer.apiKey || ""
      } else if (serverId.includes("maps") || serverId.includes("google-maps")) {
        savedApiKey = localStorage.getItem("google_maps_api_key") || editingServer.apiKey || ""
      } else if (serverId === "notion" || serverId.includes("notion")) {
        savedApiKey = localStorage.getItem("notion_api_key") || editingServer.apiKey || ""
      } else if (serverId === "google-workspace" || serverId.includes("google-workspace") || serverId.includes("workspace")) {
        // Google Workspace uses OAuth, but we can store client ID/secret if needed
        savedApiKey = editingServer.apiKey || ""
      } else {
        savedApiKey = editingServer.apiKey || ""
      }
      setApiKey(savedApiKey)
      
      // naturalLanguageInChat is always true, no need to set it
      if (editingServer.logoUrl) {
        setLogoPreview(editingServer.logoUrl)
      }
    } else {
      setName("")
      setUrl("")
      setApiKey("")
      // naturalLanguageInChat is always true, no need to reset it
      setTestResult(null)
      setLogoFile(null)
      if (logoPreview && !logoPreview.startsWith("http") && !logoPreview.startsWith("data:")) {
        URL.revokeObjectURL(logoPreview)
      }
      setLogoPreview(null)
      setLogoDataUrl(null)
    }
  }, [editingServer])

  const handleLogoSelect = (file: File) => {
    if (file.type.startsWith("image/")) {
      setLogoFile(file)
      const url = URL.createObjectURL(file)
      setLogoPreview(url) // For preview display
      
      // Also convert to data URL for storage
      const reader = new FileReader()
      reader.onloadend = () => {
        if (reader.result) {
          setLogoDataUrl(reader.result as string) // Store data URL for saving
        }
      }
      reader.readAsDataURL(file)
    }
  }

  const handleTestApiKey = async () => {
    if (!apiKey.trim()) {
      setApiKeyTestResult({ success: false, message: "Please enter an API key first" })
      return
    }

    setTestingApiKey(true)
    setApiKeyTestResult(null)

    try {
      const normalizedName = name.toLowerCase().trim()
      const serverId = editingServer?.id?.toLowerCase() || normalizedName
      const serverName = name.toLowerCase().trim()
      const knownServer = KNOWN_SERVERS[serverId] || KNOWN_SERVERS[serverName]
      
      let testConfig: any
      let testServerId = serverId

      // Test Google Maps API key
      if (normalizedName.includes("google") && normalizedName.includes("maps") || 
          serverId === "maps" || serverId === "google-maps-grounding") {
        testConfig = {
          id: "maps",
          name: "Google Maps Grounding",
          transport: "http",
          url: "https://mapstools.googleapis.com/mcp",
          headers: {
            "X-Goog-Api-Key": apiKey.trim(),
          },
        }
      }
      // Test Exa API key
      else if (serverId === "exa" || serverId.includes("exa") || normalizedName.includes("exa")) {
        testConfig = {
          id: "exa",
          name: "Exa Search",
          transport: "http",
          url: "https://mcp.exa.ai/mcp",
          headers: {
            "x-api-key": apiKey.trim(),
            "Accept": "application/json",
          },
        }
      }
      // Test GitHub token
      else if (serverId === "github" || serverId.includes("github") || normalizedName.includes("github")) {
        testConfig = {
          id: "github",
          name: "GitHub",
          transport: "stdio",
          command: "npx",
          args: ["-y", "@modelcontextprotocol/server-github"],
          env: {
            GITHUB_PERSONAL_ACCESS_TOKEN: apiKey.trim(),
          },
        }
      }
      // Test Notion API key
      else if (serverId === "notion" || serverId.includes("notion") || normalizedName.includes("notion")) {
        testConfig = {
          id: "notion",
          name: "Notion",
          transport: "stdio",
          command: "npx",
          args: ["-y", "@notionhq/notion-mcp-server"],
          env: {
            NOTION_API_KEY: apiKey.trim(),
          },
        }
      }
      // Unsupported server for API key testing
      else {
        setApiKeyTestResult({ 
          success: false, 
          message: `API key testing is not available for ${name}. You can test the connection using the "Test" button next to the URL field.` 
        })
        setTestingApiKey(false)
        return
      }

      // Test the API key via MCP health check
      const response = await fetch("/api/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "health",
          config: testConfig,
        }),
      })

      const data = await response.json()

      if (response.ok && data.status?.healthy) {
        setApiKeyTestResult({ 
          success: true, 
          message: data.status.message || "✅ API key is valid and working!" 
        })
      } else {
        const errorMsg = data.status?.message || data.error || "API key test failed"
        // Provide helpful error messages
        let helpfulMessage = errorMsg
        if (errorMsg.includes("401") || errorMsg.includes("Unauthorized") || errorMsg.includes("Invalid")) {
          helpfulMessage = "❌ Invalid API key. Please check your key and try again."
        } else if (errorMsg.includes("403") || errorMsg.includes("Forbidden")) {
          helpfulMessage = "❌ API key is valid but doesn't have the required permissions."
        } else if (errorMsg.includes("404") || errorMsg.includes("Not Found")) {
          helpfulMessage = "❌ Server endpoint not found. Please check the server configuration."
        }
        setApiKeyTestResult({ 
          success: false, 
          message: helpfulMessage 
        })
      }
    } catch (error) {
      setApiKeyTestResult({ 
        success: false, 
        message: error instanceof Error ? `Failed to test API key: ${error.message}` : "Failed to test API key. Please check your connection and try again." 
      })
    } finally {
      setTestingApiKey(false)
    }
  }

  const handleTestConnection = async () => {
    setTesting(true)
    setTestResult(null)

    try {
      const normalizedName = name.toLowerCase().trim()
      const serverId = editingServer?.id?.toLowerCase() || normalizedName
      
      // Determine transport type based on server type or URL
      const serverName = name.toLowerCase().trim()
      const knownServer = KNOWN_SERVERS[serverId] || KNOWN_SERVERS[serverName]
      const isStdioServer = url === "stdio" || 
                           knownServer?.transport === "stdio" ||
                           serverId === "github" || 
                           serverId === "playwright" ||
                           serverId === "notion" ||
                           serverId === "google-workspace" ||
                           serverId === "n8n" ||
                           serverId === "sequential-thinking" ||
                           normalizedName === "github" ||
                           normalizedName === "playwright" ||
                           normalizedName === "notion" ||
                           normalizedName.includes("workspace") ||
                           normalizedName === "n8n" ||
                           normalizedName.includes("sequential")
      
      let config: any

      if (isStdioServer) {
        // Stdio transport servers (GitHub, Playwright)
        if (serverId === "github" || normalizedName === "github") {
          // GitHub MCP server
          const token = apiKey || process.env.GITHUB_PERSONAL_ACCESS_TOKEN || process.env.GITHUB_TOKEN
          if (!token) {
            setTestResult({ 
              success: false, 
              message: "GitHub Personal Access Token required. Set GITHUB_PERSONAL_ACCESS_TOKEN environment variable or enter it in the API Key field." 
            })
            setTesting(false)
            return
          }
          config = {
            id: "github",
            name: name || "GitHub",
            transport: "stdio",
            command: "npx",
            args: ["-y", "@modelcontextprotocol/server-github"],
            env: {
              GITHUB_PERSONAL_ACCESS_TOKEN: token,
            },
          }
        } else if (serverId === "playwright" || normalizedName === "playwright") {
          // Playwright MCP server (no API key needed)
          config = {
            id: "playwright",
            name: name || "Playwright",
            transport: "stdio",
            command: "npx",
            args: ["@playwright/mcp@latest", "--headless", "--isolated"],
          }
        } else if (serverId === "notion" || normalizedName === "notion") {
          // Notion MCP server
          const notionKey = apiKey || process.env.NOTION_API_KEY
          if (!notionKey) {
            setTestResult({ 
              success: false, 
              message: "Notion API key required. Get one from https://www.notion.so/my-integrations" 
            })
            setTesting(false)
            return
          }
          config = {
            id: "notion",
            name: name || "Notion",
            transport: "stdio",
            command: "npx",
            args: ["-y", "@notionhq/notion-mcp-server"],
            env: {
              NOTION_API_KEY: notionKey,
            },
          }
        } else if (serverId === "google-workspace" || normalizedName.includes("workspace")) {
          // Google Workspace MCP server (OAuth2 - requires environment variables)
          const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
          const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET
          if (!clientId || !clientSecret) {
            setTestResult({ 
              success: false, 
              message: "Google Workspace requires OAuth2 credentials. Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET environment variables. Get credentials from Google Cloud Console." 
            })
            setTesting(false)
            return
          }
          config = {
            id: "google-workspace",
            name: name || "Google Workspace",
            transport: "stdio",
            command: "uvx",
            args: ["workspace-mcp", "--transport", "streamable-http"],
            env: {
              GOOGLE_OAUTH_CLIENT_ID: clientId,
              GOOGLE_OAUTH_CLIENT_SECRET: clientSecret,
            },
          }
        } else if (serverId === "n8n" || normalizedName === "n8n") {
          // n8n MCP server (optional API key)
          config = {
            id: "n8n",
            name: name || "n8n Automation",
            transport: "stdio",
            command: "npx",
            args: ["-y", "n8n-mcp-server"],
            ...(apiKey ? { env: { N8N_API_KEY: apiKey } } : {}),
          }
        } else if (serverId === "sequential-thinking" || normalizedName.includes("sequential")) {
          // Sequential Thinking MCP server (no API key needed)
          config = {
            id: "sequential-thinking",
            name: name || "Sequential Thinking",
            transport: "stdio",
            command: "npx",
            args: ["-y", "mcp-sequentialthinking-tools"],
          }
        } else {
          setTestResult({ 
            success: false, 
            message: "Stdio transport requires server-specific configuration. Please configure the server properly." 
          })
          setTesting(false)
          return
        }
      } else {
        // HTTP transport servers
        if (!url || url.trim() === "") {
          setTestResult({ success: false, message: "Please enter a server URL" })
          setTesting(false)
          return
        }

        // Skip URL validation if it's "stdio" (shouldn't happen here, but just in case)
        if (url.toLowerCase().trim() === "stdio") {
          setTestResult({ 
            success: false, 
            message: "Stdio transport detected. Please use the proper server configuration for stdio-based servers." 
          })
          setTesting(false)
          return
        }

        // Validate URL format for HTTP transport
        try {
          new URL(url)
        } catch (urlError) {
          setTestResult({ 
            success: false, 
            message: `Invalid URL format: ${urlError instanceof Error ? urlError.message : "Please enter a valid URL (e.g., https://api.example.com/mcp)"}` 
          })
          setTesting(false)
          return
        }

        config = {
          id: serverId || normalizedName,
          name: name || normalizedName,
          transport: "http",
          url: url,
        }

        // Add API key to headers if provided (for HTTP transport)
        if (apiKey) {
          if (normalizedName.includes("google") || normalizedName.includes("maps")) {
            config.headers = { "X-Goog-Api-Key": apiKey }
          } else if (normalizedName.includes("exa")) {
            config.headers = { "x-api-key": apiKey, "Accept": "application/json" }
          } else {
            config.headers = { "Authorization": `Bearer ${apiKey}` }
          }
        }
      }

      const response = await fetch("/api/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "health",
          config: config,
        }),
      })

      const data = await response.json()

      if (response.ok && data.status?.healthy) {
        setTestResult({ success: true, message: data.status.message || "Connection successful!" })
      } else {
        setTestResult({ 
          success: false, 
          message: data.status?.message || data.error || "Connection failed" 
        })
      }
    } catch (error) {
      setTestResult({ 
        success: false, 
        message: error instanceof Error ? error.message : "Failed to test connection" 
      })
    } finally {
      setTesting(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Save API keys to localStorage for easy reuse
    const serverId = editingServer?.id?.toLowerCase() || name.toLowerCase().trim()
    if ((serverId === "github" || serverId.includes("github")) && apiKey) {
      localStorage.setItem("github_personal_access_token", apiKey.trim())
      console.log("GitHub token saved to localStorage")
    }
    
    // Save Exa API key to localStorage if it's Exa Search
    if ((serverId === "exa" || serverId.includes("exa")) && apiKey) {
      localStorage.setItem("exa_api_key", apiKey.trim())
      console.log("Exa API key saved to localStorage")
    }

    if ((serverId.includes("maps") || serverId.includes("google-maps")) && apiKey) {
      localStorage.setItem("google_maps_api_key", apiKey.trim())
      console.log("Google Maps API key saved to localStorage")
    }
    
    if ((serverId === "notion" || serverId.includes("notion")) && apiKey) {
      localStorage.setItem("notion_api_key", apiKey.trim())
      console.log("Notion API key saved to localStorage")
    }
    
    if (editingServer) {
      // TODO: Implement API call to update server
      console.log("Updating server:", { id: editingServer.id, name, url, apiKey, naturalLanguageInChat: true, logoFile })
      
      // Update in localStorage for now
      const storedUserServers = localStorage.getItem("user_servers")
      const userServers = storedUserServers ? JSON.parse(storedUserServers) : []
      const updatedServers = userServers.map((s: McpServer) => 
        s.id === editingServer.id 
          ? { ...s, name, url, apiKey: apiKey || s.apiKey, logoUrl: logoPreview || s.logoUrl }
          : s
      )
      localStorage.setItem("user_servers", JSON.stringify(updatedServers))
      
      // Dispatch custom event to notify other components
      window.dispatchEvent(new Event("userServersUpdated"))
    } else {
      // Determine transport type
    const normalizedName = name.toLowerCase().trim()
    const isStdioServer = url === "stdio" || 
                         normalizedName === "github" || 
                         normalizedName === "playwright"
      
      const transport = isStdioServer ? "stdio" : "http"
      
      // Use data URL if available, otherwise use preview (which might be a URL)
      const finalLogoUrl = logoDataUrl || logoPreview || undefined
      
      // Save server via API (will save to Supabase if authenticated, localStorage if not)
      try {
        const response = await fetch("/api/servers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            url: url.trim(),
            transport,
            apiKey: apiKey?.trim() || undefined,
            logoUrl: finalLogoUrl || undefined,
            description: `Custom MCP server: ${name}`,
          }),
        })
        
        if (response.ok) {
          const data = await response.json()
          console.log("Added server:", data.server)
          
          // If not authenticated, also save to localStorage as fallback
          if (!user && typeof window !== "undefined") {
            const storedUserServers = localStorage.getItem("user_servers")
            const userServers = storedUserServers ? JSON.parse(storedUserServers) : []
            userServers.push(data.server)
            localStorage.setItem("user_servers", JSON.stringify(userServers))
          }
          
          // Dispatch custom event to notify other components
          window.dispatchEvent(new Event("userServersUpdated"))
          
          // Refresh server list
          fetchServers()
        } else {
          const errorData = await response.json()
          console.error("Failed to add server:", errorData.error)
          alert(`Failed to add server: ${errorData.error || "Unknown error"}`)
        }
      } catch (error) {
        console.error("Error adding server:", error)
        alert(`Failed to add server: ${error instanceof Error ? error.message : "Unknown error"}`)
      }
    }
    
    setOpen(false)
    setName("")
    setUrl("")
    setApiKey("")
    // naturalLanguageInChat is always true, no need to reset it
    setLogoFile(null)
    if (logoPreview && !logoPreview.startsWith("http") && !logoPreview.startsWith("data:")) {
      URL.revokeObjectURL(logoPreview)
    }
    setLogoPreview(null)
    setLogoDataUrl(null)
    onAdd() // This will trigger fetchServers
  }

  const handleDelete = async () => {
    if (editingServer && onDelete) {
      onDelete(editingServer.id, editingServer.type)
      setOpen(false)
      setName("")
      setUrl("")
      setApiKey("")
      // naturalLanguageInChat is always true, no need to reset it
      setLogoFile(null)
      if (logoPreview && !logoPreview.startsWith("http")) {
        URL.revokeObjectURL(logoPreview)
      }
      setLogoPreview(null)
      onAdd()
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isControlled && (
        <DialogTrigger asChild>
          <Button size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Add Server
          </Button>
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="sr-only">
            {editingServer ? "Update Server" : "Add Server"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Server Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Custom Server"
              required
              disabled={editingServer?.type === "system"}
              className={editingServer?.type === "system" ? "bg-muted cursor-not-allowed" : ""}
            />
            {editingServer?.type === "system" && (
              <p className="text-xs text-muted-foreground">
                System server name cannot be changed
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="url">Server URL</Label>
            <div className="flex gap-2">
              <Input
                id="url"
                type="text"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value)
                  setTestResult(null)
                }}
                placeholder={(() => {
                  const serverId = editingServer?.id?.toLowerCase() || name.toLowerCase().trim()
                  const serverName = name.toLowerCase().trim()
                  const knownServer = KNOWN_SERVERS[serverId] || KNOWN_SERVERS[serverName]
                  
                  if (knownServer?.transport === "stdio") {
                    return "stdio (uses stdio transport)"
                  }
                  if (knownServer?.url && knownServer.url !== "stdio") {
                    return knownServer.url
                  }
                  return "https://mcp.exa.ai/mcp"
                })()}
                required={(() => {
                  const serverId = editingServer?.id?.toLowerCase() || name.toLowerCase().trim()
                  const serverName = name.toLowerCase().trim()
                  const knownServer = KNOWN_SERVERS[serverId] || KNOWN_SERVERS[serverName]
                  return knownServer?.transport !== "stdio"
                })()}
                disabled={editingServer?.type === "system" || (() => {
                  const serverId = editingServer?.id?.toLowerCase() || name.toLowerCase().trim()
                  const serverName = name.toLowerCase().trim()
                  const knownServer = KNOWN_SERVERS[serverId] || KNOWN_SERVERS[serverName]
                  return knownServer?.transport === "stdio"
                })()}
                className={`flex-1 ${editingServer?.type === "system" ? "bg-muted cursor-not-allowed" : ""}`}
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleTestConnection}
                disabled={testing || !url || (() => {
                  const serverId = editingServer?.id?.toLowerCase() || name.toLowerCase().trim()
                  const serverName = name.toLowerCase().trim()
                  const knownServer = KNOWN_SERVERS[serverId] || KNOWN_SERVERS[serverName]
                  return knownServer?.transport === "stdio"
                })()}
                className="shrink-0"
              >
                {testing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Testing...
                  </>
                ) : (
                  "Test"
                )}
              </Button>
            </div>
            {(() => {
              const serverId = editingServer?.id?.toLowerCase() || name.toLowerCase().trim()
              const serverName = name.toLowerCase().trim()
              const knownServer = KNOWN_SERVERS[serverId] || KNOWN_SERVERS[serverName]
              if (knownServer?.transport === "stdio") {
                return (
                  <p className="text-xs text-muted-foreground">
                    This server uses stdio transport. The URL is automatically configured based on the server type.
                  </p>
                )
              }
              return null
            })()}
            {testResult && (
              <div className={`flex items-center gap-2 text-sm ${
                testResult.success ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
              }`}>
                {testResult.success ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                <span>{testResult.message}</span>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="apiKey">
                API Key {(() => {
                  const serverId = editingServer?.id?.toLowerCase() || name.toLowerCase().trim()
                  const serverName = name.toLowerCase().trim()
                  const knownServer = KNOWN_SERVERS[serverId] || KNOWN_SERVERS[serverName]
                  return knownServer?.requiresApiKey ? "(Required)" : "(Optional)"
                })()}
              </Label>
              {(() => {
                const apiKeyLink = getApiKeyLink(name, editingServer?.id)
                if (apiKeyLink) {
                  return (
                    <a
                      href={apiKeyLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-primary hover:underline flex items-center gap-1 px-2 py-1 rounded hover:bg-primary/10 transition-colors"
                    >
                      Get API Key
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )
                }
                return null
              })()}
            </div>
            <div className="flex gap-2">
              <Input
                id="apiKey"
                type="password"
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value)
                  setApiKeyTestResult(null) // Clear test result when typing
                }}
                placeholder={(() => {
                  const serverId = editingServer?.id?.toLowerCase() || name.toLowerCase().trim()
                  const serverName = name.toLowerCase().trim()
                  const knownServer = KNOWN_SERVERS[serverId] || KNOWN_SERVERS[serverName]
                  
                  if (serverId === "notion" || serverName.includes("notion")) {
                    return "Enter your Notion Integration Token"
                  }
                  if (serverId === "github" || serverName.includes("github")) {
                    return "Enter your GitHub Personal Access Token"
                  }
                  if (serverId.includes("google-workspace") || serverName.includes("workspace")) {
                    return "OAuth credentials configured via environment variables"
                  }
                  return "Enter your API key"
                })()}
                className="flex-1"
              />
              {(() => {
                const serverId = editingServer?.id?.toLowerCase() || name.toLowerCase().trim()
                const serverName = name.toLowerCase().trim()
                const knownServer = KNOWN_SERVERS[serverId] || KNOWN_SERVERS[serverName]
                
                // Show test button for servers that require API keys
                if (knownServer?.requiresApiKey) {
                  return (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleTestApiKey}
                      disabled={testingApiKey || !apiKey.trim()}
                      className="shrink-0"
                      title={apiKey.trim() ? "Test API key before saving" : "Enter an API key to test it"}
                    >
                      {testingApiKey ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Testing...
                        </>
                      ) : (
                        "Test Key"
                      )}
                    </Button>
                  )
                }
                return null
              })()}
            </div>
            {apiKeyTestResult && (
              <div className={`flex items-center gap-2 text-sm ${
                apiKeyTestResult.success ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
              }`}>
                {apiKeyTestResult.success ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                <span>{apiKeyTestResult.message}</span>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {(() => {
                const serverId = editingServer?.id?.toLowerCase() || name.toLowerCase().trim()
                const serverName = name.toLowerCase().trim()
                const knownServer = KNOWN_SERVERS[serverId] || KNOWN_SERVERS[serverName]
                const apiKeyLink = getApiKeyLink(name, editingServer?.id)
                
                if (serverId.includes("google-workspace") || serverName.includes("workspace")) {
                  return (
                    <>
                      Google Workspace uses OAuth2 authentication. Set <code className="text-xs bg-muted px-1 py-0.5 rounded">GOOGLE_OAUTH_CLIENT_ID</code> and <code className="text-xs bg-muted px-1 py-0.5 rounded">GOOGLE_OAUTH_CLIENT_SECRET</code> environment variables.{" "}
                      {apiKeyLink && (
                        <a
                          href={apiKeyLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline font-medium"
                        >
                          Get credentials from Google Cloud Console
                        </a>
                      )}
                    </>
                  )
                }
                
                if (apiKeyLink) {
                  const serverId = editingServer?.id?.toLowerCase() || name.toLowerCase().trim()
                  const serverName = name.toLowerCase().trim()
                  const knownServer = KNOWN_SERVERS[serverId] || KNOWN_SERVERS[serverName]
                  const canTest = knownServer?.requiresApiKey
                  
                  return (
                    <>
                      API key for authenticating with the server.{" "}
                      <a
                        href={apiKeyLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline font-medium"
                      >
                        Get your API key here →
                      </a>
                      {canTest && (
                        <> Use the "Test Key" button to verify your key works before saving.</>
                      )}
                    </>
                  )
                }
                
                return "API key for authenticating with the server (if required)"
              })()}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="logo">Logo (Optional)</Label>
            <div className="flex items-center gap-4">
              {logoPreview && (
                <div className="relative h-16 w-16 rounded-lg overflow-hidden border border-border">
                  <img 
                    src={logoPreview} 
                    alt="Logo preview" 
                    className={`h-full w-full object-contain ${
                      editingServer?.id === "github" || name.toLowerCase() === "github"
                        ? "dark:brightness-0 dark:invert"
                        : ""
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setLogoFile(null)
                      if (logoPreview) {
                        URL.revokeObjectURL(logoPreview)
                        setLogoPreview(null)
                      }
                      if (fileInputRef.current) {
                        fileInputRef.current.value = ""
                      }
                    }}
                    className="absolute -top-1 -right-1 p-1 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mr-2 h-4 w-4" />
                Upload Logo
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleLogoSelect(file)
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              If no logo is provided, the MCP logo will be used
            </p>
          </div>
          <div className="flex justify-between items-center">
            {editingServer && editingServer.type === "user" && (
              <Button 
                type="button" 
                variant="destructive" 
                onClick={handleDelete}
                className="flex items-center gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">{editingServer ? "Update Server" : "Add Server"}</Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function WorkerMonitoringSection() {
  const [metrics, setMetrics] = React.useState<any>(null)
  const [loading, setLoading] = React.useState(true)
  const [metricsHistory, setMetricsHistory] = React.useState<{
    processed: Array<{ time: string; value: number }>
    failed: Array<{ time: string; value: number }>
    active: Array<{ time: string; value: number }>
  }>({
    processed: [],
    failed: [],
    active: [],
  })
  const [lastMetrics, setLastMetrics] = React.useState<{
    processed: number
    failed: number
  }>({ processed: 0, failed: 0 })

  const fetchData = React.useCallback(async () => {
    try {
      // Fetch metrics
      const metricsRes = await fetch("/api/metrics", { cache: 'no-store' })
      const metricsData = await metricsRes.json()
      setMetrics(metricsData)

      // Calculate incremental values (new tasks since last poll)
      const currentProcessed = metricsData.tasks?.processed || 0
      const currentFailed = metricsData.tasks?.failed || 0
      const newProcessed = currentProcessed - lastMetrics.processed
      const newFailed = currentFailed - lastMetrics.failed
      
      // Update last metrics for next calculation
      setLastMetrics({
        processed: currentProcessed,
        failed: currentFailed,
      })

      // Update history (keep last 20 data points)
      // For processed/failed: show incremental values (new tasks in this interval)
      // For active: show current active count
      const now = new Date().toLocaleTimeString()
      setMetricsHistory((prev) => ({
        processed: [
          ...prev.processed.slice(-19),
          { time: now, value: newProcessed >= 0 ? newProcessed : 0 }, // Incremental
        ],
        failed: [
          ...prev.failed.slice(-19),
          { time: now, value: newFailed >= 0 ? newFailed : 0 }, // Incremental
        ],
        active: [
          ...prev.active.slice(-19),
          { time: now, value: metricsData.workers?.active || 0 }, // Current count
        ],
      }))
    } catch (err) {
      console.error("Failed to fetch monitoring data:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchData()
    // Poll every 5 seconds for real-time updates
    const interval = setInterval(fetchData, 5000)
    return () => clearInterval(interval)
  }, [fetchData])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Metrics Charts */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <MetricsChart
          title="Tasks Processed"
          description="Total tasks processed over time"
          data={metricsHistory.processed}
          color="hsl(var(--primary))"
        />
        <MetricsChart
          title="Failed Tasks"
          description="Failed tasks over time"
          data={metricsHistory.failed}
          color="hsl(var(--destructive))"
        />
        <MetricsChart
          title="Active Workers"
          description="Number of active workers over time"
          data={metricsHistory.active}
          color="hsl(var(--accent))"
        />
      </div>
    </div>
  )
}

export default function RegistryPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col gap-10 p-8">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    }>
      <RegistryPageContent />
    </Suspense>
  )
}
