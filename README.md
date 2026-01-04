# Project Nexus v2

> Transform workflows with AI-powered reliability. Enterprise-grade workflow orchestration powered by Apache Pulsar, LLM routing, and MCP integration.

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61dafb?logo=react)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38bdf8?logo=tailwind-css)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ecf8e?logo=supabase)](https://supabase.com/)
[![Apache Pulsar](https://img.shields.io/badge/Apache-Pulsar-188fff?logo=apache-pulsar)](https://pulsar.apache.org/)

## Overview

Project Nexus v2 is an enterprise-grade workflow orchestration platform that transforms how teams build mission-critical AI workflows. Built on Apache Pulsar for reliable messaging and powered by intelligent LLM routing, it enables you to:

- **Route messages intelligently** with AI-powered classification
- **Process documents with AI vision** to extract structured data from invoices, receipts, and handwritten notes
- **Ensure zero task loss** with individual message acknowledgment
- **Scale securely** with multi-tenant architecture and OAuth2 integration
- **Monitor in real-time** with Prometheus metrics and Grafana dashboards

### Key Features

- **Intelligent Message Routing**: Automatically classifies and routes messages to vision, tool execution, or chat workers
- **Modern AI Vision**: Layout-aware OCR with table preservation for structured data extraction
- **Pulsar Backbone**: Individual message acknowledgment ensures no task is lost, even when workers fail
- **Multi-Tenancy**: OAuth2 integration with isolated Pulsar tenants and namespaces for enterprise-grade security
- **MCP Integration**: Execute tools via Model Context Protocol (Stripe payments, database operations, custom workflows)
- **Real-Time Monitoring**: Track worker status, consumer lag, and task completion with Prometheus and Grafana

## Tech Stack

- **Framework**: Next.js 16 (React 19)
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS v4
- **UI Components**: Radix UI, shadcn/ui
- **Package Manager**: pnpm
- **Database**: Supabase (PostgreSQL)
- **Backend**: Supabase Edge Functions (Deno)
- **Message Queue**: Apache Pulsar
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js 18+ 
- pnpm 10.x (or use `corepack enable` to manage it automatically)
- Supabase account (for database and authentication)
- Apache Pulsar instance (or use managed Pulsar service)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/mcpmessenger/project-nexus-v2.git
   cd project-nexus-v2-main
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env.local
   ```
   Edit `.env.local` with your configuration values (Supabase URL, API keys, Pulsar connection details, etc.).

4. Run database migrations:
   ```bash
   # Follow instructions in docs/STORAGE_SETUP.md
   ```

5. Run the development server:
   ```bash
   pnpm dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

### Development Commands

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm lint` - Run ESLint

## Project Structure

```
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   ├── monitoring/        # Registry/MCP server management
│   └── workflows/         # Workflow orchestration UI
├── components/            # React components
│   ├── ui/               # Reusable UI components
│   └── workflow-diagram.tsx  # Visual workflow architecture
├── lib/                   # Utility functions and clients
├── public/                # Static assets
│   └── images/           # Server logos and images
├── supabase/              # Supabase configuration
│   ├── functions/        # Edge functions
│   └── migrations/       # Database migrations
└── docs/                  # Architecture and documentation
```

## Deployment

This project is automatically deployed to Vercel when changes are pushed to the `main` branch.

- **Repository**: `mcpmessenger/project-nexus-v2`
- **Branch**: `main`
- **Platform**: Vercel

To trigger a manual rebuild, push a commit to `main` or trigger a redeploy from the Vercel dashboard.

## Testing

Run the following commands to validate your setup:

```bash
pnpm lint    # Validate TypeScript and lint rules
pnpm build   # Ensure production bundle compiles
```

## Documentation

Comprehensive documentation is available in the `docs/` directory:

- **[Architecture](docs/ARCHITECTURE.md)**: System design and component architecture
- **[Architecture v2](docs/ARCHITECTURE_V2.md)**: Updated architecture with improvements
- **[Implementation Roadmap](docs/IMPLEMENTATION_ROADMAP.md)**: Planned features and milestones
- **[Operational Guide](docs/OPERATIONAL_GUIDE.md)**: Running and maintaining the system
- **[Storage Setup](docs/STORAGE_SETUP.md)**: Database and storage configuration
- **[Setup Guide](docs/SETUP.md)**: Detailed setup instructions

## Contributing

We welcome contributions! Here's how you can help:

### Getting Started

1. Fork the repository
2. Create a feature branch from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. Make your changes
4. Test thoroughly:
   ```bash
   pnpm lint    # Check for linting errors
   pnpm build   # Ensure everything compiles
   ```
5. Commit your changes with a clear message:
   ```bash
   git commit -m "feat: Add your feature description"
   ```
6. Push to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```
7. Open a pull request on GitHub

### Contribution Guidelines

- Follow the existing code style and conventions
- Add tests for new features when applicable
- Update documentation if you change functionality
- Write clear, descriptive commit messages
- Ensure your code passes linting and builds successfully

### Areas for Contribution

- **MCP Server Adapters**: Implement additional MCP server integrations
- **UI/UX Improvements**: Enhance the user interface and experience
- **Documentation**: Improve docs, add examples, or fix typos
- **Testing**: Add unit tests, integration tests, or E2E tests
- **Performance**: Optimize workflows, reduce latency, improve scalability
- **Bug Fixes**: Report and fix issues

For major changes, please open an issue first to discuss what you'd like to change.

## License

See LICENSE file for details.

## Support

- **Issues**: [Open an issue on GitHub](https://github.com/mcpmessenger/project-nexus-v2/issues)
- **Discussions**: [GitHub Discussions](https://github.com/mcpmessenger/project-nexus-v2/discussions)
- **Documentation**: Check the `docs/` directory for detailed guides

---

Built with ❤️ by the Project Nexus team
