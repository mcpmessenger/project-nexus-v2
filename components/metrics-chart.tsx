"use client"

import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { useTheme } from "@/components/theme-provider"

interface MetricsChartProps {
  title: string
  description?: string
  data: Array<{ time: string; value: number }>
  color?: string
}

// Helper function to get computed CSS variable value
function getCSSVariable(varName: string): string {
  if (typeof window === "undefined") return ""
  const root = document.documentElement
  const value = getComputedStyle(root).getPropertyValue(varName).trim()
  return value ? `hsl(${value})` : ""
}

export function MetricsChart({ title, description, data, color = "hsl(var(--accent))" }: MetricsChartProps) {
  const { theme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  const [computedColors, setComputedColors] = React.useState({
    border: "hsl(var(--border))",
    mutedForeground: "hsl(var(--muted-foreground))",
    popover: "hsl(var(--popover))",
    popoverForeground: "hsl(var(--popover-foreground))",
    chartColor: color,
  })
  
  // Generate unique gradient ID for each chart instance
  const gradientId = React.useMemo(
    () => `gradient-${title.replace(/\s+/g, "-").toLowerCase()}-${Math.random().toString(36).substr(2, 9)}`,
    [title]
  )

  // Update computed colors when theme changes or component mounts
  React.useEffect(() => {
    if (typeof window === "undefined") return

    const updateColors = () => {
      // Extract CSS variable name from color string (e.g., "hsl(var(--primary))" -> "--primary")
      const getVarName = (colorStr: string): string => {
        const match = colorStr.match(/var\(([^)]+)\)/)
        return match ? match[1].trim() : ""
      }

      const chartVarName = getVarName(color)
      const chartColorValue = chartVarName ? getCSSVariable(chartVarName) : color

      setComputedColors({
        border: getCSSVariable("--border") || "hsl(var(--border))",
        mutedForeground: getCSSVariable("--muted-foreground") || "hsl(var(--muted-foreground))",
        popover: getCSSVariable("--popover") || "hsl(var(--popover))",
        popoverForeground: getCSSVariable("--popover-foreground") || "hsl(var(--popover-foreground))",
        chartColor: chartColorValue || color,
      })
    }

    setMounted(true)
    updateColors()

    // Listen for theme changes by observing class changes on document
    const observer = new MutationObserver(updateColors)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    })

    return () => observer.disconnect()
  }, [theme, color])

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={computedColors.chartColor} stopOpacity={0.4} />
                <stop offset="95%" stopColor={computedColors.chartColor} stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke={computedColors.border} 
              opacity={0.5}
            />
            <XAxis
              dataKey="time"
              stroke={computedColors.mutedForeground}
              fill={computedColors.mutedForeground}
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tick={{ fill: computedColors.mutedForeground }}
            />
            <YAxis 
              stroke={computedColors.mutedForeground}
              fill={computedColors.mutedForeground}
              fontSize={12} 
              tickLine={false} 
              axisLine={false}
              tick={{ fill: computedColors.mutedForeground }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: computedColors.popover,
                border: `1px solid ${computedColors.border}`,
                borderRadius: "var(--radius)",
                color: computedColors.popoverForeground,
              }}
              labelStyle={{
                color: computedColors.popoverForeground,
              }}
              itemStyle={{
                color: computedColors.popoverForeground,
              }}
            />
            <Area 
              type="monotone" 
              dataKey="value" 
              stroke={computedColors.chartColor} 
              strokeWidth={2}
              fillOpacity={1} 
              fill={`url(#${gradientId})`}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
