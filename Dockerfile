# syntax=docker/dockerfile:1

ARG NODE_IMAGE=node:22-bookworm-slim
ARG RUNTIME_IMAGE=debian:bookworm-slim

# Build and dependency stages use the official Node image and pinned pnpm.
FROM ${NODE_IMAGE} AS toolchain
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.18.2 --activate

# Stage 1 — build
FROM toolchain AS build

# Install dependencies (layer cache: only re-run when lockfile changes)
COPY package.json pnpm-lock.yaml ./
# package.json postinstall imports both files, so they must exist before install.
COPY scripts/ensure-secure-adm-zip.mjs scripts/adm-zip-security-lib.mjs scripts/
RUN pnpm install --frozen-lockfile

# Copy source and compile
COPY tsconfig.json ./
COPY src/ src/
COPY scripts/preload-hf-model.mjs scripts/
RUN pnpm build

# Bake the local-search embedding model into the image (~23MB)
ENV HARNESS_HF_CACHE_DIR=/app/.cache/hf
RUN node scripts/preload-hf-model.mjs /app/.cache/hf

# Stage 2 — production dependencies
FROM toolchain AS production-dependencies

COPY package.json pnpm-lock.yaml ./
COPY scripts/ensure-secure-adm-zip.mjs scripts/adm-zip-security-lib.mjs scripts/
RUN pnpm install --frozen-lockfile --prod

# Stage 3 — production runtime
# ONNX Runtime's Node binding needs glibc and libgomp. Start from Debian and
# copy only the Node executable so npm, npx, Corepack, pnpm, and Yarn never
# enter the production image.
FROM ${RUNTIME_IMAGE} AS production
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates libgomp1 libstdc++6 \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --gid 1000 node \
  && useradd --uid 1000 --gid node --shell /bin/bash --create-home node \
  && chown node:node /app

COPY --from=toolchain /usr/local/bin/node /usr/local/bin/node

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    HARNESS_HF_CACHE_DIR=/app/.cache/hf

# Copy only runtime application artifacts into the package-manager-free image.
COPY --chown=node:node package.json ./
COPY --from=production-dependencies --chown=node:node /app/node_modules node_modules/
COPY --from=build --chown=node:node /app/build build/
COPY --from=build --chown=node:node /app/.cache/hf /app/.cache/hf

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["node", "-e", "const port=process.env.PORT||'3000';fetch(`http://127.0.0.1:${port}/health`).then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]

ENTRYPOINT ["node", "build/index.js", "http"]
