# Painel Epidemiologico de Parnaiba - PI

Projeto para visualizacao de dados publicos do DATASUS/TABNET, restritos ao municipio de Parnaiba - PI e a secao Epidemiologicas e Morbidade.

## Escopo fixo

- Municipio: Parnaiba
- UF: PI
- Codigo IBGE: 2207702
- Categoria DATASUS: `epidemiologicas_morbidade`

O sistema nao deve aceitar consulta por outro municipio no frontend nem na API publica.

## Estrutura

```txt
backend/
  prisma/
  src/
frontend/
  src/
docs/
docker-compose.yml
```

## Fase atual

Fase 1: fundacao tecnica.

Entregue nesta fase:

- Backend Express com TypeScript.
- Lista fixa de fontes permitidas.
- Rotas iniciais de fontes, dashboard, registros, graficos e administracao.
- Bloqueio de parametros de municipio em `GET /api/records`.
- Area administrativa protegida por `ADMIN_TOKEN`.
- Schema Prisma para PostgreSQL.
- Seed Prisma das fontes permitidas.
- Docker Compose com PostgreSQL e Redis.
- Frontend Next.js inicial.

A coleta real do DATASUS/TABNET ainda nao foi implementada. Ela comeca na Fase 2, com validacao tecnica fonte por fonte.

## Como rodar localmente

Instale as dependencias:

```bash
npm install
```

Suba PostgreSQL e Redis:

```bash
docker compose up -d
```

Crie o arquivo `.env` a partir de `.env.example` e ajuste o `ADMIN_TOKEN`.

Gere o Prisma Client e aplique a primeira migracao:

```bash
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

Rode o backend:

```bash
npm run dev:backend
```

Rode o frontend:

```bash
npm run dev:frontend
```

URLs locais:

- Frontend: `http://localhost:3000`
- Pagina da fonte piloto: `http://localhost:3000/tuberculose`
- Backend: `http://localhost:3001`
- PostgreSQL: `localhost:5433`
- Health check: `http://localhost:3001/health`

## Rotas iniciais

```txt
GET  /health
GET  /api/sources
GET  /api/sources/:slug
GET  /api/sources/:slug/availability
GET  /api/sources/:slug/summary
GET  /api/sources/:slug/filters
GET  /api/dashboard/overview
GET  /api/records
GET  /api/records/export.csv
GET  /api/charts/yearly-evolution?source=tuberculose_sinan
GET  /api/charts/by-sex?source=tuberculose_sinan
GET  /api/charts/by-age-group?source=tuberculose_sinan
GET  /api/charts/by-race-color?source=tuberculose_sinan
POST /api/admin/sync/:sourceSlug
POST /api/admin/sync-all
GET  /api/admin/sync-history
```

As rotas administrativas exigem:

```txt
Authorization: Bearer <ADMIN_TOKEN>
```

## Proxima fase

A Fase 5 deve construir o frontend com dados reais usando a fonte piloto ja coletada:

```txt
tuberculose_sinan
```

Objetivo da Fase 5:

- criar pagina da fonte piloto;
- exibir cards reais;
- renderizar graficos reais;
- criar tabela paginada;
- adicionar filtros;
- adicionar exportacao CSV no frontend.
