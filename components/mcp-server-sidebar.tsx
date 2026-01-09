"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ChevronRight, ChevronLeft, Server, Activity, Zap } from "lucide-react"
import Image from "next/image"
import { cn } from "@/lib/utils"

export interface ServerStatus {
  id: string
  name: string
  status: "connected" | "latency" | "executing" | "disconnected"
  tools?: Array<{ name: string; description?: string }>
  requestCount?: number
  lastResponseTime?: number
  logoUrl?: string
}

interface McpServerSidebarProps {
  servers: ServerStatus[]
  isOpen: boolean
  onToggle: () => void
  className?: string
}

export function McpServerSidebar({
  servers,
  isOpen,
  onToggle,
  className,
}: McpServerSidebarProps) {
  const [expandedServers, setExpandedServers] = React.useState<Set<string>>(new Set())

  const toggleServer = (serverId: string) => {
    setExpandedServers((prev) => {
      const next = new Set(prev)
      if (next.has(serverId)) {
        next.delete(serverId)
      } else {
        next.add(serverId)
      }
      return next
    })
  }

  const getStatusColor = (status: ServerStatus["status"]) => {
    switch (status) {
      case "connected":
        return "bg-green-500"
      case "latency":
      case "executing":
        return "bg-yellow-500"
      case "disconnected":
        return "bg-red-500"
      default:
        return "bg-gray-500"
    }
  }

  const getStatusLabel = (status: ServerStatus["status"]) => {
    switch (status) {
      case "connected":
        return "Connected"
      case "latency":
        return "Latency"
      case "executing":
        return "Executing"
      case "disconnected":
        return "Disconnected"
      default:
        return "Unknown"
    }
  }

  return (
    <>
      {/* Desktop Sidebar */}
      <div
        className={cn(
          "hidden lg:flex flex-col border-l border-border bg-card/50 backdrop-blur-sm transition-all duration-300 ease-in-out",
          isOpen ? "w-80" : "w-0 overflow-hidden",
          className
        )}
      >
        {isOpen && (
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Server className="h-5 w-5 text-muted-foreground" />
                <h2 className="font-semibold text-sm">Active Servers</h2>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onToggle}
                className="h-6 w-6"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {servers.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  <Server className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No active servers</p>
                </div>
              ) : (
                servers.map((server) => {
                  const isExpanded = expandedServers.has(server.id)
                  return (
                    <Card key={server.id} className="overflow-hidden">
                      <CardHeader
                        className="pb-2 cursor-pointer"
                        onClick={() => toggleServer(server.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <div className="relative">
                              {server.logoUrl ? (
                                <Image
                                  src={server.logoUrl}
                                  alt={server.name}
                                  width={24}
                                  height={24}
                                  className="h-6 w-6 object-contain rounded"
                                />
                              ) : (
                                <div className="h-6 w-6 rounded bg-muted flex items-center justify-center">
                                  <Server className="h-3 w-3 text-muted-foreground" />
                                </div>
                              )}
                              <div
                                className={cn(
                                  "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card animate-pulse",
                                  getStatusColor(server.status)
                                )}
                                title={getStatusLabel(server.status)}
                              />
                            </div>
                            <CardTitle className="text-sm truncate flex-1">
                              {server.name}
                            </CardTitle>
                          </div>
                          <ChevronRight
                            className={cn(
                              "h-4 w-4 text-muted-foreground transition-transform",
                              isExpanded && "rotate-90"
                            )}
                          />
                        </div>
                      </CardHeader>

                      {isExpanded && (
                        <CardContent className="pt-0 space-y-3">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Status:</span>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-xs",
                                server.status === "connected" && "border-green-500 text-green-600",
                                (server.status === "latency" || server.status === "executing") &&
                                  "border-yellow-500 text-yellow-600",
                                server.status === "disconnected" &&
                                  "border-red-500 text-red-600"
                              )}
                            >
                              {getStatusLabel(server.status)}
                            </Badge>
                          </div>

                          {server.lastResponseTime !== undefined && (
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">Response:</span>
                              <span className="font-mono">
                                {server.lastResponseTime}ms
                              </span>
                            </div>
                          )}

                          {server.requestCount !== undefined && (
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">Requests:</span>
                              <span className="font-mono">{server.requestCount}</span>
                            </div>
                          )}

                          {server.tools && server.tools.length > 0 && (
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Zap className="h-3 w-3" />
                                <span>Tools ({server.tools.length})</span>
                              </div>
                              <div className="space-y-1 max-h-32 overflow-y-auto">
                                {server.tools.slice(0, 5).map((tool) => (
                                  <div
                                    key={tool.name}
                                    className="text-xs px-2 py-1 rounded bg-muted/50 truncate"
                                    title={tool.description || tool.name}
                                  >
                                    {tool.name}
                                  </div>
                                ))}
                                {server.tools.length > 5 && (
                                  <div className="text-xs text-muted-foreground px-2">
                                    +{server.tools.length - 5} more
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      )}
                    </Card>
                  )
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Mobile Bottom Sheet Backdrop */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40 transition-opacity"
          onClick={onToggle}
        />
      )}

      {/* Mobile Bottom Sheet */}
      <div
        className={cn(
          "lg:hidden fixed inset-x-0 bottom-0 bg-card border-t border-border rounded-t-2xl shadow-2xl transition-transform duration-300 ease-out z-50",
          isOpen ? "translate-y-0" : "translate-y-full",
          className
        )}
        style={{ maxHeight: "70vh" }}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-2">
              <Server className="h-5 w-5 text-muted-foreground" />
              <h2 className="font-semibold text-sm">Active Servers</h2>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onToggle}
              className="h-6 w-6"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {servers.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                <Server className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No active servers</p>
              </div>
            ) : (
              servers.map((server) => {
                const isExpanded = expandedServers.has(server.id)
                return (
                  <Card key={server.id} className="overflow-hidden">
                    <CardHeader
                      className="pb-2 cursor-pointer"
                      onClick={() => toggleServer(server.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div className="relative">
                            {server.logoUrl ? (
                              <Image
                                src={server.logoUrl}
                                alt={server.name}
                                width={24}
                                height={24}
                                className="h-6 w-6 object-contain rounded"
                              />
                            ) : (
                              <div className="h-6 w-6 rounded bg-muted flex items-center justify-center">
                                <Server className="h-3 w-3 text-muted-foreground" />
                              </div>
                            )}
                            <div
                              className={cn(
                                "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card animate-pulse",
                                getStatusColor(server.status)
                              )}
                              title={getStatusLabel(server.status)}
                            />
                          </div>
                          <CardTitle className="text-sm truncate flex-1">
                            {server.name}
                          </CardTitle>
                        </div>
                        <ChevronRight
                          className={cn(
                            "h-4 w-4 text-muted-foreground transition-transform",
                            isExpanded && "rotate-90"
                          )}
                        />
                      </div>
                    </CardHeader>

                    {isExpanded && (
                      <CardContent className="pt-0 space-y-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Status:</span>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-xs",
                              server.status === "connected" && "border-green-500 text-green-600",
                              (server.status === "latency" || server.status === "executing") &&
                                "border-yellow-500 text-yellow-600",
                              server.status === "disconnected" &&
                                "border-red-500 text-red-600"
                            )}
                          >
                            {getStatusLabel(server.status)}
                          </Badge>
                        </div>

                        {server.lastResponseTime !== undefined && (
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Response:</span>
                            <span className="font-mono">
                              {server.lastResponseTime}ms
                            </span>
                          </div>
                        )}

                        {server.requestCount !== undefined && (
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Requests:</span>
                            <span className="font-mono">{server.requestCount}</span>
                          </div>
                        )}

                        {server.tools && server.tools.length > 0 && (
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Zap className="h-3 w-3" />
                              <span>Tools ({server.tools.length})</span>
                            </div>
                            <div className="space-y-1 max-h-32 overflow-y-auto">
                              {server.tools.slice(0, 5).map((tool) => (
                                <div
                                  key={tool.name}
                                  className="text-xs px-2 py-1 rounded bg-muted/50 truncate"
                                  title={tool.description || tool.name}
                                >
                                  {tool.name}
                                </div>
                              ))}
                              {server.tools.length > 5 && (
                                <div className="text-xs text-muted-foreground px-2">
                                  +{server.tools.length - 5} more
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    )}
                  </Card>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* Toggle Button - Desktop */}
      {!isOpen && (
        <Button
          variant="outline"
          size="icon"
          onClick={onToggle}
          className="hidden lg:flex fixed right-4 top-1/2 -translate-y-1/2 z-40 h-10 w-10 rounded-full shadow-lg"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      )}

      {/* Toggle Button - Mobile (FAB) */}
      {!isOpen && (
        <Button
          variant="default"
          size="icon"
          onClick={onToggle}
          className="lg:hidden fixed bottom-20 right-4 z-40 h-14 w-14 rounded-full shadow-lg"
        >
          <Activity className="h-5 w-5" />
        </Button>
      )}
    </>
  )
}
