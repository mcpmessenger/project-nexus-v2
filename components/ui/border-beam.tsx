"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface BorderBeamProps {
  className?: string
  size?: number
  duration?: number
  borderWidth?: number
  anchor?: number
  colorFrom?: string
  colorTo?: string
  delay?: number
}

export function BorderBeam({
  className,
  size = 200,
  duration = 15,
  anchor = 90,
  borderWidth = 1.5,
  colorFrom = "hsl(var(--accent))",
  colorTo = "hsl(var(--primary))",
  delay = 0,
}: BorderBeamProps) {
  return (
    <div
      style={
        {
          "--size": size,
          "--duration": duration,
          "--anchor": anchor,
          "--border-width": borderWidth,
          "--color-from": colorFrom,
          "--color-to": colorTo,
          "--delay": `-${delay}s`,
        } as React.CSSProperties
      }
      className={cn(
        "pointer-events-none absolute inset-0 rounded-[inherit] [border:calc(var(--border-width)*1px)_solid_transparent]",
        // mask styles
        "[mask-clip:padding-box,border-box] [mask-composite:intersect] [mask-image:linear-gradient(transparent,transparent),linear-gradient(white,white)]",
        // pseudo element that creates the border
        "after:absolute after:inset-0 after:rounded-[inherit] after:[border:calc(var(--border-width)*1px)_solid_transparent] after:[background:linear-gradient(transparent,transparent),conic-gradient(from_calc((var(--anchor)*1deg)),transparent_0,var(--color-from)_25%,var(--color-to)_50%,var(--color-from)_75%,transparent_100%)] after:[background-size:200%_200%,200%_200%] after:[background-clip:padding-box,border-box] after:[mask-clip:padding-box,border-box] after:[mask-composite:intersect] after:[mask-image:linear-gradient(transparent,transparent),linear-gradient(white,white)]",
        // animation
        "after:[animation:border-beam_calc(var(--duration)*1s)_linear_infinite]",
        className,
      )}
    >
      <style jsx>{`
        @keyframes border-beam {
          100% {
            background-position: calc(var(--anchor) * 1px) calc(var(--anchor) * 1px), calc(var(--anchor) * 1px)
              calc(var(--anchor) * 1px);
          }
        }
      `}</style>
    </div>
  )
}
