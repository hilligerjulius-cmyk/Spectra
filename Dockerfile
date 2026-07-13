# ─────────────────────────────────────────────────────────────
#  Spectra Systems — single-service image (The Spectra Canvas).
#  The Compiler Engine runs in-process inside the Next.js server,
#  so this one container is the whole platform. Deploys as-is on
#  Railway (Dockerfile builder). Listens on $PORT.
# ─────────────────────────────────────────────────────────────
FROM node:22-slim AS base
ENV PNPM_HOME="/pnpm" PATH="/pnpm:$PATH" NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /app

# ---- install deps + build the canvas ----
FROM base AS build
# Manifests first for better layer caching.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc turbo.json tsconfig.base.json ./
COPY packages ./packages
COPY apps ./apps
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @spectra/canvas build

# ---- runtime ----
FROM base AS runner
ENV NODE_ENV=production
COPY --from=build /app ./
WORKDIR /app/apps/canvas
EXPOSE 3000
# `next start` honors $PORT (set by Railway) and binds 0.0.0.0.
CMD ["pnpm", "start"]
