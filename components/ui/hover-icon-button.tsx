"use client"

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cn } from "@/lib/utils"

interface HoverIconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode
  asChild?: boolean
}

const HoverIconButton = React.forwardRef<HTMLButtonElement, HoverIconButtonProps>(
  ({ className, children, asChild = false, ...props }, ref) => {
    const buttonRef = React.useRef<HTMLButtonElement>(null)
    const [isListening, setIsListening] = React.useState(false)
    const [circles, setCircles] = React.useState<Array<{
      id: number
      x: number
      y: number
      color: string
      fadeState: "in" | "out" | null
    }>>([])
    const lastAddedRef = React.useRef(0)

    const createCircle = React.useCallback((x: number, y: number) => {
      const buttonWidth = buttonRef.current?.offsetWidth || 0
      const buttonHeight = buttonRef.current?.offsetHeight || 0
      const xPos = buttonWidth > 0 ? x / buttonWidth : 0.5
      const color = `linear-gradient(to right, var(--circle-start) ${xPos * 100}%, var(--circle-end) ${
        xPos * 100
      }%)`

      setCircles((prev) => [
        ...prev,
        { id: Date.now(), x, y, color, fadeState: null },
      ])
    }, [])

    const handlePointerMove = React.useCallback(
      (event: React.PointerEvent<HTMLButtonElement>) => {
        if (!isListening) return
        
        const currentTime = Date.now()
        if (currentTime - lastAddedRef.current > 100) {
          lastAddedRef.current = currentTime
          const rect = event.currentTarget.getBoundingClientRect()
          const x = event.clientX - rect.left
          const y = event.clientY - rect.top
          createCircle(x, y)
        }
      },
      [isListening, createCircle]
    )

    const handlePointerEnter = React.useCallback(() => {
      setIsListening(true)
    }, [])

    const handlePointerLeave = React.useCallback(() => {
      setIsListening(false)
    }, [])

    React.useEffect(() => {
      circles.forEach((circle) => {
        if (!circle.fadeState) {
          setTimeout(() => {
            setCircles((prev) =>
              prev.map((c) =>
                c.id === circle.id ? { ...c, fadeState: "in" } : c
              )
            )
          }, 0)

          setTimeout(() => {
            setCircles((prev) =>
              prev.map((c) =>
                c.id === circle.id ? { ...c, fadeState: "out" } : c
              )
            )
          }, 1000)

          setTimeout(() => {
            setCircles((prev) => prev.filter((c) => c.id !== circle.id))
          }, 2200)
        }
      })
    }, [circles])

    const mergedRef = React.useCallback((node: HTMLButtonElement | null) => {
      if (typeof ref === "function") {
        ref(node)
      } else if (ref) {
        ref.current = node
      }
      buttonRef.current = node
    }, [ref])

    if (asChild) {
      // For asChild, wrap in a span to capture pointer events
      return (
        <span
          ref={(node) => {
            buttonRef.current = node as any
            if (typeof ref === "function") {
              ref(node as any)
            } else if (ref) {
              ref.current = node as any
            }
          }}
          className={cn(
            "relative isolate overflow-hidden rounded-md inline-block",
            className
          )}
          onPointerMove={handlePointerMove as any}
          onPointerEnter={handlePointerEnter as any}
          onPointerLeave={handlePointerLeave as any}
          style={{
            "--circle-start": "var(--tw-gradient-from, #a0d9f8)",
            "--circle-end": "var(--tw-gradient-to, #3a5bbf)",
            ...props.style,
          } as React.CSSProperties}
        >
          {circles.map(({ id, x, y, color, fadeState }) => (
            <div
              key={id}
              className={cn(
                "absolute w-3 h-3 -translate-x-1/2 -translate-y-1/2 rounded-full",
                "blur-lg pointer-events-none z-[-1] transition-opacity duration-300",
                fadeState === "in" && "opacity-75",
                fadeState === "out" && "opacity-0 duration-[1.2s]",
                !fadeState && "opacity-0"
              )}
              style={{
                left: x,
                top: y,
                background: color,
              }}
            />
          ))}
          <Slot {...props} className={cn("cursor-pointer inline-flex items-center justify-center", props.className)}>
            {children}
          </Slot>
        </span>
      )
    }

    return (
      <button
        ref={mergedRef}
        className={cn(
          "relative isolate overflow-hidden rounded-md",
          "cursor-pointer inline-flex items-center justify-center",
          className
        )}
        onPointerMove={handlePointerMove}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        {...props}
        style={{
          "--circle-start": "var(--tw-gradient-from, #a0d9f8)",
          "--circle-end": "var(--tw-gradient-to, #3a5bbf)",
          ...props.style,
        } as React.CSSProperties}
      >
        {circles.map(({ id, x, y, color, fadeState }) => (
          <div
            key={id}
            className={cn(
              "absolute w-3 h-3 -translate-x-1/2 -translate-y-1/2 rounded-full",
              "blur-lg pointer-events-none z-[-1] transition-opacity duration-300",
              fadeState === "in" && "opacity-75",
              fadeState === "out" && "opacity-0 duration-[1.2s]",
              !fadeState && "opacity-0"
            )}
            style={{
              left: x,
              top: y,
              background: color,
            }}
          />
        ))}
        {children}
      </button>
    )
  }
)

HoverIconButton.displayName = "HoverIconButton"

export { HoverIconButton }
