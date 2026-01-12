"use client"

import * as React from "react"
import Image from "next/image"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useAuth } from "@/components/auth-provider"
import { Send, Image as ImageIcon, X, Loader2, Mic, ChevronDown, Camera, Brain } from "lucide-react"
import { HoverIconButton } from "@/components/ui/hover-icon-button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { McpServerSidebar, type ServerStatus } from "@/components/mcp-server-sidebar"
import { ToolExecutionStatus, type ToolExecution } from "@/components/tool-execution-status"
import { CameraCapture } from "@/components/camera-capture"
import { useServerHealth } from "@/lib/use-server-health"

// TypeScript declarations for Web Speech API
interface SpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  abort(): void
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null
  onend: ((this: SpeechRecognition, ev: Event) => any) | null
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
  resultIndex: number
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string
  message: string
}

interface SpeechRecognitionResultList {
  length: number
  item(index: number): SpeechRecognitionResult
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionResult {
  length: number
  item(index: number): SpeechRecognitionAlternative
  [index: number]: SpeechRecognitionAlternative
  isFinal: boolean
}

interface SpeechRecognitionAlternative {
  transcript: string
  confidence: number
}

interface Message {
  id: string
  role: "user" | "assistant" | "tool"
  content: string
  imageUrl?: string
  timestamp: Date
  toolCalls?: any[]
  toolResults?: any[]
  toolCallId?: string
}

interface Server {
  id: string
  name: string
  type: "system" | "user"
  enabled: boolean
  logoUrl?: string
  description?: string
}

interface Tool {
  name: string
  description?: string
  serverId: string
  serverName: string
  serverLogoUrl?: string
}

// Client-side only timestamp component to avoid hydration errors
function MessageTimestamp({ timestamp }: { timestamp: Date }) {
  const [formattedTime, setFormattedTime] = React.useState<string>("")

  React.useEffect(() => {
    // Format timestamp only on client side
    setFormattedTime(timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }))
  }, [timestamp])

  return <p className="mt-1.5 text-xs opacity-70">{formattedTime || ""}</p>
}

// Helper function to generate UUID - works in both browser and Node.js
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  // Fallback UUID v4 generator
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export default function WorkflowsPage() {
  const { user } = useAuth()
  const [googleUser, setGoogleUser] = React.useState<{ email?: string, name?: string, picture?: string } | null>(null)

  // Use Google user if available, otherwise fall back to regular user
  const displayUser = googleUser ? {
    name: googleUser.name || googleUser.email || 'Google User',
    email: googleUser.email || '',
    avatar_url: googleUser.picture || ''
  } : user

  const avatarImageClassName = displayUser?.avatar_url ? undefined : "dark:invert"
  const [messages, setMessages] = React.useState<Message[]>([])
  const [input, setInput] = React.useState("")
  const [isLoading, setIsLoading] = React.useState(false)
  const [uploadedImage, setUploadedImage] = React.useState<File | null>(null)
  const [imagePreview, setImagePreview] = React.useState<string | null>(null)
  const [isDragging, setIsDragging] = React.useState(false)
  const [isRecording, setIsRecording] = React.useState(false)
  const [isSpeechSupported, setIsSpeechSupported] = React.useState(false)
  const [chatProvider, setChatProvider] = React.useState<"openai" | "anthropic" | "google">("openai")
  const [servers, setServers] = React.useState<Server[]>([])
  const [allTools, setAllTools] = React.useState<Tool[]>([])
  const [toolsRefreshTrigger, setToolsRefreshTrigger] = React.useState(0)
  const lastToolsRefreshRef = React.useRef(toolsRefreshTrigger)
  const allToolsLengthRef = React.useRef(0)
  const [showAutocomplete, setShowAutocomplete] = React.useState(false)
  const [autocompleteType, setAutocompleteType] = React.useState<"servers" | "tools">("servers")
  const [autocompleteQuery, setAutocompleteQuery] = React.useState("")
  const [selectedAutocompleteIndex, setSelectedAutocompleteIndex] = React.useState(0)
  const [isLoadingTools, setIsLoadingTools] = React.useState(false)
  const [commandHistory, setCommandHistory] = React.useState<string[]>([])
  const [historyIndex, setHistoryIndex] = React.useState(-1)
  const [sidebarOpen, setSidebarOpen] = React.useState(false)
  const [showCamera, setShowCamera] = React.useState(false)
  const [toolExecutions, setToolExecutions] = React.useState<ToolExecution[]>([])
  const [hasInitialLoad, setHasInitialLoad] = React.useState(false)

  // Use server health hook - only check when sidebar is open or on initial load
  const { serverStatuses, refreshHealth } = useServerHealth(servers, sidebarOpen || !hasInitialLoad)

  // Mark initial load as complete after first status check
  React.useEffect(() => {
    if (serverStatuses.length > 0 && !hasInitialLoad) {
      setHasInitialLoad(true)
    }
  }, [serverStatuses.length, hasInitialLoad])

  // Listen for OAuth success messages to store Google user profile
  React.useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'oauth_success' && event.data?.service === 'google-workspace') {
        const { user: googleUser } = event.data
        if (googleUser) {
          localStorage.setItem('google_workspace_user', JSON.stringify(googleUser))
          console.log('📧 Stored Google user profile:', googleUser.email)
          // Trigger a re-render by updating a state (optional, but helps refresh the UI)
          window.dispatchEvent(new Event('storage'))
        }
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  // Load Google user from localStorage on mount
  React.useEffect(() => {
    const loadGoogleUser = () => {
      const storedUser = localStorage.getItem('google_workspace_user')
      if (storedUser) {
        try {
          setGoogleUser(JSON.parse(storedUser))
        } catch (e) {
          console.error('Failed to parse Google user:', e)
        }
      }
    }

    loadGoogleUser()
    window.addEventListener('storage', loadGoogleUser)
    return () => window.removeEventListener('storage', loadGoogleUser)
  }, [])

  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const messagesEndRef = React.useRef<HTMLDivElement>(null)
  const scrollContainerRef = React.useRef<HTMLDivElement>(null)
  const recognitionRef = React.useRef<SpeechRecognition | null>(null)
  const autocompleteRef = React.useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: "smooth"
      })
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }

  React.useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Update input when navigating command history
  React.useEffect(() => {
    if (historyIndex === -1) {
      // At the bottom - clear input or restore original
      setInput("")
    } else if (historyIndex >= 0 && historyIndex < commandHistory.length) {
      // Navigate to specific history entry
      setInput(commandHistory[historyIndex])
    }
  }, [historyIndex, commandHistory])

  // Fetch servers function
  const fetchServers = React.useCallback(async () => {
    try {
      const response = await fetch("/api/servers")
      const data = await response.json()

      // Load user servers from localStorage (same as monitoring page)
      const storedUserServers = localStorage.getItem("user_servers")
      const userServers = storedUserServers ? JSON.parse(storedUserServers) : []

      // Merge user servers with their configs
      const enrichedUserServers = (userServers || []).map((s: any) => ({
        ...s,
        // Include config if available
        config: s.config || {},
        // Include API key if available
        apiKey: s.apiKey || s.config?.apiKey,
      }))

      const allServers: Server[] = [
        ...(data.system || []).filter((s: Server) => s.enabled),
        ...enrichedUserServers.filter((s: Server) => s.enabled),
      ]
      setServers(allServers)

      // Health check will be handled by the useServerHealth hook
    } catch (error) {
      console.error("Error fetching servers:", error)
    }
  }, [])

  // Load servers on mount and listen for updates
  React.useEffect(() => {
    fetchServers()

    // Listen for storage events to update when servers are added/removed in other tabs
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "user_servers") {
        fetchServers()
      }
    }

    // Also listen for custom event for same-tab updates
    const handleCustomStorage = () => {
      fetchServers()
    }

    window.addEventListener("storage", handleStorageChange)
    window.addEventListener("userServersUpdated", handleCustomStorage)

    return () => {
      window.removeEventListener("storage", handleStorageChange)
      window.removeEventListener("userServersUpdated", handleCustomStorage)
    }
  }, [fetchServers])

  // Listen for OAuth success from popups (for chat authentication)
  React.useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'oauth_success') {
        console.log('[Workflows] OAuth success received from popup:', event.data);

        // Store relayed tokens for stateless retry/persistence
        if (event.data.tokens) {
          localStorage.setItem('google_workspace_access_token', event.data.tokens.access_token);
          if (event.data.tokens.refresh_token) {
            localStorage.setItem('google_workspace_refresh_token', event.data.tokens.refresh_token);
          }
        }

        if (event.data.session_id) {
          console.log(`[Workflows] 🔑 Received OAuth Session ID: ${event.data.session_id}`);
          localStorage.setItem('google_workspace_session_id', event.data.session_id);
          // Verify storage
          const stored = localStorage.getItem('google_workspace_session_id');
          console.log(`[Workflows] ✅ Verified Storage Session ID: ${stored}`);
        } else {
          console.warn(`[Workflows] ⚠️ Received oauth_success but NO session_id in data!`, event.data);
        }

        // Refresh server list and health
        fetchServers();
        if (refreshHealth) refreshHealth();
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [fetchServers, refreshHealth]);

  const serverSignature = React.useMemo(() => {
    if (servers.length === 0) return ""
    return servers
      .map((server) => `${server.id}:${server.enabled}`)
      .sort()
      .join("|")
  }, [servers])

  React.useEffect(() => {
    if (!serverSignature) return
    allToolsLengthRef.current = 0
    setAllTools([])
    setToolsRefreshTrigger((prev) => prev + 1)
  }, [serverSignature])

  // Fetch all tools from all servers
  const fetchAllTools = React.useCallback(async () => {
    if (servers.length === 0) return
    if (allToolsLengthRef.current > 0 && toolsRefreshTrigger === lastToolsRefreshRef.current) return

    setIsLoadingTools(true)
    try {
      const tools: Tool[] = []

      // Load API keys from localStorage once
      const apiKeys: Record<string, string> = {}
      if (typeof window !== "undefined") {
        apiKeys.maps = localStorage.getItem("google_maps_api_key") || ""
        apiKeys.github = localStorage.getItem("github_personal_access_token") || ""
        apiKeys.exa = localStorage.getItem("exa_api_key") || ""
        apiKeys.notion = localStorage.getItem("notion_api_key") || ""
        apiKeys.googleOAuthClientId = localStorage.getItem("google_oauth_client_id") || ""
        apiKeys.googleOAuthClientSecret = localStorage.getItem("google_oauth_client_secret") || ""
      }

      // Fetch tools from each server
      for (const server of servers) {
        try {
          const serverId = server.id.toLowerCase()
          const config: any = {
            id: server.id,
            name: server.name,
            headers: {},
          }

          // Configure transport and server-specific settings
          if (serverId === "playwright") {
            config.transport = "stdio"
            config.command = "npx"
            config.args = ["@playwright/mcp@latest", "--headless"]
          } else if (serverId === "github" || serverId.includes("github")) {
            config.transport = "stdio"
            config.command = "npx"
            config.args = ["-y", "@modelcontextprotocol/server-github"]
            if (apiKeys.github) {
              config.env = {
                GITHUB_PERSONAL_ACCESS_TOKEN: apiKeys.github.trim(),
              }
            }
          } else if (serverId === "notion" || serverId.includes("notion")) {
            config.transport = "stdio"
            config.command = "npx"
            config.args = ["-y", "@notionhq/notion-mcp-server"]
            if (apiKeys.notion) {
              config.env = {
                NOTION_API_KEY: apiKeys.notion.trim(),
              }
            }

          } else if (serverId === "maps" || serverId.includes("maps") || serverId.includes("google-maps")) {
            config.transport = "http"
            config.url = "https://mapstools.googleapis.com/mcp"
            if (apiKeys.maps) {
              config.headers["X-Goog-Api-Key"] = apiKeys.maps.trim()
            }
          } else if (serverId === "exa" || serverId.includes("exa")) {
            config.transport = "http"
            config.url = "https://mcp.exa.ai/mcp"
            if (apiKeys.exa) {
              config.headers["x-api-key"] = apiKeys.exa.trim()
              config.headers["Accept"] = "application/json"
            }
          } else if (serverId === "langchain" || serverId.includes("langchain")) {
            config.transport = "http"
            config.url = "https://langchain-agent-mcp-server-554655392699.us-central1.run.app"
          } else {
            // Default to HTTP transport for unknown servers
            config.transport = "http"
            // Try to get URL from server config if available
            const serverConfig = (server as any).config || {}
            if (serverConfig.url) {
              config.url = serverConfig.url
            }
            // Include API key if available in server config
            if (serverConfig.apiKey) {
              config.headers["Authorization"] = `Bearer ${serverConfig.apiKey}`
            } else if ((server as any).apiKey) {
              config.headers["Authorization"] = `Bearer ${(server as any).apiKey}`
            }
          }

          const response = await fetch("/api/mcp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "list_tools",
              config,
            }),
          })

          if (response.ok) {
            const data = await response.json()
            if (data.tools && Array.isArray(data.tools)) {
              for (const tool of data.tools) {
                tools.push({
                  name: tool.name,
                  description: tool.description,
                  serverId: server.id,
                  serverName: server.name,
                  serverLogoUrl: server.logoUrl,
                })
              }
            }
          } else {
            // Log error but continue with other servers
            const errorData = await response.json().catch(() => ({}))
            console.warn(`Failed to fetch tools from ${server.name}:`, errorData.error || response.statusText)
          }
        } catch (error) {
          // Silently fail for individual servers - we'll show tools that loaded successfully
          console.error(`Error fetching tools from ${server.name}:`, error)
        }
      }

      setAllTools(tools)
      allToolsLengthRef.current = tools.length
      lastToolsRefreshRef.current = toolsRefreshTrigger
      console.log(`[Workflows] Loaded ${tools.length} tools from ${servers.length} servers`)
    } catch (error) {
      console.error("Error fetching tools:", error)
    } finally {
      setIsLoadingTools(false)
    }
  }, [servers, toolsRefreshTrigger])

  React.useEffect(() => {
    fetchAllTools()
  }, [fetchAllTools, toolsRefreshTrigger])

  // Close autocomplete when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        autocompleteRef.current &&
        !autocompleteRef.current.contains(event.target as Node) &&
        textareaRef.current &&
        !textareaRef.current.contains(event.target as Node)
      ) {
        setShowAutocomplete(false)
      }
    }

    if (showAutocomplete) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => {
        document.removeEventListener("mousedown", handleClickOutside)
      }
    }
  }, [showAutocomplete])

  // Load provider preference from localStorage
  React.useEffect(() => {
    const savedProvider = localStorage.getItem("chatProvider") as "openai" | "anthropic" | "google" | null
    if (savedProvider && ["openai", "anthropic", "google"].includes(savedProvider)) {
      setChatProvider(savedProvider)
    }
  }, [])

  // Save provider preference to localStorage
  React.useEffect(() => {
    localStorage.setItem("chatProvider", chatProvider)
  }, [chatProvider])

  React.useEffect(() => {
    return () => {
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview)
      }
    }
  }, [imagePreview])

  // Initialize speech recognition
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

      if (SpeechRecognition) {
        setIsSpeechSupported(true)
        const recognition = new SpeechRecognition()
        recognition.continuous = false
        recognition.interimResults = false
        recognition.lang = "en-US"

        recognition.onstart = () => {
          setIsRecording(true)
        }

        recognition.onresult = (event: SpeechRecognitionEvent) => {
          const transcript = Array.from(event.results)
            .map((result) => result[0].transcript)
            .join("")
          setInput((prev) => (prev ? `${prev} ${transcript}` : transcript))
        }

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
          console.error("Speech recognition error:", event.error)
          setIsRecording(false)
          if (event.error === "not-allowed") {
            alert("Microphone permission denied. Please enable microphone access.")
          }
        }

        recognition.onend = () => {
          setIsRecording(false)
        }

        recognitionRef.current = recognition
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
    }
  }, [])

  const handleImageSelect = (file: File) => {
    if (file.type.startsWith("image/")) {
      setUploadedImage(file)
      const url = URL.createObjectURL(file)
      setImagePreview(url)
    }
  }

  const handleCameraCapture = (file: File) => {
    handleImageSelect(file)
    setShowCamera(false)
  }

  const handlePermissionGrant = (executionId: string, granted: boolean) => {
    setToolExecutions((prev) =>
      prev.map((exec) =>
        exec.id === executionId
          ? {
            ...exec,
            status: granted ? "running" : "failed",
            error: granted ? undefined : "Permission denied by user",
            requiresPermission: false,
          }
          : exec
      )
    )
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        const file = items[i].getAsFile()
        if (file) {
          handleImageSelect(file)
        }
      }
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) {
      handleImageSelect(file)
    }
  }

  const handleRemoveImage = () => {
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview)
    }
    setUploadedImage(null)
    setImagePreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  // Parse API keys from natural language input
  const parseApiKeyFromText = (text: string): { provider: string; key: string } | null => {
    // OpenAI keys can start with sk-, sk-proj-, or sk-org- and contain alphanumeric, dashes, and underscores
    // Minimum 20 characters total
    const openaiPatterns = [
      /(?:my\s+)?(?:openai|open\s+ai)\s+(?:api\s+)?key\s+(?:is\s+)?(?:[:=]?\s*)?(sk-(?:proj-|org-)?[a-zA-Z0-9\-_]{20,})/i,
      /set\s+(?:my\s+)?(?:openai|open\s+ai)\s+(?:api\s+)?key\s+(?:to\s+)?(?:[:=]?\s*)?(sk-(?:proj-|org-)?[a-zA-Z0-9\-_]{20,})/i,
      /(?:openai|open\s+ai)\s+(?:api\s+)?key\s*[:=]\s*(sk-(?:proj-|org-)?[a-zA-Z0-9\-_]{20,})/i,
      /(sk-(?:proj-|org-)?[a-zA-Z0-9\-_]{20,})\s+(?:is\s+)?(?:my\s+)?(?:openai|open\s+ai)\s+(?:api\s+)?key/i,
    ]

    const anthropicPatterns = [
      /(?:my\s+)?(?:anthropic|claude)\s+(?:api\s+)?key\s+(?:is\s+)?(?:[:=]?\s*)?(sk-ant-[a-zA-Z0-9-]{20,})/i,
      /set\s+(?:my\s+)?(?:anthropic|claude)\s+(?:api\s+)?key\s+(?:to\s+)?(?:[:=]?\s*)?(sk-ant-[a-zA-Z0-9-]{20,})/i,
      /(?:anthropic|claude)\s+(?:api\s+)?key\s*[:=]\s*(sk-ant-[a-zA-Z0-9-]{20,})/i,
      /(sk-ant-[a-zA-Z0-9-]{20,})\s+(?:is\s+)?(?:my\s+)?(?:anthropic|claude)\s+(?:api\s+)?key/i,
    ]

    const geminiPatterns = [
      /(?:my\s+)?(?:gemini|google)\s+(?:api\s+)?key\s+(?:is\s+)?(?:[:=]?\s*)?(AIza[Sy][a-zA-Z0-9_-]{35})/i,
      /set\s+(?:my\s+)?(?:gemini|google)\s+(?:api\s+)?key\s+(?:to\s+)?(?:[:=]?\s*)?(AIza[Sy][a-zA-Z0-9_-]{35})/i,
      /(?:gemini|google)\s+(?:api\s+)?key\s*[:=]\s*(AIza[Sy][a-zA-Z0-9_-]{35})/i,
      /(AIza[Sy][a-zA-Z0-9_-]{35})\s+(?:is\s+)?(?:my\s+)?(?:gemini|google)\s+(?:api\s+)?key/i,
    ]

    for (const pattern of anthropicPatterns) {
      const match = text.match(pattern)
      if (match && match[1]) {
        return { provider: "anthropic", key: match[1].trim() }
      }
    }

    for (const pattern of geminiPatterns) {
      const match = text.match(pattern)
      if (match && match[1]) {
        return { provider: "gemini", key: match[1].trim() }
      }
    }

    for (const pattern of openaiPatterns) {
      const match = text.match(pattern)
      if (match && match[1]) {
        return { provider: "openai", key: match[1].trim() }
      }
    }

    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() && !uploadedImage) return

    const userInput = input.trim()

    // Check if user is trying to set an API key via natural language
    const apiKeyMatch = parseApiKeyFromText(userInput)
    if (apiKeyMatch) {
      const storageKey = apiKeyMatch.provider === "openai" ? "openai_api_key"
        : apiKeyMatch.provider === "anthropic" ? "anthropic_api_key"
          : "gemini_api_key"

      localStorage.setItem(storageKey, apiKeyMatch.key)

      const userMessage: Message = {
        id: generateUUID(),
        role: "user",
        content: userInput,
        timestamp: new Date(),
      }

      const confirmationMessage: Message = {
        id: generateUUID(),
        role: "assistant",
        content: `✅ ${apiKeyMatch.provider === "openai" ? "OpenAI" : apiKeyMatch.provider === "anthropic" ? "Anthropic (Claude)" : "Google Gemini"} API key saved successfully!`,
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, userMessage, confirmationMessage])
      setInput("")
      return
    }

    const userMessage: Message = {
      id: generateUUID(),
      role: "user",
      content: userInput,
      imageUrl: imagePreview || undefined,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])

    // Add to command history (excluding API key inputs)
    if (userInput.trim()) {
      setCommandHistory((prev) => {
        // Don't add duplicates if the last command is the same
        if (prev.length > 0 && prev[prev.length - 1] === userInput) {
          return prev
        }
        // Keep last 50 commands
        const newHistory = [...prev, userInput]
        return newHistory.slice(-50)
      })
    }

    setInput("")
    setHistoryIndex(-1) // Reset history index after submitting
    setIsLoading(true)

    // Convert image to base64 if needed
    let imageBase64: string | null = null
    if (uploadedImage) {
      try {
        imageBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => {
            const result = reader.result as string
            resolve(result)
          }
          reader.onerror = reject
          reader.readAsDataURL(uploadedImage)
        })
      } catch (error) {
        console.error("Failed to convert image to base64:", error)
      }
    }

    handleRemoveImage()

    // Track tool executions
    const executionIds: string[] = []

    try {
      // Get API key from localStorage based on provider
      let userApiKey: string | null = null
      if (typeof window !== "undefined") {
        if (chatProvider === "openai") {
          const rawKey = localStorage.getItem("openai_api_key")
          userApiKey = rawKey ? rawKey.trim() : null
          if (userApiKey) {
            console.log(`[Workflows] Retrieved OpenAI key from localStorage (length: ${userApiKey.length}, starts with: ${userApiKey.substring(0, Math.min(10, userApiKey.length))}...)`)
          }
        } else if (chatProvider === "anthropic") {
          userApiKey = localStorage.getItem("anthropic_api_key")?.trim() || null
        } else if (chatProvider === "google") {
          userApiKey = localStorage.getItem("gemini_api_key")?.trim() || null
        }
      }
      let mapsApiKey: string | null = null
      let mapsProjectId: string | null = null
      let notionApiKey: string | null = null
      let githubToken: string | null = null
      let exaApiKey: string | null = null
      let googleOauthClientId: string | null = null
      let googleOauthClientSecret: string | null = null
      let googleOauthSessionId: string | null = null
      let googleOauthAccessToken: string | null = null
      let googleOauthRefreshToken: string | null = null

      if (typeof window !== "undefined") {
        // Load Maps API key
        const storedMapsKey = localStorage.getItem("google_maps_api_key")
        const storedMapsProjectId = localStorage.getItem("google_maps_project_id")
        if (storedMapsProjectId) {
          mapsProjectId = storedMapsProjectId.trim()
          console.log(`[Workflows] Using Maps Project ID from localStorage: ${mapsProjectId}`)
        }
        if (storedMapsKey) {
          // Extract API key from various formats (curl command, header, etc.)
          let cleanedKey = storedMapsKey.trim()
          // If it looks like a curl command, extract the key
          const curlMatch = cleanedKey.match(/X-Goog-Api-Key:\s*([A-Za-z0-9_-]+)/i)
          if (curlMatch) {
            cleanedKey = curlMatch[1]
          } else {
            // If it contains "AIza" or common typo "Alza", extract just the key part
            let keyMatch = cleanedKey.match(/(AIza[A-Za-z0-9_-]{25,})/)
            if (!keyMatch) {
              // Try to match common typo "Alza" (lowercase L instead of uppercase I)
              keyMatch = cleanedKey.match(/(Alza[A-Za-z0-9_-]{25,})/)
              if (keyMatch) {
                // Fix the typo: replace "Alza" with "AIza"
                cleanedKey = "AIza" + keyMatch[1].substring(4)
                // Save the corrected key back to localStorage
                localStorage.setItem("google_maps_api_key", cleanedKey)
                console.log(`[Workflows] Fixed typo in Maps API key: "Alza" -> "AIza"`)
              }
            } else {
              cleanedKey = keyMatch[1]
            }
          }

          // Fix common typo if key starts with "Alza" instead of "AIza"
          if (cleanedKey.startsWith("Alza")) {
            cleanedKey = "AIza" + cleanedKey.substring(4)
            // Save the corrected key back to localStorage
            localStorage.setItem("google_maps_api_key", cleanedKey)
            console.log(`[Workflows] Fixed typo in Maps API key: "Alza" -> "AIza"`)
          }

          if (cleanedKey && cleanedKey.startsWith("AIza")) {
            mapsApiKey = cleanedKey
            console.log(`[Workflows] Using Maps API key from localStorage (length: ${mapsApiKey.length}, starts with: ${mapsApiKey.substring(0, 10)}...)`)
          } else {
            console.warn(`[Workflows] Invalid Maps API key format in localStorage. Key should start with "AIza"`)
          }
        }

        // Load Notion API key
        const storedNotionKey = localStorage.getItem("notion_api_key")
        if (storedNotionKey) {
          notionApiKey = storedNotionKey.trim()
          console.log(`[Workflows] Using Notion API key from localStorage (length: ${notionApiKey.length})`)
        }

        // Load GitHub token
        const storedGitHubToken = localStorage.getItem("github_personal_access_token")
        if (storedGitHubToken) {
          githubToken = storedGitHubToken.trim()
          console.log(`[Workflows] Using GitHub token from localStorage (length: ${githubToken.length})`)
        }

        // Load Exa API key
        const storedExaKey = localStorage.getItem("exa_api_key")
        if (storedExaKey) {
          exaApiKey = storedExaKey.trim()
          console.log(`[Workflows] Using Exa API key from localStorage (length: ${exaApiKey.length})`)
        }

        // Load Google OAuth credentials
        googleOauthClientId = localStorage.getItem("google_oauth_client_id")
        googleOauthClientSecret = localStorage.getItem("google_oauth_client_secret")
        if (googleOauthClientId) {
          console.log(`[Workflows] Using Google OAuth credentials from localStorage`)
        }
        googleOauthSessionId = localStorage.getItem("google_workspace_session_id")
        googleOauthAccessToken = localStorage.getItem("google_workspace_access_token")
        googleOauthRefreshToken = localStorage.getItem("google_workspace_refresh_token")

        console.log(`[Workflows] 📤 Sending request with Session ID: ${googleOauthSessionId || "MISSING from LocalStorage"}`)
      }

      // Call the API with streaming support for tool execution tracking
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: userInput,
          history: messages.map(m => ({
            role: m.role,
            content: m.content,
            imageUrl: m.imageUrl?.startsWith('blob:') ? undefined : m.imageUrl,
            toolCalls: m.toolCalls,
            toolCallId: m.toolCallId
          })),
          imageUrl: imageBase64,
          provider: chatProvider,
          apiKey: userApiKey,
          mapsApiKey,
          mapsProjectId,
          notionApiKey,
          githubToken,
          exaApiKey,
          googleOauthClientId,
          googleOauthClientSecret,
          googleOauthSessionId,
          googleOauthAccessToken,
          googleOauthRefreshToken,
        }),
      })

      // Monitor for tool executions (this is a simplified version - in production, you'd use SSE or WebSocket)
      // For now, we'll track based on the response
      if (response.ok) {
        // Refresh health to update server statuses
        refreshHealth()
      }

      const contentType = response.headers.get("content-type")
      if (!response.ok) {
        let errorMessage = "Failed to get response from API"
        if (contentType && contentType.includes("application/json")) {
          try {
            const errorData = await response.json()
            errorMessage = errorData.error || errorData.details || errorMessage

            // Handle API key errors
            if (errorMessage.includes("API key") || response.status === 401) {
              const providerName = chatProvider === "openai" ? "OpenAI"
                : chatProvider === "anthropic" ? "Anthropic (Claude)"
                  : "Google Gemini"
              const keyPrefix = chatProvider === "openai" ? "sk-"
                : chatProvider === "anthropic" ? "sk-ant-"
                  : "AIza"

              errorMessage = `${errorMessage}\n\nPlease provide your ${providerName} API key. You can:\n1. Type it here in the chat (e.g., "my ${chatProvider} key is ${keyPrefix}..."), or\n2. Go to Settings (click your avatar) to enter it.`
            } else if (errorMessage.includes("not yet") && errorMessage.includes("implemented")) {
              const providerName = chatProvider === "openai" ? "OpenAI"
                : chatProvider === "anthropic" ? "Anthropic (Claude)"
                  : "Google Gemini"
              const keyPrefix = chatProvider === "openai" ? "sk-"
                : chatProvider === "anthropic" ? "sk-ant-"
                  : "AIza"

              errorMessage = `${errorMessage}\n\nPlease provide your ${providerName} API key. You can:\n1. Type it here in the chat (e.g., "my ${chatProvider} key is ${keyPrefix}..."), or\n2. Go to Settings (click your avatar) to enter it.`
            }
          } catch (e) {
            errorMessage = `API Error: ${response.status} ${response.statusText}`
          }
        } else {
          errorMessage = `API Error: ${response.status} ${response.statusText}. The server may need to be restarted.`
        }
        throw new Error(errorMessage)
      }

      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("API returned non-JSON response. Please check the server.")
      }

      const data = await response.json()

      // Refresh health after completion
      refreshHealth()

      // Add assistant message with tool metadata
      const assistantMessage: Message = {
        id: generateUUID(),
        role: "assistant",
        content: data.content || "No response generated",
        imageUrl: data.imageUrl || undefined,
        timestamp: new Date(),
        toolCalls: data.toolCalls,
      }

      // If there are tool results, we need to add them to history as well
      // Note: We don't necessarily need to render them in the UI, but they must be in the state for history
      const toolResultMessage: Message | null = data.toolResults ? {
        id: generateUUID(),
        role: "tool",
        content: data.toolResults.map((tr: any) => tr.content).join("\n"),
        timestamp: new Date(),
        toolResults: data.toolResults,
        // For simplicity, if multiple tools were called, we'd ideally have multiple tool messages
        // but adding them to history correctly later is what matters most.
      } : null

      setMessages((prev) => {
        let next = [...prev, assistantMessage]

        // If the backend sent back specific tool results, add them as hidden 'tool' messages
        if (data.toolResults && Array.isArray(data.toolResults)) {
          const toolMessages = data.toolResults.map((tr: any) => ({
            id: generateUUID(),
            role: "tool" as const,
            content: typeof tr.content === 'string' ? tr.content : JSON.stringify(tr.content),
            timestamp: new Date(),
            toolCallId: tr.tool_call_id
          }))
          next = [...next, ...toolMessages]
        }

        return next
      })
    } catch (error: any) {
      console.error("Error sending message:", error)
      // Extract the actual error message, handling both Error objects and strings
      const errorMsg = error?.message || error?.toString() || "Failed to process your request. Please try again."
      const errorMessage: Message = {
        id: generateUUID(),
        role: "assistant",
        content: `Error: ${errorMsg}`,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  // Parse input for slash command and hashtag tool autocomplete
  React.useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    const cursorPos = textarea.selectionStart
    const textBeforeCursor = input.substring(0, cursorPos)

    // Check for hashtag tool autocomplete (#)
    const lastHashtagIndex = textBeforeCursor.lastIndexOf("#")
    const textAfterHashtag = textBeforeCursor.substring(lastHashtagIndex + 1)
    const hasSpaceAfterHashtag = textAfterHashtag.includes(" ") || textAfterHashtag.includes("\n")

    // Check for slash server autocomplete (/)
    const lastSlashIndex = textBeforeCursor.lastIndexOf("/")
    const textAfterSlash = textBeforeCursor.substring(lastSlashIndex + 1)
    const hasSpaceAfterSlash = textAfterSlash.includes(" ") || textAfterSlash.includes("\n")

    // Determine which autocomplete to show (hashtag takes precedence if both are present)
    const hashtagIsActive = lastHashtagIndex >= 0 && !hasSpaceAfterHashtag && cursorPos === textBeforeCursor.length && (lastSlashIndex < 0 || lastHashtagIndex > lastSlashIndex)
    const slashIsActive = lastSlashIndex >= 0 && !hasSpaceAfterSlash && cursorPos === textBeforeCursor.length && !hashtagIsActive

    if (hashtagIsActive) {
      // We're in a hashtag tool command - extract query
      const query = textAfterHashtag.toLowerCase()
      setAutocompleteQuery(query)
      setAutocompleteType("tools")
      setShowAutocomplete(true)
      setSelectedAutocompleteIndex(0)
      // Fetch tools if not already loaded
      fetchAllTools()
    } else if (slashIsActive) {
      // We're in a slash server command - extract query
      const query = textAfterSlash.toLowerCase()
      setAutocompleteQuery(query)
      setAutocompleteType("servers")
      setShowAutocomplete(true)
      setSelectedAutocompleteIndex(0)
    } else {
      setShowAutocomplete(false)
    }
  }, [input, fetchAllTools])

  // Filter servers based on query
  const filteredServers = React.useMemo(() => {
    if (!autocompleteQuery) return servers
    return servers.filter(server =>
      server.name.toLowerCase().includes(autocompleteQuery) ||
      server.id.toLowerCase().includes(autocompleteQuery)
    )
  }, [servers, autocompleteQuery])

  // Filter tools based on query
  const filteredTools = React.useMemo(() => {
    if (!autocompleteQuery) return allTools
    return allTools.filter(tool =>
      tool.name.toLowerCase().includes(autocompleteQuery) ||
      tool.description?.toLowerCase().includes(autocompleteQuery) ||
      tool.serverName.toLowerCase().includes(autocompleteQuery) ||
      tool.serverId.toLowerCase().includes(autocompleteQuery)
    )
  }, [allTools, autocompleteQuery])

  // Get current filtered list based on autocomplete type
  const filteredList = autocompleteType === "tools" ? filteredTools : filteredServers

  // Reset selected index when filtered list changes
  React.useEffect(() => {
    if (selectedAutocompleteIndex >= filteredList.length) {
      setSelectedAutocompleteIndex(0)
    }
  }, [filteredList.length, selectedAutocompleteIndex])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle command history navigation (only when autocomplete is not showing)
    if (!showAutocomplete && commandHistory.length > 0) {
      if (e.key === "ArrowUp") {
        e.preventDefault()
        setHistoryIndex((prev) => {
          if (prev === -1) {
            // Starting navigation - save current input if it's not empty and different
            const currentInput = input.trim()
            if (currentInput && commandHistory[commandHistory.length - 1] !== currentInput) {
              // Don't modify history here, just navigate to last entry
            }
            // Go to last command in history
            return commandHistory.length - 1
          } else if (prev > 0) {
            // Navigate up in history
            return prev - 1
          }
          // Already at the top
          return prev
        })
        return
      }
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setHistoryIndex((prev) => {
          if (prev === -1) {
            // Already at the bottom (new command)
            return prev
          } else if (prev < commandHistory.length - 1) {
            // Navigate down in history
            return prev + 1
          } else {
            // Reached the bottom - go back to new command
            return -1
          }
        })
        return
      }
    }

    // Handle autocomplete navigation (when autocomplete is showing)
    if (showAutocomplete && filteredList.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setSelectedAutocompleteIndex(prev =>
          prev < filteredList.length - 1 ? prev + 1 : prev
        )
        return
      }
      if (e.key === "ArrowUp") {
        e.preventDefault()
        setSelectedAutocompleteIndex(prev => prev > 0 ? prev - 1 : 0)
        return
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault()
        if (autocompleteType === "tools") {
          const selectedTool = filteredTools[selectedAutocompleteIndex] as Tool | undefined
          if (selectedTool) {
            insertToolCommand(selectedTool.name, selectedTool.serverId)
          }
        } else {
          const selectedServer = filteredServers[selectedAutocompleteIndex]
          if (selectedServer) {
            insertServerCommand(selectedServer.id)
          }
        }
        return
      }
      if (e.key === "Escape") {
        e.preventDefault()
        setShowAutocomplete(false)
        return
      }
    }

    if (e.key === "Enter" && !e.shiftKey && !showAutocomplete) {
      e.preventDefault()
      handleSubmit(e as any)
    }
  }

  // Helper function to generate a friendly slug from server name or ID
  const getServerSlug = (server: Server): string => {
    // For system servers, use the ID (already friendly: github, brave, etc.)
    if (server.type === "system") {
      return server.id
    }

    // For user servers, generate a slug from the name
    // Convert to lowercase, replace spaces/special chars with hyphens
    let slug = server.name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-") // Replace non-alphanumeric with hyphens
      .replace(/^-+|-+$/g, "") // Remove leading/trailing hyphens

    // If slug is empty or too short, use a shortened version of the ID
    if (!slug || slug.length < 3) {
      slug = server.id.replace(/^user-/, "").substring(0, 15)
    }

    return slug.substring(0, 30) // Limit length
  }

  // Store server slug to ID mapping for later use
  const serverSlugMap = React.useMemo(() => {
    const map = new Map<string, string>()
    servers.forEach(server => {
      const slug = getServerSlug(server)
      map.set(slug, server.id)
    })
    return map
  }, [servers])

  const insertServerCommand = (serverId: string) => {
    const textarea = textareaRef.current
    if (!textarea) return

    // Find the server to get its name for slug generation
    const server = servers.find(s => s.id === serverId)
    if (!server) return

    const serverSlug = getServerSlug(server)

    const cursorPos = textarea.selectionStart
    const textBeforeCursor = input.substring(0, cursorPos)
    const lastSlashIndex = textBeforeCursor.lastIndexOf("/")

    if (lastSlashIndex >= 0) {
      const beforeSlash = input.substring(0, lastSlashIndex)
      const afterCursor = input.substring(cursorPos)
      const newInput = `${beforeSlash}/${serverSlug} ${afterCursor}`
      setInput(newInput)
      setShowAutocomplete(false)

      // Set cursor position after the inserted command
      setTimeout(() => {
        const newCursorPos = lastSlashIndex + serverSlug.length + 2 // +1 for /, +1 for space
        textarea.focus()
        textarea.setSelectionRange(newCursorPos, newCursorPos)
      }, 0)
    }
  }

  const insertToolCommand = (toolName: string, serverId: string) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const cursorPos = textarea.selectionStart
    const textBeforeCursor = input.substring(0, cursorPos)
    const lastHashtagIndex = textBeforeCursor.lastIndexOf("#")

    if (lastHashtagIndex >= 0) {
      const beforeHashtag = input.substring(0, lastHashtagIndex)
      const afterCursor = input.substring(cursorPos)
      const newInput = `${beforeHashtag}#${toolName} ${afterCursor}`
      setInput(newInput)
      setShowAutocomplete(false)

      // Set cursor position after the inserted tool name
      setTimeout(() => {
        const newCursorPos = lastHashtagIndex + toolName.length + 2 // +1 for #, +1 for space
        textarea.focus()
        textarea.setSelectionRange(newCursorPos, newCursorPos)
      }, 0)
    }
  }

  const handleToggleRecording = () => {
    if (!recognitionRef.current) return

    if (isRecording) {
      recognitionRef.current.stop()
    } else {
      try {
        recognitionRef.current.start()
      } catch (error) {
        console.error("Failed to start recording:", error)
        setIsRecording(false)
      }
    }
  }

  // Check if mobile device
  const [isMobile, setIsMobile] = React.useState(false)

  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024)
    }
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col relative">
      {/* Tool Execution Status - Above messages */}
      {toolExecutions.length > 0 && (
        <div className="px-4 pt-4 pb-2 border-b border-border bg-background/50 backdrop-blur-sm">
          <ToolExecutionStatus
            executions={toolExecutions}
            onPermissionGrant={handlePermissionGrant}
          />
        </div>
      )}

      {/* Chat Messages */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-4 sm:p-6"
      >
        <div className="mx-auto max-w-3xl space-y-2">
          {messages.length === 0 && (
            <div className="flex h-full items-center justify-center">
              <div className="text-center space-y-2">
                <p className="text-lg text-muted-foreground">Start a conversation</p>
                <p className="text-sm text-muted-foreground">
                  Ask me to process an image, execute a tool, or create a workflow
                </p>
              </div>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {message.role === "assistant" && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 overflow-hidden">
                  <Image
                    src="https://automationalien.s3.us-east-1.amazonaws.com/ChatGPT+Image+Jun+23%2C+2025%2C+03_53_12+PM.png"
                    alt="Nexus"
                    width={32}
                    height={32}
                    className="h-full w-full object-cover"
                  />
                </div>
              )}
              <Card
                className={`max-w-[85%] sm:max-w-[75%] py-0 ${message.role === "user" ? "bg-primary text-primary-foreground" : ""
                  }`}
              >
                <CardContent className="py-2 px-3">
                  {message.imageUrl && (
                    <div className="mb-3">
                      <img
                        src={message.imageUrl}
                        alt={message.role === "assistant" ? "Screenshot" : "Uploaded image"}
                        className="max-h-96 w-auto rounded-lg object-contain border border-border shadow-sm"
                      />
                    </div>
                  )}
                  {message.content && (
                    <div className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                      {(() => {
                        let processedContent = message.content

                        // Helper to process a URL for OAuth/CSRF
                        const processUrl = (url: string) => {
                          if (url.includes("accounts.google.com/o/oauth2") && url.includes("state=")) {
                            const encodedUrl = encodeURIComponent(url)
                            return `/api/auth/oauth-start?url=${encodedUrl}`
                          }
                          return url
                        }

                        // Split by Markdown links first: [text](url)
                        const markdownLinkRegex = /(\[[^\]]+\]\([^)]+\))/g
                        return processedContent.split(markdownLinkRegex).map((part, index) => {
                          const markdownMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
                          if (markdownMatch) {
                            const text = markdownMatch[1]
                            const url = markdownMatch[2]
                            const finalUrl = processUrl(url)

                            return (
                              <a
                                key={index}
                                href={finalUrl}
                                target="_blank"
                                className="text-primary underline hover:text-primary/80 break-all"
                              >
                                {text}
                              </a>
                            )
                          }

                          // If not a markdown link, split by standalone URLs
                          // Regex breakdown: http(s):// optional www. optional chars for domain/TLD, then an optional path/query part that doesn't end in punctuation
                          return part.split(/(https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9]{1,6}\b(?:[-a-zA-Z0-9@:%_\+.~#?&//=]*[a-zA-Z0-9@:%_\+~#?&//=])?)/g).map((subPart, subIndex) => {
                            if (subPart.match(/^https?:\/\//)) {
                              const finalUrl = processUrl(subPart)
                              return (
                                <a
                                  key={`${index}-${subIndex}`}
                                  href={finalUrl}
                                  target="_blank"
                                  className="text-primary underline hover:text-primary/80 break-all"
                                >
                                  {subPart}
                                </a>
                              )
                            }
                            return <span key={`${index}-${subIndex}`}>{subPart}</span>
                          })
                        })
                      })()}
                    </div>
                  )}
                  <MessageTimestamp timestamp={message.timestamp} />
                </CardContent>
              </Card>
              {message.role === "user" && (
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarImage
                    src={displayUser?.avatar_url || "/placeholder-user.svg"}
                    alt={displayUser?.name || "Guest"}
                    className={avatarImageClassName}
                  />
                  <AvatarFallback className="text-xs text-foreground">
                    {displayUser ? displayUser.name.charAt(0).toUpperCase() : "G"}
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-3 justify-start">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 overflow-hidden">
                <Image
                  src="https://automationalien.s3.us-east-1.amazonaws.com/ChatGPT+Image+Jun+23%2C+2025%2C+03_53_12+PM.png"
                  alt="Nexus"
                  width={32}
                  height={32}
                  className="h-full w-full object-cover"
                />
              </div>
              <Card className="max-w-[75%] py-0">
                <CardContent className="py-2 px-3">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <p className="text-sm text-muted-foreground">Processing...</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div
        className="border-t border-border bg-background"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="mx-auto max-w-3xl p-4">
          {imagePreview && (
            <div className="mb-3 relative inline-block">
              <div className="relative">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="h-20 w-auto rounded-lg object-contain border border-border"
                />
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="absolute -top-2 -right-2 p-1 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
                  aria-label="Remove image"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex gap-2 items-center justify-center w-full max-w-4xl mx-auto">
            {/* Provider Selector - Left Side */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <HoverIconButton
                  disabled={isLoading}
                  type="button"
                  className="h-[60px] w-[60px] flex items-center justify-center gap-1.5 text-muted-foreground"
                >
                  <Brain className="h-5 w-5 text-primary" />
                  <ChevronDown className="h-3.5 w-3.5" />
                </HoverIconButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-40">
                <DropdownMenuItem
                  onClick={() => setChatProvider("openai")}
                  className={chatProvider === "openai" ? "bg-accent" : ""}
                >
                  OpenAI
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setChatProvider("anthropic")}
                  className={chatProvider === "anthropic" ? "bg-accent" : ""}
                >
                  Claude
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setChatProvider("google")}
                  className={chatProvider === "google" ? "bg-accent" : ""}
                >
                  Gemini
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <div className="flex-1 relative">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onPaste={handlePaste}
                onKeyDown={handleKeyDown}
                placeholder={
                  isDragging
                    ? "Drop image here..."
                    : isRecording
                      ? "Listening..."
                      : "Type your request, speak, or paste/drag an image..."
                }
                className={`min-h-[60px] max-h-[200px] resize-none ${isSpeechSupported ? "pr-20" : "pr-12"
                  }`}
                disabled={isLoading}
              />
              {showAutocomplete && filteredList.length > 0 && (
                <div
                  ref={autocompleteRef}
                  className="absolute bottom-full left-0 right-0 mb-1 bg-popover border border-border rounded-md shadow-lg z-50 max-h-60 overflow-y-auto"
                >
                  {autocompleteType === "servers" ? (
                    filteredServers.map((server, index) => (
                      <div
                        key={server.id}
                        onClick={() => insertServerCommand(server.id)}
                        className={`px-3 py-2 cursor-pointer flex items-center gap-2 hover:bg-accent transition-colors ${index === selectedAutocompleteIndex ? "bg-accent" : ""
                          }`}
                        onMouseEnter={() => setSelectedAutocompleteIndex(index)}
                      >
                        {server.logoUrl && (
                          <img
                            src={server.logoUrl}
                            alt={server.name}
                            className="w-4 h-4 object-contain flex-shrink-0"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none'
                            }}
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">{server.name}</div>
                          {server.description && (
                            <div className="text-xs text-muted-foreground truncate">
                              {server.description}
                            </div>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground flex-shrink-0">/{server.id}</div>
                      </div>
                    ))
                  ) : (
                    filteredTools.map((tool, index) => (
                      <div
                        key={`${tool.serverId}-${tool.name}`}
                        onClick={() => insertToolCommand(tool.name, tool.serverId)}
                        className={`px-3 py-2 cursor-pointer flex items-center gap-2 hover:bg-accent transition-colors ${index === selectedAutocompleteIndex ? "bg-accent" : ""
                          }`}
                        onMouseEnter={() => setSelectedAutocompleteIndex(index)}
                      >
                        {tool.serverLogoUrl && (
                          <img
                            src={tool.serverLogoUrl}
                            alt={tool.serverName}
                            className="w-4 h-4 object-contain flex-shrink-0"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none'
                            }}
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">{tool.name}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {tool.description || `${tool.serverName} tool`}
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground flex-shrink-0">#{tool.name}</div>
                      </div>
                    ))
                  )}
                  {isLoadingTools && autocompleteType === "tools" && (
                    <div className="px-3 py-2 text-xs text-muted-foreground text-center">
                      Loading tools...
                    </div>
                  )}
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleImageSelect(file)
                }}
                className="hidden"
                id="image-upload"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                {isSpeechSupported && (
                  <HoverIconButton
                    type="button"
                    onClick={handleToggleRecording}
                    disabled={isLoading}
                    className={`p-2 ${isRecording ? "bg-destructive/10 animate-pulse" : ""}`}
                    title={isRecording ? "Stop recording" : "Start voice input"}
                  >
                    <Mic
                      className={`h-4 w-4 ${isRecording ? "text-destructive" : "text-muted-foreground"
                        }`}
                    />
                  </HoverIconButton>
                )}
                {/* Camera button - show on mobile or when camera is available */}
                {(isMobile || (typeof navigator !== "undefined" && navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function')) && (
                  <HoverIconButton
                    type="button"
                    onClick={() => setShowCamera(true)}
                    disabled={isLoading}
                    className="p-2"
                    title="Take photo"
                  >
                    <Camera className="h-4 w-4 text-muted-foreground" />
                  </HoverIconButton>
                )}
                <label htmlFor="image-upload">
                  <HoverIconButton
                    type="button"
                    className="p-2 cursor-pointer"
                    title="Upload image"
                    onClick={(e) => {
                      e.preventDefault()
                      fileInputRef.current?.click()
                    }}
                  >
                    <ImageIcon className="h-4 w-4 text-muted-foreground" />
                  </HoverIconButton>
                </label>
              </div>
            </div>
            <HoverIconButton
              type="submit"
              disabled={(!input.trim() && !uploadedImage) || isLoading}
              className="h-[60px] w-[60px] flex items-center justify-center"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </HoverIconButton>
          </form>
        </div>
      </div>

      {/* MCP Server Sidebar */}
      <McpServerSidebar
        servers={serverStatuses}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onConnect={(serverId) => {
          if (serverId === "google-workspace" || serverId === "google workspace") {
            // Check for existing session or generate new one
            let sessionId = localStorage.getItem('google_workspace_session_id');
            if (!sessionId) {
              sessionId = generateUUID();
              localStorage.setItem('google_workspace_session_id', sessionId);
            }

            // Use the known deployed Cloud Run URL
            const authUrl = `https://google-workspace-mcp-server-554655392699.us-central1.run.app/oauth/authorize?session_id=${sessionId}`;
            console.log(`[Workflows] Initiating manual connection to: ${authUrl}`);

            const width = 600;
            const height = 700;
            const left = window.screen.width / 2 - width / 2;
            const top = window.screen.height / 2 - height / 2;

            window.open(
              authUrl,
              'GoogleWorkspaceAuth',
              `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=yes`
            );
          }
        }}
      />

      {/* Camera Capture Modal */}
      {showCamera && (
        <CameraCapture
          onCapture={handleCameraCapture}
          onClose={() => setShowCamera(false)}
        />
      )}
    </div>
  )
}
