import type React from "react"
import type { Metadata, Viewport } from "next"
import { Space_Grotesk, JetBrains_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { ThemeProvider } from "@/components/theme-provider"
import "./globals.css"

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
})

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://projectnexus.dev"),
  title: {
    default: "Nexus - Intelligent Workflow Orchestration",
    template: "%s | Nexus",
  },
  description: "Nexus - Intelligent workflow orchestration platform. Multi-tenant event-driven orchestrator powered by Apache Pulsar. Route messages with LLM intelligence, process documents with modern AI vision, and execute tools via MCP. Enterprise-grade workflow automation with real-time monitoring and AI-powered tool execution.",
  keywords: [
    "workflow orchestration",
    "event-driven architecture",
    "Apache Pulsar",
    "LLM routing",
    "AI vision",
    "MCP integration",
    "multi-tenant",
    "workflow automation",
    "message queue",
    "distributed systems",
    "AI orchestration",
    "enterprise automation",
    "Google Workspace",
    "Notion integration",
    "n8n automation",
    "Sequential Thinking",
    "LangChain",
    "GitHub integration",
    "Playwright automation",
    "Exa Search",
    "Google Maps",
  ],
  authors: [{ name: "Project Nexus Team" }],
  creator: "Project Nexus",
  publisher: "Project Nexus",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: "Nexus",
    title: "Nexus - Intelligent Workflow Orchestration",
    description: "Multi-tenant event-driven orchestrator powered by Apache Pulsar. Route messages with LLM intelligence, process documents with modern AI vision, and execute tools via MCP.",
    images: [
      {
        url: "/images/chatgpt-20image-20jun-2023-2c-202025-2c-2003-53-12-20pm.png",
        width: 1200,
        height: 630,
        alt: "Nexus - Intelligent Workflow Orchestration",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Nexus - Intelligent Workflow Orchestration",
    description: "Multi-tenant event-driven orchestrator powered by Apache Pulsar with LLM routing and AI vision.",
    images: ["/images/chatgpt-20image-20jun-2023-2c-202025-2c-2003-53-12-20pm.png"],
    creator: "@projectnexus",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      {
        url: "/images/chatgpt-20image-20jun-2023-2c-202025-2c-2003-53-12-20pm.png",
        sizes: "32x32",
        type: "image/png",
      },
      {
        url: "/images/chatgpt-20image-20jun-2023-2c-202025-2c-2003-53-12-20pm.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
    ],
    apple: [
      {
        url: "/images/chatgpt-20image-20jun-2023-2c-202025-2c-2003-53-12-20pm.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
    shortcut: "/images/chatgpt-20image-20jun-2023-2c-202025-2c-2003-53-12-20pm.png",
  },
  manifest: "/manifest.json",
  category: "technology",
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0f" },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        <ThemeProvider>
          {children}
          <footer className="py-6 border-t border-border mt-auto">
            <div className="container mx-auto px-4 flex flex-col md:flex-row justify-between items-center text-sm text-muted-foreground gap-4">
              <div className="flex gap-4">
                <a href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</a>
                <a href="/terms" className="hover:text-foreground transition-colors">Terms of Service</a>
              </div>
              <div className="flex gap-4 items-center">
                <span>© 2026 Project Nexus</span>
                <a href="https://github.com/mcpmessenger/project-nexus-v2" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors" title="View on GitHub">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-github"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" /><path d="M9 18c-4.51 2-5-2-7-2" /></svg>
                </a>
              </div>
            </div>
          </footer>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
