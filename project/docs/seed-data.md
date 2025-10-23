# Large Dataset Seeding

The workspace ships with a dedicated script that can populate the database with one million synthetic rows across the core entity types (users, projects, and resources). The generated data exercises text, numeric, date, select, boolean, and relationship fields so the Dynamic Data Management System can be demoed at scale.

## Prerequisites

1. Start the Postgres instance (`pnpm run infra:up` or `docker compose up` using `infra/docker-compose.yml`).
2. Export a valid `DATABASE_URL`, for example:

   ```bash
   export DATABASE_URL=postgres://user:password@localhost:5432/ddms_db
   ```

3. Install workspace dependencies so `@faker-js/faker` is available:

   ```bash
   pnpm install
   ```

## Running the Seeder

Execute the script from the repository root:

```bash
pnpm --filter @ddms/api exec tsx src/scripts/seed.ts
```

The script will:

- Remove any existing tenant with ID `11111111-1111-1111-1111-111111111111` (cascading its data).
- Recreate that tenant as **“Demo Seed Tenant”** with fresh metadata.
- Create entity types for Users, Projects, and Resources with representative field definitions.
- Insert 400,000 user records, 300,000 project records, and 300,000 resource records (1,000,000 total).
- Create more than one million relationship edges linking projects to users and resources to projects.

Console output surfaces per-entity progress (in 10k increments) along with the total runtime.

## Customisation

The defaults target an even million rows. You can override counts and batching via environment variables:

| Variable              | Default  | Description                                      |
| --------------------- | -------- | ------------------------------------------------ |
| `SEED_USERS`          | 400000   | Number of user records                           |
| `SEED_PROJECTS`       | 300000   | Number of project records                        |
| `SEED_RESOURCES`      | 300000   | Number of resource records                       |
| `SEED_BATCH_SIZE`     | 1000     | Insert batch size per entity                     |
| `SEED_MAX_CONNECTIONS`| 20       | Postgres pool size used during the seeding run   |

For guard rails, the totals must still add up to 1,000,000. To bypass the check (for experiments), set:

```bash
export ALLOW_CUSTOM_SEED_TOTAL=true
```

## Performance Notes

- The full seed typically takes several minutes on a modern laptop. Expect ~1.2 million rows in the `edges` table and ~1 million in `records`.
- Large batch inserts can be memory-intensive; increase `NODE_OPTIONS="--max-old-space-size=8192"` if you plan to raise the batch size dramatically.
- Run the script against a disposable database when possible—the tenant removal step is destructive.

After the script completes, launch the API and web app as usual to explore the high-volume dataset.
