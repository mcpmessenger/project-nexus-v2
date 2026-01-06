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
} from "lucide-react"
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
    if (server.logoUrl) {
      return server.logoUrl
    }
    return "/images/mcpwhtbggd.png" // MCP logo fallback
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

      {/* Worker Monitoring Section */}
      <WorkerMonitoringSection />

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
const KNOWN_SERVERS: Record<string, { url: string; requiresApiKey?: boolean; apiKeyLink?: string }> = {
  "google maps grounding": { 
    url: "https://mapstools.googleapis.com/mcp", 
    requiresApiKey: true,
    apiKeyLink: "https://console.cloud.google.com/apis/credentials"
  },
  "google maps": { 
    url: "https://mapstools.googleapis.com/mcp", 
    requiresApiKey: true,
    apiKeyLink: "https://console.cloud.google.com/apis/credentials"
  },
  "maps": { 
    url: "https://mapstools.googleapis.com/mcp", 
    requiresApiKey: true,
    apiKeyLink: "https://console.cloud.google.com/apis/credentials"
  },
  "exa": {
    url: "https://mcp.exa.ai/mcp",
    requiresApiKey: true,
    apiKeyLink: "https://docs.exa.ai/reference/exa-mcp",
  },
  "exa search": {
    url: "https://mcp.exa.ai/mcp",
    requiresApiKey: true,
    apiKeyLink: "https://docs.exa.ai/reference/exa-mcp",
  },
  "exahosted": {
    url: "https://mcp.exa.ai/mcp",
    requiresApiKey: true,
    apiKeyLink: "https://docs.exa.ai/reference/exa-mcp",
  },
  "github": { 
    url: "stdio", // GitHub MCP server uses stdio transport
    requiresApiKey: true,
    apiKeyLink: "https://github.com/settings/tokens"
  },
  "playwright": { 
    url: "http://localhost:8931/mcp", 
    requiresApiKey: false 
  },
  "langchain": {
    url: "https://langchain-agent-mcp-server-554655392699.us-central1.run.app",
    requiresApiKey: false, // API key is server-side (OPENAI_API_KEY)
    apiKeyLink: undefined
  },
  "langchain mcp": {
    url: "https://langchain-agent-mcp-server-554655392699.us-central1.run.app",
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

  // Auto-populate URL based on server name
  React.useEffect(() => {
    if (name && !editingServer) {
      const normalizedName = name.toLowerCase().trim()
      const knownServer = KNOWN_SERVERS[normalizedName]
      if (knownServer && !url) {
        setUrl(knownServer.url)
      }
    }
  }, [name, url, editingServer])

  React.useEffect(() => {
      if (editingServer) {
      setName(editingServer.name)
      // Prepopulate URL for system servers
      const serverId = editingServer.id.toLowerCase()
      const defaultUrl = KNOWN_SERVERS[serverId]?.url || KNOWN_SERVERS[editingServer.name.toLowerCase()]?.url || ""
      setUrl(defaultUrl)
      
      // Load API key from localStorage if available, otherwise use server's stored key
      let savedApiKey = ""
      if (serverId === "github" || serverId.includes("github")) {
        savedApiKey = localStorage.getItem("github_personal_access_token") || editingServer.apiKey || ""
      } else if (serverId === "exa" || serverId.includes("exa")) {
        savedApiKey = localStorage.getItem("exa_api_key") || editingServer.apiKey || ""
      } else if (serverId.includes("maps") || serverId.includes("google")) {
        savedApiKey = localStorage.getItem("google_maps_api_key") || editingServer.apiKey || ""
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
      
      // Only test API key for Maps/Google servers
      if (!normalizedName.includes("google") && !normalizedName.includes("maps") && 
          serverId !== "maps" && serverId !== "google-maps-grounding") {
        setApiKeyTestResult({ 
          success: false, 
          message: "API key testing is only available for Google Maps servers" 
        })
        setTestingApiKey(false)
        return
      }

      // Test the Maps API key
      const response = await fetch("/api/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "health",
          config: {
            id: "maps",
            name: "Google Maps Grounding",
            transport: "http",
            url: "https://mapstools.googleapis.com/mcp",
            headers: {
              "X-Goog-Api-Key": apiKey.trim(),
            },
          },
        }),
      })

      const data = await response.json()

      if (response.ok && data.status?.healthy) {
        setApiKeyTestResult({ 
          success: true, 
          message: data.status.message || "API key is valid and working!" 
        })
      } else {
        const errorMsg = data.status?.message || data.error || "API key test failed"
        setApiKeyTestResult({ 
          success: false, 
          message: errorMsg 
        })
      }
    } catch (error) {
      setApiKeyTestResult({ 
        success: false, 
        message: error instanceof Error ? error.message : "Failed to test API key" 
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
      const isStdioServer = url === "stdio" || 
                           serverId === "github" || 
                           serverId === "playwright" ||
                           normalizedName === "github" ||
                           normalizedName === "playwright"
      
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
    
    // Save GitHub token to localStorage if it's a GitHub server
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

    if ((serverId.includes("maps") || serverId.includes("google")) && apiKey) {
      localStorage.setItem("google_maps_api_key", apiKey.trim())
      console.log("Google Maps API key saved to localStorage")
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
                  if (serverId === "github" || serverId === "playwright") {
                    return "stdio (uses stdio transport)"
                  }
                  return "https://mcp.exa.ai/mcp"
                })()}
                required={(() => {
                  const serverId = editingServer?.id?.toLowerCase() || name.toLowerCase().trim()
                  return serverId !== "github" && serverId !== "playwright"
                })()}
                disabled={editingServer?.type === "system"}
                className={`flex-1 ${editingServer?.type === "system" ? "bg-muted cursor-not-allowed" : ""}`}
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleTestConnection}
                disabled={testing || !url}
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
              <Label htmlFor="apiKey">API Key (Optional)</Label>
              {(() => {
                const apiKeyLink = getApiKeyLink(name, editingServer?.id)
                if (apiKeyLink) {
                  return (
                    <a
                      href={apiKeyLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                    >
                      Get API key
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
                placeholder="Enter your API key"
                className="flex-1"
              />
              {((name.toLowerCase().includes("google") || name.toLowerCase().includes("maps")) ||
                editingServer?.id === "maps" || editingServer?.id === "google-maps-grounding") && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleTestApiKey}
                  disabled={testingApiKey || !apiKey.trim()}
                  className="shrink-0"
                >
                  {testingApiKey ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    "Test"
                  )}
                </Button>
              )}
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
              API key for authenticating with the server
              {(() => {
                const apiKeyLink = getApiKeyLink(name, editingServer?.id)
                if (apiKeyLink) {
                  return (
                    <>
                      {" "}
                      (
                      <a
                        href={apiKeyLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        Get one here
                      </a>
                      )
                    </>
                  )
                }
                return null
              })()}
              {((name.toLowerCase().includes("google") || name.toLowerCase().includes("maps")) ||
                editingServer?.id === "maps" || editingServer?.id === "google-maps-grounding") && (
                <>. Click "Test" to verify your key works.</>
              )}
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
