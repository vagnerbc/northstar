# syntax=docker/dockerfile:1.7
FROM node:24.14.0-bookworm-slim AS development
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@11.19.0 --activate
WORKDIR /workspace
COPY . .
RUN pnpm install --frozen-lockfile && pnpm generate
CMD ["pnpm", "dev"]

FROM development AS build
RUN pnpm build

FROM node:24.14.0-bookworm-slim AS service-runtime
ENV NODE_ENV=production
WORKDIR /workspace
COPY --from=build /workspace /workspace
USER node
CMD ["node", "services/order/dist/main.js"]
