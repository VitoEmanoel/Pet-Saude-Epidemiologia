FROM node:20-alpine AS base

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

FROM node:20-alpine AS backend-deps

WORKDIR /app

ENV NPM_CONFIG_UPDATE_NOTIFIER=false

RUN apk add --no-cache openssl

COPY package*.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
COPY backend/prisma backend/prisma

RUN npm ci --omit=dev --workspace backend --include-workspace-root
RUN npm --workspace backend run prisma:generate

FROM node:20-alpine AS backend

WORKDIR /app

RUN apk add --no-cache openssl

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

EXPOSE 3333

WORKDIR /app

CMD ["node", "backend/dist/main.js"]

FROM base AS frontend

ARG NEXT_PUBLIC_API_URL=http://localhost:3333
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN npm --workspace frontend run build

FROM node:20-alpine AS frontend-runner

WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

COPY --from=frontend /app/frontend/.next/standalone ./
COPY --from=frontend /app/frontend/.next/static ./frontend/.next/static

# Roda sem root. O Next.js só precisa escrever no próprio cache (.next/cache).
RUN mkdir -p frontend/.next/cache && chown -R node:node frontend/.next/cache

USER node

EXPOSE 3000

WORKDIR /app/frontend

CMD ["node", "server.js"]
