"use client"

import * as React from "react"
import Image from "next/image"
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
  RefreshCw,
  Server,
  Plus,
  Upload,
  X,
  Power,
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
}

export default function RegistryPage() {
  const { user } = useAuth()
  const [servers, setServers] = React.useState<{ system: McpServer[]; user: McpServer[] }>({
    system: [],
    user: [],
  })
  const [loading, setLoading] = React.useState(true)
  const [lastRefresh, setLastRefresh] = React.useState<Date>(new Date())

  const fetchServers = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/servers")
      const data = await res.json()
      setServers(data)
      setLastRefresh(new Date())
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Registry</h1>
          <p className="text-sm text-muted-foreground">MCP server management and system indicators</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Last updated</p>
            <p className="text-sm font-mono">{lastRefresh.toLocaleTimeString()}</p>
          </div>
          <Button onClick={fetchServers} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* MCP Servers */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">MCP Servers</h2>
            <p className="text-sm text-muted-foreground">Manage your Model Context Protocol servers</p>
          </div>
          <AddServerDialog onAdd={() => fetchServers()} />
        </div>

        {/* System Servers */}
        {servers.system.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-4">System Servers</h3>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {servers.system.map((server) => (
                <ServerCard
                  key={server.id}
                  server={server}
                  onToggle={toggleServer}
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
  logoUrl,
  isUserServer = false,
}: {
  server: McpServer
  onToggle: (id: string, type: "system" | "user", enabled: boolean) => void
  logoUrl: string
  isUserServer?: boolean
}) {
  const [logoError, setLogoError] = React.useState(false)

  // Determine logo-specific styling
  const isGoogleMaps = server.id === "maps"
  const isGitHub = server.id === "github"
  
  const logoClassName = isGoogleMaps
    ? "object-contain scale-75" // Make Google Maps logo smaller
    : isGitHub
    ? "object-contain dark:brightness-0 dark:invert" // Make GitHub logo visible in dark mode
    : "object-contain"

  return (
    <Card className={`relative overflow-hidden ${server.enabled ? "" : "opacity-60"}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between mb-2">
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
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => onToggle(server.id, server.type, server.enabled)}
            title={server.enabled ? "Disable" : "Enable"}
          >
            <Power className={`h-4 w-4 ${server.enabled ? "text-accent" : "text-muted-foreground"}`} />
          </Button>
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

function AddServerDialog({ onAdd }: { onAdd: () => void }) {
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState("")
  const [url, setUrl] = React.useState("")
  const [logoFile, setLogoFile] = React.useState<File | null>(null)
  const [logoPreview, setLogoPreview] = React.useState<string | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const handleLogoSelect = (file: File) => {
    if (file.type.startsWith("image/")) {
      setLogoFile(file)
      const url = URL.createObjectURL(file)
      setLogoPreview(url)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // TODO: Implement API call to add server
    console.log("Adding server:", { name, url, logoFile })
    setOpen(false)
    setName("")
    setUrl("")
    setLogoFile(null)
    if (logoPreview) {
      URL.revokeObjectURL(logoPreview)
      setLogoPreview(null)
    }
    onAdd()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Add Server
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add MCP Server</DialogTitle>
          <DialogDescription>Configure a new MCP server for your workflows</DialogDescription>
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
            <Input
              id="url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://api.example.com/mcp"
              required
            />
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
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Add Server</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
