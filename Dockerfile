FROM node:24-alpine AS base

WORKDIR /app

ENV NPM_CONFIG_UPDATE_NOTIFIER=false
ENV NEXT_TELEMETRY_DISABLED=1

RUN apk add --no-cache openssl

COPY package*.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json

RUN npm ci

COPY . .

FROM base AS backend-build

RUN npm --workspace backend run prisma:generate
RUN npm --workspace backend run build
RUN npm --workspace backend run build:seed

FROM node:24-alpine AS backend-deps

WORKDIR /app

ENV NPM_CONFIG_UPDATE_NOTIFIER=false

RUN apk add --no-cache openssl

COPY package*.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
COPY backend/prisma backend/prisma

RUN npm ci --omit=dev --workspace backend --include-workspace-root
RUN npm --workspace backend run prisma:generate

FROM node:24-alpine AS backend

WORKDIR /app

# Correções do Alpine publicadas depois da imagem base. Sem npm/yarn/corepack na imagem final:
# eles trazem dependências com falhas conhecidas e nada em produção precisa deles
# (migrations, seed e sincronização rodam direto com node, ver scripts/start.sh).
RUN apk upgrade --no-cache && apk add --no-cache openssl \
  && rm -rf /usr/local/lib/node_modules /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/yarn \
    /usr/local/bin/yarnpkg /usr/local/bin/corepack /opt/yarn-*

ENV NODE_ENV=production

COPY package*.json ./
COPY backend/package.json backend/package.json
COPY --from=backend-deps /app/node_modules ./node_modules
COPY --from=backend-build /app/backend/dist ./backend/dist
COPY --from=backend-build /app/backend/prisma ./backend/prisma

# Roda sem root (usuário "node" da imagem oficial). O código fica somente leitura;
# só backend/storage (arquivos brutos das coletas) pertence ao usuário.
RUN mkdir -p backend/storage/raw-imports && chown -R node:node backend/storage

USER node

# O Docker marca o container como "unhealthy" se a API parar de responder (S18).
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3333) + '/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

EXPOSE 3333

WORKDIR /app

CMD ["node", "backend/dist/main.js"]

FROM base AS frontend

ARG NEXT_PUBLIC_API_URL=http://localhost:3333
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN npm --workspace frontend run build

FROM node:24-alpine AS frontend-runner

WORKDIR /app

# O servidor do Next.js só precisa do node: remove npm/yarn/corepack (e as falhas deles)
# e aplica as correções do Alpine publicadas depois da imagem base.
RUN apk upgrade --no-cache \
  && rm -rf /usr/local/lib/node_modules /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/yarn \
    /usr/local/bin/yarnpkg /usr/local/bin/corepack /opt/yarn-*

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

COPY --from=frontend /app/frontend/.next/standalone ./
COPY --from=frontend /app/frontend/.next/static ./frontend/.next/static
# Arquivos estáticos (logos): o modo standalone do Next.js não os copia sozinho.
COPY --from=frontend /app/frontend/public ./frontend/public

# Roda sem root. O Next.js só precisa escrever no próprio cache (.next/cache).
RUN mkdir -p frontend/.next/cache && chown -R node:node frontend/.next/cache

USER node

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

EXPOSE 3000

WORKDIR /app/frontend

CMD ["node", "server.js"]
