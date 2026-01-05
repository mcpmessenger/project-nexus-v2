"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface AnimatedBeamProps {
  className?: string
  containerRef: React.RefObject<HTMLElement>
  fromRef: React.RefObject<HTMLElement>
  toRef: React.RefObject<HTMLElement>
  straight?: boolean
  curvature?: number
  curveDown?: boolean
  connectToBottom?: boolean
  connectFromBottom?: boolean
}

export function AnimatedBeam({ 
  className, 
  containerRef, 
  fromRef, 
  toRef, 
  straight = false,
  curvature = 50,
  curveDown = false,
  connectToBottom = false,
  connectFromBottom = false
}: AnimatedBeamProps) {
  const [path, setPath] = React.useState("")

  React.useEffect(() => {
    const updatePath = () => {
      const container = containerRef.current
      const from = fromRef.current
      const to = toRef.current

      if (!container || !from || !to) return

      const containerRect = container.getBoundingClientRect()
      const fromRect = from.getBoundingClientRect()
      const toRect = to.getBoundingClientRect()

      const fromX = fromRect.left + fromRect.width / 2 - containerRect.left
      const fromY = connectFromBottom
        ? fromRect.top + fromRect.height - containerRect.top - 12 // Connect from bottom with gap below text
        : fromRect.top + fromRect.height / 2 - containerRect.top
      const toX = toRect.left + toRect.width / 2 - containerRect.left
      const toY = connectToBottom 
        ? toRect.top + toRect.height - containerRect.top - 12 // Connect to bottom with gap below text
        : toRect.top + toRect.height / 2 - containerRect.top

      if (straight) {
        setPath(`M ${fromX} ${fromY} L ${toX} ${toY}`)
      } else {
        const midX = (fromX + toX) / 2
        const controlY = curveDown ? Math.max(fromY, toY) + curvature : fromY - curvature
        setPath(`M ${fromX} ${fromY} Q ${midX} ${controlY} ${toX} ${toY}`)
      }
    }

    updatePath()
    window.addEventListener("resize", updatePath)
    return () => window.removeEventListener("resize", updatePath)
  }, [containerRef, fromRef, toRef, straight, curvature, curveDown, connectToBottom, connectFromBottom])

  if (!path) return null

  return (
    <svg
      className={cn("pointer-events-none absolute inset-0 size-full overflow-visible", className)}
      style={{ color: "var(--muted-foreground)" }}
    >
      <path
        d={path}
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
        strokeDasharray="8 4"
        strokeOpacity="0.6"
        className="animate-[dash_3s_linear_infinite]"
      />
    </svg>
  )
}
