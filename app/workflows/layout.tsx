import type { Metadata } from "next"
import type React from "react"
import { AuthProvider } from "@/components/auth-provider"
import { Navbar } from "@/components/navbar"

export const metadata: Metadata = {
  title: "Chat",
  description: "AI-powered chat interface with workflow orchestration. Process images, execute tools, and create automated workflows with LLM intelligence.",
  openGraph: {
    title: "Chat | Nexus",
    description: "AI-powered chat interface with workflow orchestration and tool execution.",
  },
}

export default function WorkflowsLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <main className="flex-1 bg-muted/30">{children}</main>
      </div>
    </AuthProvider>
  )
}
