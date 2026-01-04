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
} from "lucide-react"
import { useAuth } from "@/components/auth-provider"

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
const KNOWN_SERVERS: Record<string, { url: string; requiresApiKey?: boolean }> = {
  "google maps grounding": { url: "https://mapstools.googleapis.com/mcp", requiresApiKey: true },
  "google maps": { url: "https://mapstools.googleapis.com/mcp", requiresApiKey: true },
  "maps": { url: "https://mapstools.googleapis.com/mcp", requiresApiKey: true },
  "brave search": { url: "https://api.search.brave.com/res/v1/web/search", requiresApiKey: true },
  "brave": { url: "https://api.search.brave.com/res/v1/web/search", requiresApiKey: true },
  "github": { url: "https://api.github.com", requiresApiKey: true },
  "playwright": { url: "http://localhost:8931/mcp", requiresApiKey: false },
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
  const [naturalLanguageInChat, setNaturalLanguageInChat] = React.useState(false)
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
      setUrl("") // URL not stored in current interface - would need to be added
      setApiKey(editingServer.apiKey || "")
      setNaturalLanguageInChat(editingServer.naturalLanguageInChat || false)
      if (editingServer.logoUrl) {
        setLogoPreview(editingServer.logoUrl)
      }
    } else {
      setName("")
      setUrl("")
      setApiKey("")
      setNaturalLanguageInChat(false)
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
    if (!url) {
      setTestResult({ success: false, message: "Please enter a server URL" })
      return
    }

    setTesting(true)
    setTestResult(null)

    try {
      const config: any = {
        transport: "http",
        url: url,
      }

      // Add API key to headers if provided
      if (apiKey) {
        const normalizedName = name.toLowerCase().trim()
        if (normalizedName.includes("google") || normalizedName.includes("maps")) {
          config.headers = { "X-Goog-Api-Key": apiKey }
        } else if (normalizedName.includes("brave")) {
          config.headers = { "X-Subscription-Token": apiKey, "Accept": "application/json" }
        } else if (normalizedName.includes("github")) {
          config.headers = { "Authorization": `Bearer ${apiKey}` }
        } else {
          config.headers = { "Authorization": `Bearer ${apiKey}` }
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
    if (editingServer) {
      // TODO: Implement API call to update server
      console.log("Updating server:", { id: editingServer.id, name, url, apiKey, naturalLanguageInChat, logoFile })
    } else {
      // TODO: Implement API call to add server
      console.log("Adding server:", { name, url, apiKey, naturalLanguageInChat, logoFile })
    }
    setOpen(false)
    setName("")
    setUrl("")
    setApiKey("")
    setNaturalLanguageInChat(false)
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
      setNaturalLanguageInChat(false)
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
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="url">Server URL</Label>
            <div className="flex gap-2">
              <Input
                id="url"
                type="url"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value)
                  setTestResult(null)
                }}
                placeholder="https://api.example.com/mcp"
                required
                className="flex-1"
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
            <Label htmlFor="apiKey">API Key (Optional)</Label>
            <Input
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your API key"
            />
            <p className="text-xs text-muted-foreground">
              API key for authenticating with the server
            </p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="naturalLanguageInChat"
                checked={naturalLanguageInChat}
                onChange={(e) => setNaturalLanguageInChat(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <Label htmlFor="naturalLanguageInChat" className="cursor-pointer">
                Enable natural language in chat
              </Label>
            </div>
            <p className="text-xs text-muted-foreground">
              Allow this server to be used for natural language processing in chat conversations
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="logo">Logo (Optional)</Label>
            <div className="flex items-center gap-4">
              {logoPreview && (
                <div className="relative h-16 w-16 rounded-lg overflow-hidden border border-border">
                  <img src={logoPreview} alt="Logo preview" className="h-full w-full object-contain" />
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
