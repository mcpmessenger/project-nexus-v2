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
import { Eye, EyeOff } from "lucide-react"

interface ApiKeysSettingsProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ApiKeysSettings({ open, onOpenChange }: ApiKeysSettingsProps) {
  const [openaiKey, setOpenaiKey] = React.useState("")
  const [anthropicKey, setAnthropicKey] = React.useState("")
  const [geminiKey, setGeminiKey] = React.useState("")
  const [showOpenaiKey, setShowOpenaiKey] = React.useState(false)
  const [showAnthropicKey, setShowAnthropicKey] = React.useState(false)
  const [showGeminiKey, setShowGeminiKey] = React.useState(false)
  const [saved, setSaved] = React.useState(false)

  // Load keys from localStorage on mount
  React.useEffect(() => {
    if (open) {
      const savedOpenaiKey = localStorage.getItem("openai_api_key") || ""
      const savedAnthropicKey = localStorage.getItem("anthropic_api_key") || ""
      const savedGeminiKey = localStorage.getItem("gemini_api_key") || ""
      setOpenaiKey(savedOpenaiKey)
      setAnthropicKey(savedAnthropicKey)
      setGeminiKey(savedGeminiKey)
      setSaved(false)
    }
  }, [open])

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
          <DialogTitle>API Keys Settings</DialogTitle>
          <DialogDescription>
            Enter your API keys to use custom credentials. Keys are stored locally in your browser.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
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
