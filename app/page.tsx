import type { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowRight, Brain, Eye, Network, Shield, Zap, Activity } from "lucide-react"

export const metadata: Metadata = {
  title: "Home",
  description: "Intelligent workflow orchestration platform. Multi-tenant event-driven orchestrator powered by Apache Pulsar with LLM routing, AI vision, and MCP integration.",
  openGraph: {
    title: "Nexus - Intelligent Workflow Orchestration",
    description: "Multi-tenant event-driven orchestrator powered by Apache Pulsar. Route messages with LLM intelligence, process documents with modern AI vision.",
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
      "Router LLM",
      "Modern AI Vision",
      "Pulsar Backbone",
      "Multi-Tenancy",
      "MCP Integration",
      "Real-Time Monitoring",
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <div className="flex min-h-screen flex-col">
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-border bg-gradient-to-br from-background via-background to-primary/5 px-6 py-24 lg:py-32">
        <div className="mx-auto max-w-screen-xl">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
            <div className="flex flex-col justify-center">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/10 px-4 py-1.5 text-sm font-medium text-accent">
                <Zap className="h-4 w-4" />
                Event-Driven Architecture
              </div>
              <h1 className="mb-6 text-balance text-5xl font-bold leading-tight tracking-tight text-foreground lg:text-6xl">
                Intelligent Workflow Orchestration
              </h1>
              <p className="mb-8 text-pretty text-xl leading-relaxed text-muted-foreground">
                Multi-tenant orchestrator powered by Apache Pulsar. Route messages with LLM intelligence, process
                documents with modern AI vision, and never lose a task.
              </p>
              <div className="flex flex-wrap gap-4">
                <Button size="lg" asChild>
                  <Link href="/workflows">
                    Launch Chat
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="/monitoring">Registry</Link>
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-center">
              <div className="relative">
                <Image
                  src="/images/chatgpt-20image-20jun-2023-2c-202025-2c-2003-53-12-20pm.png"
                  alt="Project Nexus Logo"
                  width={400}
                  height={400}
                  className="h-auto w-full max-w-md"
                  priority
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="px-6 py-24">
        <div className="mx-auto max-w-screen-xl">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-balance text-4xl font-bold text-foreground">Core Capabilities</h2>
            <p className="text-pretty text-lg text-muted-foreground">
              Enterprise-grade features for mission-critical workflows
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            <Card className="border-border bg-card">
              <CardHeader>
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Brain className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Router LLM</CardTitle>
                <CardDescription>
                  High-speed traffic control that classifies and routes messages to vision, tool execution, or chat
                  workers
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader>
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-accent/10">
                  <Eye className="h-6 w-6 text-accent" />
                </div>
                <CardTitle>Modern AI Vision</CardTitle>
                <CardDescription>
                  Layout-aware OCR with table preservation. Extract structured data from invoices, receipts, and
                  handwritten notes
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader>
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Network className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Pulsar Backbone</CardTitle>
                <CardDescription>
                  Individual message acknowledgment ensures no task is lost, even when workers fail mid-execution
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader>
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-accent/10">
                  <Shield className="h-6 w-6 text-accent" />
                </div>
                <CardTitle>Multi-Tenancy</CardTitle>
                <CardDescription>
                  OAuth2 integration with isolated Pulsar tenants and namespaces. Enterprise-grade security and data
                  isolation
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader>
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Zap className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>MCP Integration</CardTitle>
                <CardDescription>
                  Execute tools via Model Context Protocol. Stripe payments, database operations, and custom workflows
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader>
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-accent/10">
                  <Activity className="h-6 w-6 text-accent" />
                </div>
                <CardTitle>Real-Time Monitoring</CardTitle>
                <CardDescription>
                  Track worker status, consumer lag, and task completion. Prometheus metrics and Grafana dashboards
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t border-border bg-primary/5 px-6 py-24">
        <div className="mx-auto max-w-screen-xl text-center">
          <h2 className="mb-4 text-balance text-4xl font-bold text-foreground">Ready to get started?</h2>
          <p className="mb-8 text-pretty text-lg text-muted-foreground">
            Deploy your first workflow in minutes with Project Nexus v2
          </p>
          <Button size="lg" asChild>
            <Link href="/workflows">
              Launch Chat
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-12">
        <div className="mx-auto max-w-screen-xl">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <div className="flex items-center gap-2">
              <Image
                src="/images/chatgpt-20image-20jun-2023-2c-202025-2c-2003-53-12-20pm.png"
                alt="Project Nexus"
                width={24}
                height={24}
              />
              <span className="text-sm text-muted-foreground">Project Nexus v2</span>
            </div>
            <p className="text-sm text-muted-foreground">Built with Apache Pulsar and Next.js</p>
          </div>
        </div>
      </footer>
    </div>
    </>
  )
}
