import type { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { WorkflowDiagram } from "@/components/workflow-diagram"
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
} from "lucide-react"

export const metadata: Metadata = {
  title: "Transform Workflows with AI-Powered Reliability",
  description: "Route messages intelligently, process documents with AI vision, and ensure zero task loss. Enterprise-grade workflow orchestration that scales with Apache Pulsar, LLM routing, and MCP integration.",
  openGraph: {
    title: "Nexus - Transform Workflows with AI-Powered Reliability",
    description: "Enterprise-grade workflow orchestration. Route messages intelligently, process documents with AI vision, and ensure zero task loss.",
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
                  <CheckCircle2 className="h-4 w-4" />
                  Enterprise-Grade
                </div>
                <h1 className="mb-6 text-balance text-5xl font-bold leading-tight tracking-tight text-foreground lg:text-6xl">
                  Transform Workflows with AI-Powered Reliability
                </h1>
                <p className="mb-8 text-pretty text-xl leading-relaxed text-muted-foreground">
                  Route messages intelligently, process documents with AI vision, and ensure zero task loss. Enterprise-grade workflow orchestration that scales.
                </p>
                <div className="flex flex-wrap gap-4">
                  <Button size="lg" asChild>
                    <Link href="/workflows">
                      Get Started Free
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button size="lg" variant="outline" asChild>
                    <Link href="/monitoring">Explore Features</Link>
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-center">
                <WorkflowDiagram className="w-full" />
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
              <Card className="border-border bg-card transition-all hover:shadow-md">
                <CardHeader>
                  <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                    <Brain className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>Intelligent Message Routing</CardTitle>
                  <CardDescription>
                    Automatically classifies and routes messages, eliminating manual configuration. High-speed traffic control directs messages to vision, tool execution, or chat workers.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="border-border bg-card transition-all hover:shadow-md">
                <CardHeader>
                  <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-accent/10">
                    <Eye className="h-6 w-6 text-accent" />
                  </div>
                  <CardTitle>Extract Data Effortlessly</CardTitle>
                  <CardDescription>
                    Turn invoices and handwritten notes into structured data in seconds. Layout-aware OCR with table preservation extracts structured data from invoices, receipts, and documents.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="border-border bg-card transition-all hover:shadow-md">
                <CardHeader>
                  <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                    <Network className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>Never Lose a Task</CardTitle>
                  <CardDescription>
                    Individual message acknowledgment ensures zero data loss. No task is lost, even when workers fail mid-execution, thanks to Apache Pulsar's reliable messaging backbone.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="border-border bg-card transition-all hover:shadow-md">
                <CardHeader>
                  <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-accent/10">
                    <Shield className="h-6 w-6 text-accent" />
                  </div>
                  <CardTitle>Enterprise-Grade Security</CardTitle>
                  <CardDescription>
                    OAuth2 integration with isolated Pulsar tenants and namespaces ensures complete data isolation. Multi-tenant architecture with enterprise-grade security.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="border-border bg-card transition-all hover:shadow-md">
                <CardHeader>
                  <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                    <Zap className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>MCP Integration</CardTitle>
                  <CardDescription>
                    Execute tools via Model Context Protocol. Integrate Stripe payments, database operations, and custom workflows seamlessly into your orchestration.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="border-border bg-card transition-all hover:shadow-md">
                <CardHeader>
                  <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-accent/10">
                    <Activity className="h-6 w-6 text-accent" />
                  </div>
                  <CardTitle>Real-Time Monitoring</CardTitle>
                  <CardDescription>
                    Track worker status, consumer lag, and task completion in real time. Prometheus metrics and Grafana dashboards provide complete observability.
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>
        </section>

        {/* Social Proof Section (Placeholder) */}
        <section className="border-t border-border bg-muted/30 px-6 py-16">
          <div className="mx-auto max-w-screen-xl">
            {/* Placeholder structure for future testimonials/stats */}
            {/* Uncomment and populate when available:
            <div className="text-center">
              <h2 className="mb-8 text-3xl font-bold text-foreground">Trusted by Teams Worldwide</h2>
              <div className="grid gap-8 md:grid-cols-3">
                <div className="text-center">
                  <div className="mb-2 text-4xl font-bold text-primary">X+</div>
                  <div className="text-muted-foreground">Workflows Deployed</div>
                </div>
                <div className="text-center">
                  <div className="mb-2 text-4xl font-bold text-primary">99.9%</div>
                  <div className="text-muted-foreground">Uptime</div>
                </div>
                <div className="text-center">
                  <div className="mb-2 text-4xl font-bold text-primary">X+</div>
                  <div className="text-muted-foreground">Active Users</div>
                </div>
              </div>
            </div>
            */}
          </div>
        </section>

        {/* CTA Section */}
        <section className="border-t border-border bg-primary/5 px-6 py-24">
          <div className="mx-auto max-w-screen-xl text-center">
            <h2 className="mb-4 text-balance text-4xl font-bold text-foreground">
              Deploy Your First Workflow in Minutes
            </h2>
            <p className="mb-8 text-pretty text-lg text-muted-foreground">
              Join teams building mission-critical AI workflows
            </p>
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Button size="lg" asChild>
                <Link href="/workflows">
                  Get Started Free
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="https://github.com/mcpmessenger/project-nexus-v2" target="_blank" rel="noopener noreferrer">
                  <FileText className="mr-2 h-4 w-4" />
                  Documentation
                  <ExternalLink className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
            <p className="mt-6 text-sm text-muted-foreground">No credit card required • Free forever</p>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-border bg-background px-6 py-12">
          <div className="mx-auto max-w-screen-xl">
            <div className="grid gap-8 md:grid-cols-4">
              {/* Brand */}
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <Image
                    src="/images/chatgpt-20image-20jun-2023-2c-202025-2c-2003-53-12-20pm.png"
                    alt="Project Nexus"
                    width={24}
                    height={24}
                  />
                  <span className="text-sm font-semibold text-foreground">Project Nexus v2</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Enterprise-grade workflow orchestration powered by Apache Pulsar and AI.
                </p>
              </div>

              {/* Product */}
              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-semibold text-foreground">Product</h3>
                <div className="flex flex-col gap-2">
                  <Link
                    href="/workflows"
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Workflows
                  </Link>
                  <Link
                    href="/monitoring"
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Monitoring
                  </Link>
                </div>
              </div>

              {/* Resources */}
              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-semibold text-foreground">Resources</h3>
                <div className="flex flex-col gap-2">
                  <Link
                    href="https://github.com/mcpmessenger/project-nexus-v2"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <Github className="h-4 w-4" />
                    GitHub
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                  <Link
                    href="https://github.com/mcpmessenger/project-nexus-v2"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Documentation
                  </Link>
                </div>
              </div>

              {/* Built With */}
              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-semibold text-foreground">Built With</h3>
                <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                  <span>Apache Pulsar</span>
                  <span>Next.js</span>
                  <span>Supabase</span>
                </div>
              </div>
            </div>

            <div className="mt-8 border-t border-border pt-8">
              <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
                <p className="text-sm text-muted-foreground">
                  © {new Date().getFullYear()} Project Nexus. All rights reserved.
                </p>
                <p className="text-sm text-muted-foreground">Version 2.0</p>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  )
}
