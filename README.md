# Project Nexus v2

Intelligent workflow orchestration platform built with Next.js, Apache Pulsar, MCP (Model Context Protocol) routing, and an LLM-powered chat experience.

## Overview

Project Nexus v2 is a modern web application that provides a centralized control plane for managing MCP servers, orchestrating AI workflows, and enabling seamless interaction with multiple Model Context Protocol servers through a unified interface.

### Key Features

- **MCP Server Registry**: Manage and monitor MCP servers (Brave, GitHub, Maps, Playwright, and custom servers)
- **Workflow Orchestration**: Create and manage AI-powered workflows with document upload and query routing
- **Real-time Monitoring**: Track worker status and system health
- **Logo Management**: Upload and manage server logos for visual identification
- **Chat Interface**: LLM-powered chat experience for interacting with MCP servers

## Tech Stack

- **Framework**: Next.js 16 (React 19)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **UI Components**: Radix UI, shadcn/ui
- **Package Manager**: pnpm
- **Database**: Supabase (PostgreSQL)
- **Backend**: Supabase Edge Functions (Deno)
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js 18+ 
- pnpm 10.x (or use `corepack enable` to manage it automatically)

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
   Edit `.env.local` with your configuration values.

4. Run the development server:
   ```bash
   pnpm dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

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
│   └── ui/               # Reusable UI components
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

- **Architecture**: System design and component architecture
- **Implementation Roadmap**: Planned features and milestones
- **Operational Guide**: Running and maintaining the system
- **Storage Setup**: Database and storage configuration
- **Setup Guide**: Detailed setup instructions

## Contributing

1. Create a feature branch from `main`
2. Make your changes
3. Test thoroughly with `pnpm lint` and `pnpm build`
4. Commit and push your changes
5. Open a pull request

## License

See LICENSE file for details.

## Support

For issues, questions, or contributions, please open an issue on GitHub.
