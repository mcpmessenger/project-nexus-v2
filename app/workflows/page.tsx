"use client"

import * as React from "react"
import Image from "next/image"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useAuth } from "@/components/auth-provider"
import { Send, Image as ImageIcon, X, Loader2, Mic, ChevronDown } from "lucide-react"
import { HoverIconButton } from "@/components/ui/hover-icon-button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

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
  role: "user" | "assistant"
  content: string
  imageUrl?: string
  timestamp: Date
}

export default function WorkflowsPage() {
  const { user } = useAuth()
  const [messages, setMessages] = React.useState<Message[]>([])
  const [input, setInput] = React.useState("")
  const [isLoading, setIsLoading] = React.useState(false)
  const [uploadedImage, setUploadedImage] = React.useState<File | null>(null)
  const [imagePreview, setImagePreview] = React.useState<string | null>(null)
  const [isDragging, setIsDragging] = React.useState(false)
  const [isRecording, setIsRecording] = React.useState(false)
  const [isSpeechSupported, setIsSpeechSupported] = React.useState(false)
  const [chatProvider, setChatProvider] = React.useState<"openai" | "anthropic" | "google">("openai")
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const messagesEndRef = React.useRef<HTMLDivElement>(null)
  const recognitionRef = React.useRef<SpeechRecognition | null>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  React.useEffect(() => {
    scrollToBottom()
  }, [messages])

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
    const openaiPatterns = [
      /(?:my\s+)?(?:openai|open\s+ai)\s+(?:api\s+)?key\s+(?:is\s+)?(?:[:=]?\s*)?(sk-[a-zA-Z0-9]{20,})/i,
      /set\s+(?:my\s+)?(?:openai|open\s+ai)\s+(?:api\s+)?key\s+(?:to\s+)?(?:[:=]?\s*)?(sk-[a-zA-Z0-9]{20,})/i,
      /(?:openai|open\s+ai)\s+(?:api\s+)?key\s*[:=]\s*(sk-[a-zA-Z0-9]{20,})/i,
      /(sk-[a-zA-Z0-9]{20,})\s+(?:is\s+)?(?:my\s+)?(?:openai|open\s+ai)\s+(?:api\s+)?key/i,
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
        id: crypto.randomUUID(),
        role: "user",
        content: userInput,
        timestamp: new Date(),
      }
      
      const confirmationMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `✅ ${apiKeyMatch.provider === "openai" ? "OpenAI" : apiKeyMatch.provider === "anthropic" ? "Anthropic (Claude)" : "Google Gemini"} API key saved successfully!`,
        timestamp: new Date(),
      }
      
      setMessages((prev) => [...prev, userMessage, confirmationMessage])
      setInput("")
      return
    }

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: userInput,
      imageUrl: imagePreview || undefined,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")
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

    try {
      // Get API key from localStorage based on provider
      let userApiKey: string | null = null
      if (typeof window !== "undefined") {
        if (chatProvider === "openai") {
          userApiKey = localStorage.getItem("openai_api_key")
        } else if (chatProvider === "anthropic") {
          userApiKey = localStorage.getItem("anthropic_api_key")
        } else if (chatProvider === "google") {
          userApiKey = localStorage.getItem("gemini_api_key")
        }
      }

      // Call the API
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: userInput,
          imageUrl: imageBase64,
          provider: chatProvider,
          apiKey: userApiKey,
        }),
      })

      const contentType = response.headers.get("content-type")
      if (!response.ok) {
        let errorMessage = "Failed to get response from API"
        if (contentType && contentType.includes("application/json")) {
          try {
            const errorData = await response.json()
            errorMessage = errorData.error || errorData.details || errorMessage
            
            if (errorMessage.includes("not yet") && errorMessage.includes("implemented")) {
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

      // Add assistant message
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.content || "No response generated",
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, assistantMessage])
    } catch (error: any) {
      console.error("Error sending message:", error)
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `Error: ${error.message || "Failed to process your request. Please try again."}`,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e as any)
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

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
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
                    src="/images/chatgpt-20image-20jun-2023-2c-202025-2c-2003-53-12-20pm.png"
                    alt="Nexus"
                    width={32}
                    height={32}
                    className="h-full w-full object-cover"
                  />
                </div>
              )}
              <Card
                className={`max-w-[85%] sm:max-w-[75%] py-0 ${
                  message.role === "user" ? "bg-primary text-primary-foreground" : ""
                }`}
              >
                <CardContent className="py-2 px-3">
                  {message.imageUrl && (
                    <div className="mb-2">
                      <img
                        src={message.imageUrl}
                        alt="Uploaded"
                        className="max-h-48 w-auto rounded-lg object-contain"
                      />
                    </div>
                  )}
                  <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{message.content}</p>
                  <p className="mt-1.5 text-xs opacity-70">
                    {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </CardContent>
              </Card>
              {message.role === "user" && (
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarImage 
                    src={user?.avatar_url || "/placeholder-user.svg"} 
                    alt={user?.name || "Guest"}
                    className="dark:invert"
                  />
                  <AvatarFallback className="text-xs text-foreground">
                    {user ? user.name.charAt(0).toUpperCase() : "G"}
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-3 justify-start">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 overflow-hidden">
                <Image
                  src="/images/chatgpt-20image-20jun-2023-2c-202025-2c-2003-53-12-20pm.png"
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
                  <Image 
                    src="/brain_icon.png" 
                    alt="AI Provider" 
                    width={20} 
                    height={20} 
                    className="h-5 w-5 dark:invert"
                  />
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
                className={`min-h-[60px] max-h-[200px] resize-none ${
                  isSpeechSupported ? "pr-20" : "pr-12"
                }`}
                disabled={isLoading}
              />
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
                      className={`h-4 w-4 ${
                        isRecording ? "text-destructive" : "text-muted-foreground"
                      }`}
                    />
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
    </div>
  )
}
