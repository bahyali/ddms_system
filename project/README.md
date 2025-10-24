# Dynamic Data Management System (DDMS)

This monorepo hosts the backend API, web client, and shared libraries that make up the Dynamic Data Management System. The stack combines a Fastify/PostgreSQL API, a Next.js front-end, and Drizzle ORM for schema management.

## Repository Layout
- `apps/api` – Fastify API that exposes tenant-aware metadata, entities, relations, events, and indexing endpoints.
- `apps/web` – Next.js application that consumes the API (development rewrites proxy `/api/v1/*` to the API on port 3001).
- `packages/db` – Drizzle ORM schema definitions plus generated SQL migrations.
- `packages/core` – Domain utilities (validation, filter compiler, etc.).
- `packages/sdk` – Client-side helpers used by the web app.
- `infra` – Docker Compose for local infrastructure (PostgreSQL 14).
- `tools` – Convenience scripts for installing dependencies, running dev servers, linting, and tests.

## Prerequisites
- **Node.js 20+** (Next.js 14 and Fastify both expect a modern runtime).
- **pnpm 10.19.0** (enable via `corepack enable` or install manually).
- **Docker & docker compose** for running the local PostgreSQL instance.
- Optional: `psql` CLI for inspecting the database.

## Initial Setup
1. Install dependencies (from the repository root):
   ```bash
   corepack enable || npm install -g pnpm
   pnpm install
   ```
2. Copy environment defaults for the API:
   ```bash
   cp apps/api/.env.example apps/api/.env
   ```
3. Start the local database:
   ```bash
   docker compose -f infra/docker-compose.yml up -d
   ```
   The compose file provisions PostgreSQL 14 with credentials `user/password` and database `ddms_db`.
4. Export (or place in `apps/api/.env`) the connection string expected by Drizzle and the API:
   ```bash
   export DATABASE_URL="postgresql://user:password@localhost:5432/ddms_db"
   ```
   The `drizzle-kit` CLI and the API server both read this value during startup.

## Running the Services
- **Apply the latest database migrations** (requires `DATABASE_URL`):
  ```bash
  pnpm --filter @ddms/db exec drizzle-kit push
  ```
  This syncs the SQL migrations in `packages/db/migrations` into the local database.

- **Start the API and web client together**:
  ```bash
  pnpm run dev
  ```
  The root `dev` script streams each workspace’s `dev` script. By default:
  - API listens on `http://localhost:3001`
  - Web app listens on `http://localhost:3000` and proxies `/api/v1/*` to the API

  You can run them individually if you prefer:
  ```bash
  pnpm --filter @ddms/api run dev
  pnpm --filter @ddms/web run dev
  ```

- **API authentication & tenancy**: In development, mock authentication is enabled unless `MOCK_AUTH=false`. Requests must include an `x-tenant-id` header; if omitted, the mock tenant (`11111111-1111-1111-1111-111111111111`) is used. When pointing at a real identity provider, set `MOCK_AUTH=false` and configure `JWT_SECRET`.

## API Environment Variables
Set these in `apps/api/.env` or the shell before starting the server:

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | _none_ | PostgreSQL connection string required by Drizzle and the API. |
| `PORT` | `3001` | API listen port. |
| `HOST` | `0.0.0.0` | Bind address (useful for Docker/WSL). |
| `NODE_ENV` | `development` | Standard Node environment flag. |
| `JWT_SECRET` | `a-very-secret-key-that-should-be-in-env` | Signing secret for `@fastify/jwt` when real auth is enabled. |
| `MOCK_AUTH` | `true` when `NODE_ENV !== 'production'` | Toggles the mock auth/tenant injection. |
| `MOCK_TENANT_ID` | `11111111-1111-1111-1111-111111111111` | Tenant inserted automatically when `MOCK_AUTH` is on. |
| `MOCK_TENANT_NAME` | `Mock Tenant` | Friendly name for the mock tenant. |
| `MOCK_USER_ID` | `22222222-2222-2222-2222-222222222222` | Mock user identifier. |
| `MOCK_ROLES` | `admin` | Comma-separated list of mock roles. |
| `FIELD_INDEXER_INTERVAL_MS` | `30000` (30s) | Polling interval for the background indexer plugin. |

## Database Migrations
Drizzle ORM manages the schema for this project:

1. **Applying existing migrations**
   ```bash
   pnpm --filter @ddms/db exec drizzle-kit push
   ```
   The CLI reads `packages/db/drizzle.config.ts` for schema paths and migration output. The command creates the `_journal` table and runs any SQL files in `packages/db/migrations` that have not been applied.

2. **Creating a new migration**
   ```bash
   pnpm --filter @ddms/db run db:generate -- --name add_new_table
   ```
   Update `packages/db/src/schema.ts` before running the generator. Generated SQL files are written to `packages/db/migrations`.

3. **Rebuilding Types**
   ```bash
   pnpm --filter @ddms/db run build
   ```
   This emits the compiled TypeScript definitions in `packages/db/dist`, which the API imports.

> Tip: The database user configured in `DATABASE_URL` must have permission to create extensions, triggers, and `LISTEN/NOTIFY` resources because the migrations define indexes, RLS policies, and trigger-based change feeds.

## Seeding Large Demo Data
The API workspace ships with a TypeScript seeding script that generates one million records across users, projects, and resources.

1. Ensure prerequisites:
   - PostgreSQL is running and migrations are applied.
   - `DATABASE_URL` points at the target database.
   - Dependencies have been installed (`pnpm install`).
2. Run the seed script:
   ```bash
   pnpm --filter @ddms/api run seed
   ```
   The script:
   - Removes any existing tenant with ID `11111111-1111-1111-1111-111111111111`.
   - Inserts a “Demo Seed Tenant” and metadata for user/project/resource entities.
   - Bulk inserts 400k users, 300k projects, 300k resources (1M records total) and ~1.2M relationship edges.
   - Logs per-entity progress in 10k increments.

3. Customise the workload via environment variables (must still total 1,000,000 unless `ALLOW_CUSTOM_SEED_TOTAL=true`):

| Variable | Default | Description |
| --- | --- | --- |
| `SEED_USERS` | `400000` | Number of user records. |
| `SEED_PROJECTS` | `300000` | Number of project records. |
| `SEED_RESOURCES` | `300000` | Number of resource records. |
| `SEED_BATCH_SIZE` | `1000` | Insert batch size for primary entities. |
| `SEED_MAX_CONNECTIONS` | `20` | PostgreSQL connection pool size during seeding. |
| `ALLOW_CUSTOM_SEED_TOTAL` | _unset_ | Set to `true` to bypass the 1M total guardrail. |

> Seeding 1M rows can take several minutes and is memory-intensive. Use a dedicated database and consider raising `NODE_OPTIONS="--max-old-space-size=8192"` if you bump batch sizes.

Refer to `docs/seed-data.md` for expanded context on the dataset and performance expectations.

## Useful Scripts
- `tools/install.sh` – installs workspace dependencies after verifying `pnpm`.
- `tools/run.sh` – ensures dependencies are installed, then runs `pnpm run dev`.
- `pnpm run lint` – runs lint tasks across all workspaces.
- `pnpm run test` – executes available test suites (API routes, core utilities).

## Troubleshooting
- **Migrations fail with permission errors**: connect with a superuser or grant the role rights to create extensions/triggers.
- **API exits on startup**: make sure `DATABASE_URL` is set and the database is reachable. Check `apps/api/.env`.
- **Requests rejected for missing tenant**: include `x-tenant-id` header or leave `MOCK_AUTH` enabled to allow the default tenant.
- **Large seed script stalls**: check available memory and tune `SEED_BATCH_SIZE` / `SEED_MAX_CONNECTIONS`.

With the services running, visit `http://localhost:3000` for the web UI or call `http://localhost:3001/health` to verify the API. Happy building!
