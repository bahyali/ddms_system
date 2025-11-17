# Dynamic Data Management System Workspace

This repository contains everything required for the implementation of the Dynamic Data Management System (DDMS). The actual application code lives in a PNPM-based monorepo under `project/`, while supporting documentation and planning artifacts sit alongside it.

## Repository Layout
- `project/` – Fastify API, Next.js web client, shared packages, tooling, and infrastructure. See `project/README.md` for in-depth instructions, scripts, and workspace details.
- `artifacts/` – Product and technical design collateral: architecture decisions, requirements, plans, and TODO tracking exported during discovery.
- `tickets/` – Backlog items or work notes for the challenge (blank when no open tasks are being tracked here).

## Quick Start
All commands below run from `project/`.

1. Install prerequisites: Node.js 20+, PNPM (via `corepack enable`), and Docker (for PostgreSQL).
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Copy the API environment template and adjust values as needed:
   ```bash
   cp apps/api/.env.example apps/api/.env
   ```
4. Launch the local infrastructure (PostgreSQL 14):
   ```bash
   docker compose -f infra/docker-compose.yml up -d
   ```
5. Apply the latest database migrations:
   ```bash
   pnpm --filter @ddms/db exec drizzle-kit push
   ```
6. Start the API and web app together:
   ```bash
   pnpm run dev
   ```
   - API: `http://localhost:3001`
   - Web: `http://localhost:3000` (proxies `/api/v1/*` to the API)

## Where to Learn More
- `project/README.md` – Comprehensive setup, workspace scripts, migration/seeding guidance, and environment variables.
- `project/docs/` – Supplemental guides (e.g., seeding large datasets).
- `artifacts/requirements.md` – End-to-end product and technical specification for the DDMS.
- `artifacts/architecture.md` – Architectural overview and rationale captured during planning.

Use this README as the entry point; dive into the linked documents when you need deeper implementation details or background context.
