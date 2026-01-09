"use client"

import * as React from "react"
import type { ServerStatus } from "@/components/mcp-server-sidebar"

interface Server {
  id: string
  name: string
  enabled: boolean
  logoUrl?: string
}

// Cache tools per server to avoid refetching on every health check
const toolsCache = new Map<string, { tools: Array<{ name: string; description?: string }>; timestamp: number }>()
const TOOLS_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

// Track in-flight requests to prevent duplicate health checks
const inFlightHealthChecks = new Set<string>()

export function useServerHealth(servers: Server[], enabled: boolean = true) {
  const [serverStatuses, setServerStatuses] = React.useState<ServerStatus[]>([])
  const lastCheckRef = React.useRef<number>(0)
  const debounceTimerRef = React.useRef<NodeJS.Timeout | null>(null)

  // Get server signature for stable comparison
  const serverSignature = React.useMemo(() => {
    return servers
      .filter((s) => s.enabled)
      .map((s) => `${s.id}:${s.name}`)
      .sort()
      .join("|")
  }, [servers])

  const checkServerHealth = React.useCallback(async (server: Server, skipTools: boolean = false) => {
    // Prevent duplicate concurrent health checks
    if (inFlightHealthChecks.has(server.id)) {
      return null
    }

    inFlightHealthChecks.add(server.id)

    try {
      const startTime = Date.now()
      const healthResponse = await fetch("/api/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "health",
          config: {
            id: server.id,
            name: server.name,
            transport: server.id === "playwright" ? "stdio" : "http",
          },
        }),
      })

      const responseTime = Date.now() - startTime

      let status: ServerStatus["status"] = "disconnected"
      if (healthResponse.ok) {
        const healthData = await healthResponse.json()
        status = healthData.status === "healthy" ? "connected" : "latency"
        if (responseTime > 1000) {
          status = "latency"
        }
      }

      // Get tools from cache or fetch if needed
      let tools: Array<{ name: string; description?: string }> = []
      if (!skipTools) {
        const cached = toolsCache.get(server.id)
        const now = Date.now()

        if (cached && now - cached.timestamp < TOOLS_CACHE_TTL) {
          // Use cached tools
          tools = cached.tools
        } else {
          // Fetch tools only if not cached or cache expired
          try {
            const toolsResponse = await fetch("/api/mcp", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "list_tools",
                config: {
                  id: server.id,
                  name: server.name,
                  transport: server.id === "playwright" ? "stdio" : "http",
                },
              }),
            })

            if (toolsResponse.ok) {
              const toolsData = await toolsResponse.json()
              tools = (toolsData.tools || []).map((t: any) => ({
                name: t.name,
                description: t.description,
              }))
              // Update cache
              toolsCache.set(server.id, { tools, timestamp: now })
            }
          } catch (error) {
            // Use cached tools if available, even if expired
            if (cached) {
              tools = cached.tools
            }
            // Silently fail tool fetching - not critical for health check
            console.warn(`Failed to fetch tools for ${server.name}:`, error)
          }
        }
      }

      return {
        id: server.id,
        name: server.name,
        status,
        tools,
        logoUrl: server.logoUrl,
        lastResponseTime: responseTime,
      }
    } catch (error) {
      console.error(`Error checking health for ${server.name}:`, error)
      // Return cached status if available
      const cached = toolsCache.get(server.id)
      return {
        id: server.id,
        name: server.name,
        status: "disconnected" as const,
        tools: cached?.tools || [],
        logoUrl: server.logoUrl,
      }
    } finally {
      inFlightHealthChecks.delete(server.id)
    }
  }, [])

  const updateServerStatuses = React.useCallback(async (skipTools: boolean = false) => {
    if (!enabled) return

    const enabledServers = servers.filter((s) => s.enabled)
    if (enabledServers.length === 0) {
      setServerStatuses([])
      return
    }

    // Prevent too frequent checks (minimum 10 seconds between checks)
    const now = Date.now()
    if (now - lastCheckRef.current < 10000 && !skipTools) {
      return
    }
    lastCheckRef.current = now

    const statuses = await Promise.all(
      enabledServers.map((server) => checkServerHealth(server, skipTools))
    )

    // Filter out null results (duplicate checks)
    const validStatuses = statuses.filter((s): s is ServerStatus => s !== null)
    setServerStatuses(validStatuses)
  }, [servers, enabled, checkServerHealth])

  // Debounced initial health check when servers change
  React.useEffect(() => {
    if (!enabled || serverSignature === "") return

    // Clear existing debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    // Debounce health checks by 2 seconds
    debounceTimerRef.current = setTimeout(() => {
      updateServerStatuses(false) // Fetch tools on initial load
    }, 2000)

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [serverSignature, enabled, updateServerStatuses])

  // Periodic health check (every 60 seconds, tools only every 5 minutes)
  React.useEffect(() => {
    if (!enabled || serverSignature === "") return

    let toolsCheckCount = 0
    const interval = setInterval(() => {
      toolsCheckCount++
      // Only fetch tools every 5th check (every 5 minutes)
      const shouldFetchTools = toolsCheckCount % 5 === 0
      updateServerStatuses(!shouldFetchTools)
    }, 60000) // 60 seconds

    return () => clearInterval(interval)
  }, [serverSignature, enabled, updateServerStatuses])

  return {
    serverStatuses,
    refreshHealth: () => updateServerStatuses(false),
  }
}
