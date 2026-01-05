"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface BentoGridProps {
  className?: string
  children?: React.ReactNode
}

export function BentoGrid({ className, children }: BentoGridProps) {
  return (
    <div
      className={cn(
        "grid md:auto-rows-[18rem] grid-cols-1 md:grid-cols-3 gap-4 max-w-7xl mx-auto",
        className,
      )}
    >
      {children}
    </div>
  )
}

interface BentoCardProps {
  className?: string
  name?: string
  description?: string
  header?: React.ReactNode
  icon?: React.ReactNode
  href?: string
}

export function BentoCard({
  className,
  name,
  description,
  header,
  icon,
  href,
}: BentoCardProps) {
  return (
    <div
      className={cn(
        "row-span-1 rounded-xl group/bento hover:shadow-xl transition duration-200 p-6 bg-card border border-border justify-between flex flex-col space-y-4",
        className,
      )}
    >
      {header}
      <div className="group-hover/bento:translate-x-2 transition duration-200">
        {icon}
        <div className="font-sans font-bold text-foreground mb-2 mt-2">
          {name}
        </div>
        <div className="font-sans font-normal text-muted-foreground text-sm">
          {description}
        </div>
      </div>
    </div>
  )
}
