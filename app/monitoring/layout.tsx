import type { Metadata } from "next"
import type React from "react"
import { AuthProvider } from "@/components/auth-provider"
import { Navbar } from "@/components/navbar"

export const metadata: Metadata = {
  title: "Registry",
  description: "MCP server registry and system management. Manage Model Context Protocol servers and monitor system health.",
  openGraph: {
    title: "Registry | Nexus",
    description: "MCP server registry and system management dashboard.",
  },
}

export default function MonitoringLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <main className="flex-1 bg-muted/30">{children}</main>
      </div>
    </AuthProvider>
  )
}
