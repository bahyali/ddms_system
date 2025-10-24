FROM node:20-bullseye-slim

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

ARG NEXT_PUBLIC_API_BASE_URL="http://localhost:3001/api/v1"
ARG NEXT_PUBLIC_TENANT_ID="11111111-1111-1111-1111-111111111111"
ARG NEXT_PUBLIC_DEV_JWT="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkZXYtdXNlciIsInJvbGVzIjpbImFkbWluIl0sInRlbmFudF9pZCI6IjExMTExMTExLTExMTEtMTExMS0xMTExLTExMTExMTExMTExMSJ9.6HPdCV5lI1DUoGLrQa4u0pgdOZW86CPZta6s5Z7ZPBk"

ENV NEXT_PUBLIC_API_BASE_URL="${NEXT_PUBLIC_API_BASE_URL}"
ENV NEXT_PUBLIC_TENANT_ID="${NEXT_PUBLIC_TENANT_ID}"
ENV NEXT_PUBLIC_DEV_JWT="${NEXT_PUBLIC_DEV_JWT}"

RUN apt-get update \
  && apt-get install -y python3 make g++ \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable

WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages ./packages
COPY apps ./apps

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @ddms/web run build

ENV NODE_ENV="production"

EXPOSE 3000

CMD ["pnpm", "--filter", "@ddms/web", "run", "start"]
