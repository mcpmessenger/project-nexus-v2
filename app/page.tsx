import type { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { ShinyButton } from "@/components/ui/shiny-button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { WorkflowDiagram } from "@/components/workflow-diagram"
import { RetroGrid } from "@/components/ui/retro-grid"
import { WordPullUp } from "@/components/ui/word-pull-up"
import { BentoGrid, BentoCard } from "@/components/ui/bento-grid"
import { BorderBeam } from "@/components/ui/border-beam"
import { Marquee } from "@/components/ui/marquee"
import {
  ArrowRight,
  Brain,
  Eye,
  Network,
  Shield,
  Zap,
  Activity,
  CheckCircle2,
  Github,
  FileText,
  ExternalLink,
  Lock,
  Rocket,
} from "lucide-react"

export const metadata: Metadata = {
  title: "Give your AI hands. Connect any tool to any model with Nexus",
  description: "Stop switching between 10 different AI tools. Bring your own data and tools into one chat. Enterprise-grade workflow orchestration with MCP integration.",
  openGraph: {
    title: "Nexus - Give your AI hands",
    description: "Connect any tool to any model. Enterprise-grade workflow orchestration with MCP integration.",
  },
}

export default function LandingPage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Nexus",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description: "Multi-tenant event-driven orchestrator powered by Apache Pulsar. Route messages with LLM intelligence, process documents with modern AI vision, and execute tools via MCP.",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    featureList: [
      "Intelligent Message Routing",
      "Extract Data Effortlessly",
      "Never Lose a Task",
      "Enterprise-Grade Security",
      "MCP Integration",
      "Real-Time Monitoring",
      "Google Workspace Integration",
      "Notion Workspace Management",
      "n8n Automation Workflows",
      "LangChain Agent Orchestration",
    ],
  }

  const mcpServers = [
    { name: "MCP", icon: "/images/mcpwhtbggd.png", serverId: null },
    { name: "GitHub", icon: "/images/Octicons-mark-github.svg.png", serverId: "github" },
    { name: "Google Maps", icon: "/images/Google_Maps_icon_(2020).svg", serverId: "maps" },
    { name: "Exa Search", icon: "/images/exa-color.png", serverId: "exa" },
    { name: "Playwright", icon: "/images/playwright.png", serverId: "playwright" },
    { name: "LangChain", icon: "/images/mcpwhtbggd.png", serverId: "langchain" },
    { name: "Notion", icon: "/images/Notion-logo.svg.png", serverId: "notion" },
    { name: "n8n", icon: "/images/N8n-logo-new.svg.png", serverId: "n8n" },
  ]

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <div className="flex min-h-screen flex-col">
        {/* Hero Section */}
        <section className="relative overflow-hidden border-b border-border bg-gradient-to-br from-background via-background to-primary/5 px-6 py-24 lg:py-32">
          <RetroGrid className="absolute inset-0 opacity-40" />
          <div className="relative mx-auto max-w-screen-xl">
            <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
              <div className="flex flex-col justify-center">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/10 px-4 py-1.5 text-sm font-medium text-accent">
                  <Rocket className="h-4 w-4" />
                  MCP-Powered
                </div>
                <h1 className="mb-6 text-balance text-5xl font-bold leading-tight tracking-tight text-foreground lg:text-6xl">
                  <WordPullUp words="Give your AI hands" className="block mb-2" />
                  <span className="block text-4xl lg:text-5xl text-muted-foreground font-normal mt-2">
                    Connect any tool to any model with Nexus
                  </span>
                </h1>
                <p className="mb-8 text-pretty text-xl leading-relaxed text-muted-foreground">
                  Stop switching between 10 different AI tools. Bring your own data and tools into one chat. Secure, local, and enterprise-ready.
                </p>
                <div className="flex flex-wrap gap-4">
                  <ShinyButton size="lg" asChild>
                    <Link href="/workflows">
                      Get Started Free
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </ShinyButton>
                  <Button size="lg" variant="outline" asChild>
                    <Link href="/monitoring">Explore Features</Link>
                  </Button>
                </div>
                <p className="mt-4 text-sm text-muted-foreground flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  Secure • Runs locally or via secure tokens
                </p>
              </div>

              <div className="relative flex items-center justify-center">
                <div className="relative w-full max-w-md">
                  <BorderBeam className="rounded-2xl" />
                  <WorkflowDiagram className="w-full p-8" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* MCP Servers Marquee */}
        <section className="border-b border-border bg-muted/30 px-6 py-12">
          <div className="mx-auto max-w-screen-xl">
            <p className="mb-6 text-center text-sm font-medium text-muted-foreground">
              Works with your favorite tools
            </p>
            <div className="py-6">
              <Marquee pauseOnHover className="[--duration:30s]">
                {mcpServers.map((server, i) => {
                  const href = server.serverId
                    ? `/monitoring?server=${server.serverId}`
                    : "/monitoring"
                  const isGitHub = server.serverId === "github"
                  const isN8n = server.serverId === "n8n"
                  return (
                    <Link
                      key={`server-${i}`}
                      href={href}
                      className="flex items-center justify-center px-8 py-2 hover:scale-110 transition-transform duration-200"
                    >
                      <Image
                        src={server.icon}
                        alt={server.name}
                        width={isN8n ? 80 : 48}
                        height={isN8n ? 80 : 48}
                        className={`${isN8n ? "h-20 w-20" : "h-12 w-12"} object-contain opacity-100 hover:opacity-90 transition-opacity ${isGitHub ? "dark:brightness-0 dark:invert" : ""
                          }`}
                      />
                    </Link>
                  )
                })}
              </Marquee>
            </div>
          </div>
        </section>

        {/* Features Section - Bento Grid */}
        <section className="px-6 py-24">
          <div className="mx-auto max-w-screen-xl">
            <div className="mb-16 text-center">
              <h2 className="mb-4 text-balance text-4xl font-bold text-foreground">Why Nexus?</h2>
              <p className="text-pretty text-lg text-muted-foreground">
                Everything you need to build mission-critical AI workflows
              </p>
            </div>

            <BentoGrid>
              <BentoCard
                className="md:col-span-2"
                name="Intelligent Message Routing"
                description="Automatically classifies and routes messages, eliminating manual configuration. High-speed traffic control directs messages to vision, tool execution, or chat workers."
                icon={
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                    <Brain className="h-6 w-6 text-primary" />
                  </div>
                }
              />
              <BentoCard
                name="Extract Data Effortlessly"
                description="Turn invoices and handwritten notes into structured data in seconds. Layout-aware OCR with table preservation."
                icon={
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-accent/10">
                    <Eye className="h-6 w-6 text-accent" />
                  </div>
                }
              />
              <BentoCard
                name="Never Lose a Task"
                description="Individual message acknowledgment ensures zero data loss. No task is lost, even when workers fail mid-execution."
                icon={
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                    <Network className="h-6 w-6 text-primary" />
                  </div>
                }
              />
              <BentoCard
                className="md:col-span-2"
                name="Enterprise-Grade Security"
                description="OAuth2 integration with isolated Pulsar tenants and namespaces ensures complete data isolation. Multi-tenant architecture with enterprise-grade security."
                icon={
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-accent/10">
                    <Shield className="h-6 w-6 text-accent" />
                  </div>
                }
              />
              <BentoCard
                name="MCP Integration"
                description="Execute tools via Model Context Protocol. Integrate Stripe payments, database operations, and custom workflows."
                icon={
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                    <Zap className="h-6 w-6 text-primary" />
                  </div>
                }
              />
              <BentoCard
                name="Real-Time Monitoring"
                description="Track worker status, consumer lag, and task completion in real time. Prometheus metrics and Grafana dashboards."
                icon={
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-accent/10">
                    <Activity className="h-6 w-6 text-accent" />
                  </div>
                }
              />
            </BentoGrid>
          </div>
        </section>

        {/* CTA Section */}
        <section className="border-t border-border bg-primary/5 px-6 py-24">
          <div className="mx-auto max-w-screen-xl text-center">
            <h2 className="mb-4 text-balance text-4xl font-bold text-foreground">
              Ready to give your AI hands?
            </h2>
            <p className="mb-8 text-pretty text-lg text-muted-foreground">
              Deploy your first workflow in minutes. No credit card required.
            </p>
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <ShinyButton size="lg" asChild>
                <Link href="/workflows">
                  Get Started Free
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </ShinyButton>
              <Button size="lg" variant="outline" asChild>
                <Link href="https://github.com/mcpmessenger/project-nexus-v2" target="_blank" rel="noopener noreferrer">
                  <FileText className="mr-2 h-4 w-4" />
                  Documentation
                  <ExternalLink className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>

          </div>
        </section>


      </div>
    </>
  )
}
