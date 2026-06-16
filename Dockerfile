FROM node:20-alpine AS base

WORKDIR /app

RUN apk add --no-cache openssl

COPY package*.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json

RUN npm ci

COPY . .

FROM base AS backend

RUN npm --workspace backend run prisma:generate
RUN npm --workspace backend run build

EXPOSE 3333

WORKDIR /app

CMD ["node", "backend/dist/main.js"]

FROM base AS frontend

ARG NEXT_PUBLIC_API_URL=http://localhost:3333
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN npm --workspace frontend run build

EXPOSE 3000

WORKDIR /app/frontend

CMD ["node", "../node_modules/next/dist/bin/next", "start", "-H", "0.0.0.0", "-p", "3000"]
