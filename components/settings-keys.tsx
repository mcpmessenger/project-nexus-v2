"use client"

import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Eye, EyeOff, Loader2, CheckCircle2, XCircle } from "lucide-react"
import { useAuth } from "./auth-provider"

interface ApiKeysSettingsProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ApiKeysSettings({ open, onOpenChange }: ApiKeysSettingsProps) {
  const { user, signInWithOAuth } = useAuth()
  const [openaiKey, setOpenaiKey] = React.useState("")
  const [anthropicKey, setAnthropicKey] = React.useState("")
  const [geminiKey, setGeminiKey] = React.useState("")
  const [googleMapsKey, setGoogleMapsKey] = React.useState("")
  const [showOpenaiKey, setShowOpenaiKey] = React.useState(false)
  const [showAnthropicKey, setShowAnthropicKey] = React.useState(false)
  const [showGeminiKey, setShowGeminiKey] = React.useState(false)
  const [showGoogleMapsKey, setShowGoogleMapsKey] = React.useState(false)
  const [saved, setSaved] = React.useState(false)
  const [testingMapsKey, setTestingMapsKey] = React.useState(false)
  const [mapsKeyTestResult, setMapsKeyTestResult] = React.useState<{ success: boolean; message: string } | null>(null)

  // Helper to extract API key from various formats (curl command, header, etc.)
  const extractApiKey = (input: string): string => {
    const trimmed = input.trim()
    // If it looks like a curl command, extract the key
    const curlMatch = trimmed.match(/X-Goog-Api-Key:\s*([A-Za-z0-9_-]+)/i)
    if (curlMatch) {
      let key = curlMatch[1]
      // Fix common typo: "Alza" -> "AIza" (lowercase L -> uppercase I)
      if (key.startsWith("Alza")) {
        key = "AIza" + key.substring(4)
      }
      return key
    }
    // If it contains "AIza" or common typo "Alza" (Google API key prefix), extract just the key part
    // Google API keys start with "AIza" followed by alphanumeric, dashes, underscores
    // They're typically 39 characters but can vary
    // Match "AIza" or "Alza" followed by at least 25 more characters (total ~30+)
    let keyMatch = trimmed.match(/(AIza[A-Za-z0-9_-]{25,})/)
    if (!keyMatch) {
      // Try to match common typo "Alza" (lowercase L instead of uppercase I)
      keyMatch = trimmed.match(/(Alza[A-Za-z0-9_-]{25,})/)
      if (keyMatch) {
        // Fix the typo: replace "Alza" with "AIza"
        const fixedKey = "AIza" + keyMatch[1].substring(4)
        return fixedKey
      }
    }
    if (keyMatch) {
      return keyMatch[1]
    }
    // Otherwise return as-is (might already be just the key)
    // But fix common typo if present
    if (trimmed.startsWith("Alza")) {
      return "AIza" + trimmed.substring(4)
    }
    return trimmed
  }

  // Load keys from localStorage on mount
  React.useEffect(() => {
    if (open) {
      const savedOpenaiKey = localStorage.getItem("openai_api_key") || ""
      const savedAnthropicKey = localStorage.getItem("anthropic_api_key") || ""
      const savedGeminiKey = localStorage.getItem("gemini_api_key") || ""
      const savedGoogleMapsKey = localStorage.getItem("google_maps_api_key") || ""
      setOpenaiKey(savedOpenaiKey)
      setAnthropicKey(savedAnthropicKey)
      setGeminiKey(savedGeminiKey)
      // Clean the Google Maps key when loading (in case it was saved incorrectly)
      const cleanedMapsKey = savedGoogleMapsKey ? extractApiKey(savedGoogleMapsKey) : ""
      setGoogleMapsKey(cleanedMapsKey)
      // If we cleaned it and it's different, save the cleaned version back
      if (savedGoogleMapsKey && cleanedMapsKey && cleanedMapsKey !== savedGoogleMapsKey && cleanedMapsKey.startsWith("AIza")) {
        localStorage.setItem("google_maps_api_key", cleanedMapsKey)
      }
      setSaved(false)
      setMapsKeyTestResult(null) // Clear test result when opening
    }
  }, [open])

  const handleTestMapsKey = async () => {
    if (!googleMapsKey.trim()) {
      setMapsKeyTestResult({ success: false, message: "Please enter an API key first" })
      return
    }

    setTestingMapsKey(true)
    setMapsKeyTestResult(null)

    try {
      const cleanedKey = extractApiKey(googleMapsKey)
      if (!cleanedKey || !cleanedKey.startsWith("AIza")) {
        setMapsKeyTestResult({ 
          success: false, 
          message: "Invalid key format. Key should start with 'AIza'" 
        })
        setTestingMapsKey(false)
        return
      }

      // Test the key by calling the Maps API
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
              "X-Goog-Api-Key": cleanedKey,
            },
          },
        }),
      })

      const data = await response.json()

      if (response.ok && data.status?.healthy) {
        setMapsKeyTestResult({ 
          success: true, 
          message: data.status.message || "API key is valid and working!" 
        })
      } else {
        let errorMsg = data.status?.message || data.error || "Connection failed"
        
        // Extract project ID from error message if present
        const projectIdMatch = errorMsg.match(/project (\d+)/)
        if (projectIdMatch) {
          const projectId = projectIdMatch[1]
          errorMsg += `\n\n⚠️ Your API key belongs to project ${projectId}. Make sure the Maps Grounding Lite API is enabled in that project.`
        }
        
        setMapsKeyTestResult({ 
          success: false, 
          message: errorMsg 
        })
      }
    } catch (error) {
      setMapsKeyTestResult({ 
        success: false, 
        message: error instanceof Error ? error.message : "Failed to test API key" 
      })
    } finally {
      setTestingMapsKey(false)
    }
  }

  const handleSave = () => {
    if (openaiKey.trim()) {
      localStorage.setItem("openai_api_key", openaiKey.trim())
    } else {
      localStorage.removeItem("openai_api_key")
    }
    if (anthropicKey.trim()) {
      localStorage.setItem("anthropic_api_key", anthropicKey.trim())
    } else {
      localStorage.removeItem("anthropic_api_key")
    }
    if (geminiKey.trim()) {
      localStorage.setItem("gemini_api_key", geminiKey.trim())
    } else {
      localStorage.removeItem("gemini_api_key")
    }
    if (googleMapsKey.trim()) {
      const cleanedKey = extractApiKey(googleMapsKey)
      if (cleanedKey && cleanedKey.startsWith("AIza")) {
        localStorage.setItem("google_maps_api_key", cleanedKey)
      } else {
        // Invalid key format - don't save
        console.warn("Invalid Google Maps API key format. Key should start with 'AIza'")
        alert("Invalid Google Maps API key format. Please enter just the API key (starts with 'AIza'), not the full curl command.")
        return
      }
    } else {
      localStorage.removeItem("google_maps_api_key")
    }
    setSaved(true)
    setTimeout(() => {
      setSaved(false)
      onOpenChange(false)
    }, 1000)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            {user 
              ? `Signed in as ${user.email}. Your servers will sync across devices.`
              : "Sign in to sync your servers across devices, or continue as guest."
            }
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {!user && (
            <>
              <div className="grid gap-3">
                <Label>Sign In (Optional)</Label>
                <div className="grid gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => signInWithOAuth("google")}
                    className="w-full"
                  >
                    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                      <path
                        fill="currentColor"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="currentColor"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    Continue with Google
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => signInWithOAuth("github")}
                    className="w-full"
                  >
                    <svg className="mr-2 h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                      <path
                        fillRule="evenodd"
                        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Continue with GitHub
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Sign in to sync your MCP servers across all your devices
                </p>
              </div>
              <div className="border-t border-border my-2" />
            </>
          )}
          
          <div className="grid gap-2">
            <Label>API Keys</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Enter your API keys to use custom credentials. Keys are stored locally in your browser.
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="openai-key">OpenAI API Key</Label>
            <div className="relative">
              <Input
                id="openai-key"
                type={showOpenaiKey ? "text" : "password"}
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
                placeholder="sk-..."
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowOpenaiKey(!showOpenaiKey)}
              >
                {showOpenaiKey ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Get your API key from{" "}
              <a
                href="https://platform.openai.com/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                OpenAI Platform
              </a>
            </p>
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="anthropic-key">Anthropic (Claude) API Key</Label>
            <div className="relative">
              <Input
                id="anthropic-key"
                type={showAnthropicKey ? "text" : "password"}
                value={anthropicKey}
                onChange={(e) => setAnthropicKey(e.target.value)}
                placeholder="sk-ant-..."
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowAnthropicKey(!showAnthropicKey)}
              >
                {showAnthropicKey ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Get your API key from{" "}
              <a
                href="https://console.anthropic.com/settings/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                Anthropic Console
              </a>
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="gemini-key">Google Gemini API Key</Label>
            <div className="relative">
              <Input
                id="gemini-key"
                type={showGeminiKey ? "text" : "password"}
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                placeholder="AIza..."
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowGeminiKey(!showGeminiKey)}
              >
                {showGeminiKey ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Get your API key from{" "}
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                Google AI Studio
              </a>
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="google-maps-key">Google Maps Grounding API Key</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="google-maps-key"
                  type={showGoogleMapsKey ? "text" : "password"}
                  value={googleMapsKey}
                  onChange={(e) => {
                    setGoogleMapsKey(e.target.value)
                    setMapsKeyTestResult(null) // Clear test result when typing
                  }}
                  placeholder="AIza..."
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowGoogleMapsKey(!showGoogleMapsKey)}
                >
                  {showGoogleMapsKey ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={handleTestMapsKey}
                disabled={testingMapsKey || !googleMapsKey.trim()}
                className="shrink-0"
              >
                {testingMapsKey ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Testing...
                  </>
                ) : (
                  "Test"
                )}
              </Button>
            </div>
            {mapsKeyTestResult && (
              <div className={`flex items-center gap-2 text-sm ${
                mapsKeyTestResult.success ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
              }`}>
                {mapsKeyTestResult.success ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                <span>{mapsKeyTestResult.message}</span>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Used by `/maps` commands to authenticate with Google Maps Grounding Lite. Store a key from{" "}
              <a
                href="https://console.cloud.google.com/apis/credentials"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                Google Cloud
              </a>
              . Click "Test" to verify your key works.
              <br />
              <strong>Important:</strong> Make sure the{" "}
              <a
                href="https://console.cloud.google.com/apis/library/mapstools.googleapis.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                Maps Grounding Lite API
              </a>
              {" "}is enabled for your Google Cloud project.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saved}>
            {saved ? "Saved!" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
