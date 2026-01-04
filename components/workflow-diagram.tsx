"use client"

import { Brain, Eye, MessageSquare, Zap, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"

export function WorkflowDiagram({ className }: { className?: string }) {
  return (
    <div
      className={cn("flex items-center justify-center p-8", className)}
      aria-label="Workflow architecture diagram"
    >
      <div className="relative w-full max-w-2xl">
        {/* Mobile: Vertical layout */}
        <div className="flex flex-col items-center gap-6 md:hidden">
          {/* Input */}
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-primary bg-primary/10">
              <MessageSquare className="h-8 w-8 text-primary" />
            </div>
            <span className="text-sm font-medium text-foreground">User Message</span>
          </div>

          <ArrowRight className="h-6 w-6 rotate-90 text-muted-foreground" />

          {/* Router LLM */}
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-accent bg-accent/10">
              <Brain className="h-8 w-8 text-accent" />
            </div>
            <span className="text-sm font-medium text-foreground">Router LLM</span>
          </div>

          <ArrowRight className="h-6 w-6 rotate-90 text-muted-foreground" />

          {/* Workers */}
          <div className="flex flex-col gap-4">
            <div className="flex flex-col items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-lg border-2 border-primary bg-primary/10">
                <Eye className="h-7 w-7 text-primary" />
              </div>
              <span className="text-xs font-medium text-foreground">Vision Worker</span>
            </div>
            <div className="flex flex-col items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-lg border-2 border-primary bg-primary/10">
                <MessageSquare className="h-7 w-7 text-primary" />
              </div>
              <span className="text-xs font-medium text-foreground">Chat Worker</span>
            </div>
            <div className="flex flex-col items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-lg border-2 border-primary bg-primary/10">
                <Zap className="h-7 w-7 text-primary" />
              </div>
              <span className="text-xs font-medium text-foreground">Tool Worker</span>
            </div>
          </div>
        </div>

        {/* Desktop: Horizontal layout */}
        <div className="hidden items-center justify-center gap-4 md:flex lg:gap-8">
          {/* Input */}
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-primary bg-primary/10 shadow-sm">
              <MessageSquare className="h-10 w-10 text-primary" />
            </div>
            <span className="text-sm font-medium text-foreground">User Message</span>
          </div>

          <ArrowRight className="h-8 w-8 text-muted-foreground" />

          {/* Router LLM */}
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-accent bg-accent/10 shadow-sm">
              <Brain className="h-10 w-10 text-accent" />
            </div>
            <span className="text-sm font-medium text-foreground">Router LLM</span>
            <span className="text-xs text-muted-foreground">Classifies & Routes</span>
          </div>

          <ArrowRight className="h-8 w-8 text-muted-foreground" />

          {/* Workers */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-center gap-2">
                <div className="flex h-16 w-16 items-center justify-center rounded-lg border-2 border-primary bg-primary/10 shadow-sm">
                  <Eye className="h-8 w-8 text-primary" />
                </div>
                <span className="text-xs font-medium text-foreground">Vision</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="flex h-16 w-16 items-center justify-center rounded-lg border-2 border-primary bg-primary/10 shadow-sm">
                  <MessageSquare className="h-8 w-8 text-primary" />
                </div>
                <span className="text-xs font-medium text-foreground">Chat</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="flex h-16 w-16 items-center justify-center rounded-lg border-2 border-primary bg-primary/10 shadow-sm">
                  <Zap className="h-8 w-8 text-primary" />
                </div>
                <span className="text-xs font-medium text-foreground">Tools</span>
              </div>
            </div>
            <span className="text-center text-xs text-muted-foreground">Workers</span>
          </div>
        </div>
      </div>
    </div>
  )
}
