"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface WordPullUpProps {
  words: string
  className?: string
  delay?: number
}

export function WordPullUp({ words, className, delay = 0.05 }: WordPullUpProps) {
  const wordArray = words.split(" ")

  return (
    <div className={cn("flex flex-wrap", className)}>
      {wordArray.map((word, i) => (
        <span
          key={`${word}-${i}`}
          className="inline-block animate-[pull-up_0.65s_ease-out] opacity-0"
          style={{
            animationDelay: `${i * delay}s`,
            animationFillMode: "forwards",
          }}
        >
          {word === "" ? <span>&nbsp;</span> : (
            <span className="bg-gradient-to-b from-foreground to-foreground/70 bg-clip-text">
              {word}
            </span>
          )}
        </span>
      ))}
    </div>
  )
}
