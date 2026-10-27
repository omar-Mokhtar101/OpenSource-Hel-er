# syntax=docker/dockerfile:1

# Build context is the monorepo root.
# Worker image: same source tree as apps/api, entrypoint is the BullMQ bootstrap.
# Keep the deps/build stages in sync with apps/api/Dockerfile.
# No HTTP port and no HEALTHCHECK: the worker is checked through the API
# readiness endpoint by the compose healthcheck.

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/contracts/package.json packages/contracts/tsconfig.json packages/contracts/
COPY packages/contracts/src packages/contracts/src
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN rm -f apps/web/.env.local apps/api/.env
RUN pnpm --filter @osh/contracts build \
 && pnpm --filter @osh/api exec prisma generate \
 && pnpm --filter @osh/api build

FROM node:22-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build --chown=app:app /app/apps/api/dist ./apps/api/dist
COPY --from=build --chown=app:app /app/apps/api/prisma ./apps/api/prisma
COPY --from=build --chown=app:app /app/apps/api/package.json ./apps/api/package.json
COPY --from=build --chown=app:app /app/packages/contracts ./packages/contracts
USER app
CMD ["node", "apps/api/dist/worker.js"]
