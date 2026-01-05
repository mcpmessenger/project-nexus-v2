"use client"

import { cn } from "@/lib/utils"

export function DotPattern({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 [background-image:radial-gradient(circle_at_1px_1px,hsl(var(--muted-foreground))_1px,transparent_0)] [background-size:16px_16px] opacity-30",
        className,
      )}
      {...props}
    />
  )
}
