# syntax=docker/dockerfile:1.7
FROM node:24.14.0-bookworm-slim AS development
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@11.19.0 --activate
WORKDIR /workspace

# Dependency metadata is copied separately so source-only edits retain the expensive install layer.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/web/package.json apps/web/package.json
COPY packages/auth/package.json packages/auth/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/http/package.json packages/http/package.json
COPY packages/logger/package.json packages/logger/package.json
COPY packages/messaging/package.json packages/messaging/package.json
COPY packages/observability/package.json packages/observability/package.json
COPY packages/test-utils/package.json packages/test-utils/package.json
COPY services/cart/package.json services/cart/package.json
COPY services/catalog-inventory/package.json services/catalog-inventory/package.json
COPY services/notification/package.json services/notification/package.json
COPY services/order/package.json services/order/package.json
COPY services/payment/package.json services/payment/package.json
RUN --mount=type=cache,id=ecommerce-pnpm-store,target=/pnpm/store \
  pnpm install --frozen-lockfile
COPY . .
RUN pnpm generate
CMD ["pnpm", "dev"]

FROM development AS build
RUN pnpm build

FROM node:24.14.0-bookworm-slim AS service-runtime
ENV NODE_ENV=production
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /workspace
COPY --from=build /workspace /workspace
USER node
CMD ["node", "services/order/dist/main.js"]
