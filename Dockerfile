# Stage 1 — build
FROM node:22-alpine AS build
WORKDIR /app

# Enable pnpm via corepack
RUN corepack enable && corepack prepare pnpm@10.18.2 --activate

# Install dependencies (layer cache: only re-run when lockfile changes)
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy source and compile
COPY tsconfig.json ./
COPY src/ src/
COPY scripts/preload-hf-model.mjs scripts/
RUN pnpm build

# Bake the local-search embedding model into the image (~23MB)
ENV HARNESS_HF_CACHE_DIR=/app/.cache/hf
RUN node scripts/preload-hf-model.mjs /app/.cache/hf

# Stage 2 — production
FROM node:22-alpine AS production
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.18.2 --activate

# Install production dependencies only
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

# Copy compiled output and pre-downloaded model cache from build stage
COPY --from=build /app/build build/
COPY --from=build /app/.cache/hf /app/.cache/hf

ENV HARNESS_HF_CACHE_DIR=/app/.cache/hf
# Model is pre-baked above — enable local semantic search in hosted HTTP deployments.
ENV HARNESS_SEARCH_PROVIDER=local

# Non-root user for security
RUN addgroup -S mcp && adduser -S mcp -G mcp
USER mcp

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

ENTRYPOINT ["node", "build/index.js", "http"]
