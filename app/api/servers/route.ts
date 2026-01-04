import { NextResponse } from "next/server"

// Mock servers endpoint - in production, this would fetch from Supabase
export async function GET() {
  const systemServers = [
    {
      id: "brave",
      name: "Brave Search",
      type: "system" as const,
      enabled: true,
      logoUrl: "/images/Brave-web-browser-logo-transparent-PNG-image-jpg.webp",
      transport: "http" as const,
      rateLimit: 60,
      description: "Web search using Brave Search API",
    },
    {
      id: "maps",
      name: "Google Maps Grounding",
      type: "system" as const,
      enabled: true,
      logoUrl: "/images/Google_Maps_icon_(2020).svg",
      transport: "http" as const,
      rateLimit: 100,
      description: "Location search and mapping services",
    },
    {
      id: "playwright",
      name: "Playwright",
      type: "system" as const,
      enabled: true,
      logoUrl: "/images/playwright.png",
      transport: "http" as const,
      rateLimit: 10,
      description: "Browser automation and web scraping",
    },
    {
      id: "github",
      name: "GitHub",
      type: "system" as const,
      enabled: true,
      logoUrl: "/images/Octicons-mark-github.svg.png",
      transport: "http" as const,
      rateLimit: 60,
      description: "GitHub repository and code management",
    },
  ]

  // Mock user servers (in production, fetch from Supabase)
  const userServers: any[] = []

  return NextResponse.json({
    system: systemServers,
    user: userServers,
  })
}
