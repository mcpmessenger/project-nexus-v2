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
  TrendingUp,
  AlertCircle,
  ExternalLink,
} from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { WorkerStatusCard } from "@/components/worker-status-card"
import { MetricsChart } from "@/components/metrics-chart"
import type { WorkerStatus } from "@/lib/pulsar-client"

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
    // TODO: Implement API call to delete server
    console.log("Deleting server:", serverId, type)
    setServers((prev) => ({
      ...prev,
      [type]: prev[type].filter((s) => s.id !== serverId),
    }))
  }

  const fetchServers = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/servers")
      const data = await res.json()
      setServers(data)
    } catch (err) {
      console.error("Failed to fetch servers:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchServers()
  }, [fetchServers])

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
  "brave search": { 
    url: "https://api.search.brave.com/res/v1/web/search", 
    requiresApiKey: true,
    apiKeyLink: "https://brave.com/search/api/"
  },
  "brave": { 
    url: "https://api.search.brave.com/res/v1/web/search", 
    requiresApiKey: true,
    apiKeyLink: "https://brave.com/search/api/"
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
  if (normalizedName.includes("brave") || normalizedName.includes("search")) {
    return "https://brave.com/search/api/"
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
  const [testing, setTesting] = React.useState(false)
  const [testResult, setTestResult] = React.useState<{ success: boolean; message: string } | null>(null)
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
      } else if (serverId === "brave" || serverId.includes("brave")) {
        savedApiKey = localStorage.getItem("brave_api_key") || editingServer.apiKey || ""
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
      if (logoPreview && !logoPreview.startsWith("http")) {
        URL.revokeObjectURL(logoPreview)
      }
      setLogoPreview(null)
    }
  }, [editingServer])

  const handleLogoSelect = (file: File) => {
    if (file.type.startsWith("image/")) {
      setLogoFile(file)
      const url = URL.createObjectURL(file)
      setLogoPreview(url)
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
                           serverId === "brave" || 
                           serverId === "playwright" ||
                           normalizedName === "github" ||
                           normalizedName === "brave" ||
                           normalizedName === "playwright"
      
      let config: any

      if (isStdioServer) {
        // Stdio transport servers (GitHub, Brave, Playwright)
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
        } else if (serverId === "brave" || normalizedName === "brave" || normalizedName.includes("brave")) {
          // Brave Search MCP server
          const braveKey = apiKey || process.env.BRAVE_API_KEY
          if (!braveKey) {
            setTestResult({ 
              success: false, 
              message: "Brave API key required. Set BRAVE_API_KEY environment variable or enter it in the API Key field." 
            })
            setTesting(false)
            return
          }
          config = {
            id: "brave",
            name: name || "Brave Search",
            transport: "stdio",
            command: "npx",
            args: ["-y", "@brave/brave-search-mcp-server", "--brave-api-key", braveKey],
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
          transport: "http",
          url: url,
        }

        // Add API key to headers if provided (for HTTP transport)
        if (apiKey) {
          if (normalizedName.includes("google") || normalizedName.includes("maps")) {
            config.headers = { "X-Goog-Api-Key": apiKey }
          } else if (normalizedName.includes("brave")) {
            config.headers = { "X-Subscription-Token": apiKey, "Accept": "application/json" }
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
    
    // Save Brave API key to localStorage if it's a Brave server
    if ((serverId === "brave" || serverId.includes("brave")) && apiKey) {
      localStorage.setItem("brave_api_key", apiKey.trim())
      console.log("Brave API key saved to localStorage")
    }
    
    if (editingServer) {
      // TODO: Implement API call to update server
      console.log("Updating server:", { id: editingServer.id, name, url, apiKey, naturalLanguageInChat: true, logoFile })
    } else {
      // TODO: Implement API call to add server
      console.log("Adding server:", { name, url, apiKey, naturalLanguageInChat: true, logoFile })
    }
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
                  if (serverId === "github" || serverId === "brave" || serverId === "playwright") {
                    return "stdio (uses stdio transport)"
                  }
                  return "https://api.example.com/mcp"
                })()}
                required={(() => {
                  const serverId = editingServer?.id?.toLowerCase() || name.toLowerCase().trim()
                  return serverId !== "github" && serverId !== "brave" && serverId !== "playwright"
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
            <Input
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your API key"
            />
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
  const [workers, setWorkers] = React.useState<WorkerStatus[]>([])
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

  const fetchData = React.useCallback(async () => {
    try {
      // Fetch workers
      const workersRes = await fetch("/api/workers/status", { cache: 'no-store' })
      const workersData = await workersRes.json()
      setWorkers(workersData.workers || [])

      // Fetch metrics
      const metricsRes = await fetch("/api/metrics", { cache: 'no-store' })
      const metricsData = await metricsRes.json()
      setMetrics(metricsData)

      // Update history (keep last 20 data points)
      const now = new Date().toLocaleTimeString()
      setMetricsHistory((prev) => ({
        processed: [
          ...prev.processed.slice(-19),
          { time: now, value: metricsData.tasks?.processed || 0 },
        ],
        failed: [
          ...prev.failed.slice(-19),
          { time: now, value: metricsData.tasks?.failed || 0 },
        ],
        active: [
          ...prev.active.slice(-19),
          { time: now, value: metricsData.workers?.active || 0 },
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

  if (loading && workers.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Worker Monitoring</h2>
          <p className="text-sm text-muted-foreground">
            Real-time worker status and task completion metrics
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs text-muted-foreground">Live</span>
        </div>
      </div>

      {/* Summary Stats */}
      {metrics && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Workers</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.workers?.total || 0}</div>
              <p className="text-xs text-muted-foreground">
                {metrics.workers?.active || 0} active, {metrics.workers?.idle || 0} idle
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tasks Processed</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {(metrics.tasks?.processed || 0).toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                Across all worker types
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Failed Tasks</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {(metrics.tasks?.failed || 0).toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                {metrics.tasks?.processed > 0
                  ? `${((metrics.tasks?.failed / metrics.tasks?.processed) * 100).toFixed(2)}% failure rate`
                  : "No tasks processed"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Workers</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.workers?.active || 0}</div>
              <p className="text-xs text-muted-foreground">
                Currently processing tasks
              </p>
            </CardContent>
          </Card>
        </div>
      )}

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

      {/* Worker Status Cards */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Worker Status</h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {workers.map((worker) => (
            <WorkerStatusCard key={worker.worker_id} worker={worker} />
          ))}
          {workers.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Activity className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-sm font-medium mb-1">No workers available</p>
                <p className="text-xs text-muted-foreground">
                  Workers will appear here when they connect
                </p>
              </CardContent>
            </Card>
          )}
        </div>
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
