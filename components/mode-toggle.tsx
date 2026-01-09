"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"
import { HoverIconButton } from "@/components/ui/hover-icon-button"

export function ModeToggle({ className }: { className?: string }) {
    const { theme, toggleTheme } = useTheme()

    return (
        <div suppressHydrationWarning>
            <HoverIconButton onClick={toggleTheme} className={`h-9 w-9 ${className}`} title="Toggle theme">
                {theme === "light" ? <Moon className="h-[18px] w-[18px]" /> : <Sun className="h-[18px] w-[18px]" />}
            </HoverIconButton>
        </div>
    )
}
