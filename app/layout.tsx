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
        <ThemeProvider>{children}</ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
