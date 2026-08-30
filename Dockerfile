# syntax=docker/dockerfile:1

FROM node:20-alpine AS base

WORKDIR /app

ENV HUSKY=0
ENV NEXT_TELEMETRY_DISABLED=1
ENV PNPM_VERSION=9.15.9

RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

FROM base AS dependencies

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS builder

COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

ARG APP_REVISION=local
ARG NEXT_PUBLIC_MODE=production
ARG NEXT_PUBLIC_APP_URL=http://localhost:3001
ARG NEXT_PUBLIC_API_URL=http://localhost:4100/api/v1

ENV APP_REVISION=${APP_REVISION}
ENV NEXT_PUBLIC_MODE=${NEXT_PUBLIC_MODE}
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

RUN pnpm build

FROM node:20-alpine AS runner

WORKDIR /app

ARG APP_REVISION=local

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV APP_REVISION=${APP_REVISION}

LABEL org.opencontainers.image.revision="${APP_REVISION}"

RUN addgroup -S -g 1001 nodejs \
	&& adduser -S -D -H -u 1001 -G nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
