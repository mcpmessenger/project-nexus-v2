"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider, type ThemeProviderProps, useTheme as useNextTheme } from "next-themes"

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange {...props}>
      {children}
    </NextThemesProvider>
  )
}

export function useTheme() {
  const { theme, setTheme, systemTheme } = useNextTheme()
  const currentTheme = theme === "system" ? systemTheme : theme

  const toggleTheme = React.useCallback(() => {
    setTheme(currentTheme === "dark" ? "light" : "dark")
  }, [currentTheme, setTheme])

  return { theme: currentTheme, setTheme, toggleTheme }
}
