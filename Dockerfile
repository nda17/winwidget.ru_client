# syntax=docker/dockerfile:1

FROM node:20-alpine AS base

WORKDIR /app

ENV HUSKY=0
ENV NEXT_TELEMETRY_DISABLED=1
ENV PNPM_VERSION=9.15.9

RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

FROM base AS deps

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG APP_REVISION=unknown
ARG NEXT_PUBLIC_MODE=production
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_PRODUCTION_HOST
ARG NEXT_PUBLIC_DEVELOPMENT_HOST
ARG NEXT_PUBLIC_WIDGETS_HOST=
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_RECAPTCHA_SITE_KEY
ARG NEXT_PUBLIC_RECAPTCHA_HOST=https://www.recaptcha.net

ENV APP_REVISION=${APP_REVISION}
ENV NEXT_PUBLIC_MODE=${NEXT_PUBLIC_MODE}
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}
ENV NEXT_PUBLIC_PRODUCTION_HOST=${NEXT_PUBLIC_PRODUCTION_HOST}
ENV NEXT_PUBLIC_DEVELOPMENT_HOST=${NEXT_PUBLIC_DEVELOPMENT_HOST}
ENV NEXT_PUBLIC_WIDGETS_HOST=${NEXT_PUBLIC_WIDGETS_HOST}
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_RECAPTCHA_SITE_KEY=${NEXT_PUBLIC_RECAPTCHA_SITE_KEY}
ENV NEXT_PUBLIC_RECAPTCHA_HOST=${NEXT_PUBLIC_RECAPTCHA_HOST}

RUN pnpm build \
	&& mkdir -p /app/.next/standalone/public /app/.next/standalone/.next/static \
	&& cp -R /app/public/. /app/.next/standalone/public/ \
	&& cp -R /app/.next/static/. /app/.next/standalone/.next/static/ \
	&& node scripts/identity-avatar-client-release-evidence.mjs materialize-standalone \
		--source /app/.next/standalone \
		--destination /app/.next/standalone-materialized \
	&& rm -rf /app/.next/standalone \
	&& mv /app/.next/standalone-materialized /app/.next/standalone \
	&& node scripts/identity-avatar-client-release-evidence.mjs generate-full-manifest \
		--root /app \
		--revision "$APP_REVISION" \
		--output /app/.identity-avatar-client-release/release-full-manifest-v1.json

FROM node:20-alpine AS runner

WORKDIR /app

ARG APP_REVISION=unknown

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV APP_REVISION=${APP_REVISION}

LABEL org.opencontainers.image.revision="${APP_REVISION}"

RUN addgroup -S -g 1001 nodejs \
	&& adduser -S -D -H -u 1001 -G nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./.next/standalone
COPY --from=builder --chown=nextjs:nodejs /app/.next/server ./.next/server
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/.identity-avatar-client-release ./.identity-avatar-client-release

USER nextjs

WORKDIR /app/.next/standalone

EXPOSE 3000

CMD ["node", "server.js"]
