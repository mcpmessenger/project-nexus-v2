"use client"

import * as React from "react"
import { Brain, Eye, MessageSquare, Zap } from "lucide-react"
import { cn } from "@/lib/utils"
import { AnimatedBeam } from "@/components/ui/animated-beam"

export function WorkflowDiagram({ className }: { className?: string }) {
  // Mobile refs
  const mobileContainerRef = React.useRef<HTMLDivElement>(null)
  const mobileUserMessageRef = React.useRef<HTMLDivElement>(null)
  const mobileRouterRef = React.useRef<HTMLDivElement>(null)
  const mobileVisionRef = React.useRef<HTMLDivElement>(null)

  // Desktop refs
  const desktopContainerRef = React.useRef<HTMLDivElement>(null)
  const desktopUserMessageRef = React.useRef<HTMLDivElement>(null)
  const desktopRouterRef = React.useRef<HTMLDivElement>(null)
  const desktopVisionRef = React.useRef<HTMLDivElement>(null)
  const desktopChatRef = React.useRef<HTMLDivElement>(null)
  const desktopToolsRef = React.useRef<HTMLDivElement>(null)

  return (
    <div
      className={cn("relative flex items-center justify-center p-8", className)}
      aria-label="Workflow architecture diagram"
    >
      {/* Mobile: Vertical layout */}
      <div ref={mobileContainerRef} className="flex flex-col items-center gap-6 md:hidden relative w-full">
        {/* Input */}
        <div ref={mobileUserMessageRef} className="flex flex-col items-center gap-3 z-10">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-primary bg-primary/10">
            <MessageSquare className="h-8 w-8 text-primary" />
          </div>
          <span className="text-sm font-medium text-foreground">User Message</span>
        </div>

        {/* Router LLM */}
        <div ref={mobileRouterRef} className="flex flex-col items-center gap-3 z-10">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-accent bg-accent/10">
            <Brain className="h-8 w-8 text-accent" />
          </div>
          <span className="text-sm font-medium text-foreground">Router LLM</span>
        </div>

        {/* Workers */}
        <div className="flex flex-col gap-4 z-10">
          <div ref={mobileVisionRef} className="flex flex-col items-center gap-3">
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

        {/* Animated connections for mobile */}
        <AnimatedBeam
          containerRef={mobileContainerRef}
          fromRef={mobileUserMessageRef}
          toRef={mobileRouterRef}
          straight={true}
          className="md:hidden z-0"
        />
        <AnimatedBeam
          containerRef={mobileContainerRef}
          fromRef={mobileRouterRef}
          toRef={mobileVisionRef}
          straight={true}
          className="md:hidden z-0"
        />
      </div>

      {/* Desktop: Horizontal layout */}
      <div ref={desktopContainerRef} className="hidden md:flex items-center justify-center gap-8 lg:gap-12 relative w-full max-w-3xl">
        {/* Input */}
        <div ref={desktopUserMessageRef} className="flex flex-col items-center gap-3 pb-3 z-10">
          <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-primary bg-primary/10 shadow-sm">
            <MessageSquare className="h-10 w-10 text-primary" />
          </div>
          <span className="text-sm font-medium text-foreground">User Message</span>
        </div>

        {/* Router LLM */}
        <div ref={desktopRouterRef} className="flex flex-col items-center gap-3 pb-3 z-10">
          <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-accent bg-accent/10 shadow-sm">
            <Brain className="h-10 w-10 text-accent" />
          </div>
          <span className="text-sm font-medium text-foreground">Router LLM</span>
        </div>

        {/* Workers */}
        <div className="flex flex-col gap-3 z-10">
          <div className="flex items-center gap-4">
            <div ref={desktopVisionRef} className="flex flex-col items-center gap-2 pb-3">
              <div className="flex h-16 w-16 items-center justify-center rounded-lg border-2 border-primary bg-primary/10 shadow-sm">
                <Eye className="h-8 w-8 text-primary" />
              </div>
              <span className="text-xs font-medium text-foreground">Vision</span>
            </div>
            <div ref={desktopChatRef} className="flex flex-col items-center gap-2 pb-3">
              <div className="flex h-16 w-16 items-center justify-center rounded-lg border-2 border-primary bg-primary/10 shadow-sm">
                <MessageSquare className="h-8 w-8 text-primary" />
              </div>
              <span className="text-xs font-medium text-foreground">Chat</span>
            </div>
            <div ref={desktopToolsRef} className="flex flex-col items-center gap-2 pb-3">
              <div className="flex h-16 w-16 items-center justify-center rounded-lg border-2 border-primary bg-primary/10 shadow-sm">
                <Zap className="h-8 w-8 text-primary" />
              </div>
              <span className="text-xs font-medium text-foreground">Tools</span>
            </div>
          </div>
        </div>

        {/* Animated connections for desktop */}
        <AnimatedBeam
          containerRef={desktopContainerRef}
          fromRef={desktopUserMessageRef}
          toRef={desktopRouterRef}
          straight={true}
          connectFromBottom={true}
          connectToBottom={true}
          className="hidden md:block z-0"
        />
        <AnimatedBeam
          containerRef={desktopContainerRef}
          fromRef={desktopRouterRef}
          toRef={desktopVisionRef}
          straight={false}
          curvature={80}
          curveDown={true}
          connectFromBottom={true}
          connectToBottom={true}
          className="hidden md:block z-0"
        />
        <AnimatedBeam
          containerRef={desktopContainerRef}
          fromRef={desktopRouterRef}
          toRef={desktopChatRef}
          straight={false}
          curvature={80}
          curveDown={true}
          connectFromBottom={true}
          connectToBottom={true}
          className="hidden md:block z-0"
        />
        <AnimatedBeam
          containerRef={desktopContainerRef}
          fromRef={desktopRouterRef}
          toRef={desktopToolsRef}
          straight={false}
          curvature={80}
          curveDown={true}
          connectFromBottom={true}
          connectToBottom={true}
          className="hidden md:block z-0"
        />
      </div>
    </div>
  )
}
