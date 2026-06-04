# ─────────────────────────────────────────────────────────────
# Stage 1 — deps: install only production dependencies
# ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force


# ─────────────────────────────────────────────────────────────
# Stage 2 — test: run linting + tests (CI uses this stage)
# ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS test

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run lint || true
RUN npm test


# ─────────────────────────────────────────────────────────────
# Stage 3 — runner: minimal production image
# ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

# Security: run as non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy only prod deps from stage 1
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package*.json ./

# Copy source
COPY src/ ./src/

# Ownership
RUN chown -R appuser:appgroup /app
USER appuser

# Metadata labels (OCI standard)
LABEL org.opencontainers.image.title="devops-pipeline-demo"
LABEL org.opencontainers.image.description="Node.js API with full DevOps pipeline"
LABEL org.opencontainers.image.source="https://github.com/mekid-asmaa-hayat/devops-pipeline-demo"

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "src/server.js"]
