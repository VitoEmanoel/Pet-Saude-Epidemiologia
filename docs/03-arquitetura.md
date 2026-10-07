# 3. Arquitetura e organização do código

## 3.1 Componentes

```txt
                     ┌─────────────────────── Docker Compose ───────────────────────┐
 Navegador ──HTTP──► │ frontend (Next.js :3000)                                     │
     │               │                                                              │
     └────HTTP─────► │ backend (Express :3333) ──► postgres (:5432 interno/:5433)   │
                     │      │  └─ agendador de sync                                 │
                     │      └──► backend/storage/raw-imports (HTML bruto)           │
                     └──────┼───────────────────────────────────────────────────────┘
                            ▼
                     tabnet.datasus.gov.br (HTTP POST)
```

- O **navegador** chama o backend diretamente (`NEXT_PUBLIC_API_URL`). O Next.js não faz proxy.
- O **backend** é o único que fala com o TABNET e com o banco.
- O serviço `sync-data` do Compose (perfil `manual`) roda a coleta num container à parte (`docker compose --env-file .env --profile manual run --rm sync-data`); o fluxo normal usa `npm run sync:data`, que roda **dentro** do container do backend.
- Backend e frontend têm **`HEALTHCHECK`** (a cada 30 s: `/health` e a página inicial). `docker compose ps` mostra `(healthy)` ou `(unhealthy)`; o serviço `sync-data` desliga a checagem porque não sobe a API.
- Os containers do backend e do frontend rodam **sem root**, como o usuário `node` (uid 1000) da imagem oficial. O código na imagem é somente leitura para ele; só `backend/storage` (arquivos brutos) e `frontend/.next/cache` pertencem ao usuário.
- Dentro do Docker a coleta usa o código compilado (`node backend/dist/scripts/sync-data.js`), porque a imagem de produção não tem `tsx` nem o código-fonte. As imagens finais **não têm npm** (S13): migrations, seed e sincronização são chamados direto com `node` (ver `scripts/start.sh`). Fora do Docker (modo dev), `sync:data` usa `tsx` direto no código-fonte.

Diagramas editáveis (abra em https://app.diagrams.net): [diagramas/](diagramas/)

- `diagrama-banco.drawio` / `diagrama-banco-completo.drawio`: tabelas do banco
- `fluxograma-sync-admin.drawio`: fluxo de sincronização e área administrativa

## 3.2 Estrutura de pastas

```txt
.
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma          # modelo do banco (fonte da verdade)
│   │   ├── migrations/            # histórico de alterações do banco (SQL)
│   │   └── seed.ts                # cadastra as fontes permitidas
│   ├── src/
│   │   ├── main.ts                # inicia o servidor HTTP e o agendador
│   │   ├── server.ts              # monta o Express: CORS, rotas, 404
│   │   ├── config/
│   │   │   ├── env.ts             # carrega ../.env e depois backend/.env
│   │   │   ├── city.ts            # Parnaíba fixa + parâmetros de município bloqueados
│   │   │   └── sources.ts         # LISTA DE FONTES PERMITIDAS
│   │   ├── database/prisma.ts     # cliente Prisma único
│   │   ├── middleware/admin-auth.ts   # login, cookie de sessão, limite de tentativas
│   │   ├── modules/
│   │   │   ├── datasus/
│   │   │   │   ├── tabnet-client.ts           # faz o POST no TABNET
│   │   │   │   ├── tabnet-prn.ts              # extrai a tabela do <pre> (formato prn)
│   │   │   │   ├── sinan-tabnet.collector.ts  # COLETOR GENÉRICO + config de cada fonte
│   │   │   │   └── tuberculosis-sinan.collector.ts  # antigo, NÃO É USADO
│   │   │   ├── sync/
│   │   │   │   ├── sync.service.ts    # orquestra uma sincronização (job, status, erros)
│   │   │   │   └── sync-scheduler.ts  # agendador automático
│   │   │   ├── public/public-data.service.ts  # todas as consultas do site (resumos, gráficos, registros)
│   │   │   └── admin/
│   │   │       ├── admin-audit.service.ts     # grava/lista auditoria
│   │   │       └── dashboard-export.service.ts # gera o HTML exportado
│   │   ├── routes/                # endpoints HTTP (ver 06-api.md)
│   │   ├── scripts/sync-data.ts   # CLI de sincronização
│   │   └── utils/api-response.ts  # formato padrão de erro
│   └── storage/raw-imports/       # HTML bruto de cada coleta (fora do git)
├── frontend/
│   └── src/
│       ├── app/                   # páginas (uma pasta = uma URL)
│       ├── components/
│       │   ├── dashboard/         # dashboards (visão geral, por doença, admin)
│       │   ├── layout/            # menu/cabeçalho público e do admin
│       │   ├── maps/              # mapa de Parnaíba
│       │   └── ui/                # cartões, selos de status, botão de tema
│       ├── lib/api.ts             # TODAS as chamadas à API
│       ├── lib/format.ts          # formatação de números/datas
│       └── types/api.ts           # tipos das respostas da API
├── scripts/                       # scripts bash de operação (start, stop, doctor...)
├── docs/                          # esta documentação
├── docker-compose.yml
├── Dockerfile                     # multi-stage: imagem do backend e do frontend
└── .env.example
```

## 3.3 Fluxo de uma sincronização

Disparada por: botão no admin (`POST /api/admin/sync/:slug`), CLI (`npm run sync:data`) ou agendador.

```txt
syncSource(slug)                                   [sync.service.ts]
 ├─ trava em memória: se já está rodando → erro 409
 ├─ fonte está na lista permitida? senão → erro
 ├─ upsert em data_sources (nome, URL, status vindos do sources.ts)
 ├─ cria sync_jobs (status RUNNING)
 ├─ collectSinanTabnetSource()                     [sinan-tabnet.collector.ts]
 │    para cada uma das 4 consultas (anual, sexo, faixa etária, raça/cor):
 │      ├─ POST no TABNET (timeout 60 s)          [tabnet-client.ts]
 │      ├─ lê a tabela do <pre>                    [tabnet-prn.ts]
 │      ├─ normaliza linhas → registros
 │      ├─ salva HTML bruto em storage/raw-imports/<slug>/
 │      ├─ cria raw_imports (URL, parâmetros, hash, caminho do arquivo)
 │      └─ upsert de cada registro em epidemiological_records (chave: record_key)
 ├─ sucesso com registros → job SUCCESS, disponibilidade AVAILABLE
 ├─ sucesso sem registros → job UNAVAILABLE, disponibilidade NO_RECORDS_FOR_CITY
 └─ exceção               → job FAILED, disponibilidade ERROR (dados antigos são mantidos)
```

Detalhes da coleta em [05-coleta-de-dados.md](05-coleta-de-dados.md).

## 3.4 Fluxo de uma consulta do site

```txt
Página /tuberculose (DiseaseDashboard)
 ├─ GET /api/sources/tuberculose_sinan/summary   → cartões
 ├─ GET /api/sources/tuberculose_sinan/filters   → opções dos filtros
 ├─ GET /api/charts/{yearly-evolution,by-sex,by-age-group,by-race-color}?source=...
 └─ GET /api/records?source=...&page=...         → tabela
        └─ public-data.service.ts → Prisma → PostgreSQL
```

Cada consulta usa uma fonte só (a fonte derivada "arboviroses", que somava outras, saiu do sistema em 07/10/2026).

## 3.5 Agendador automático

[`sync-scheduler.ts`](../backend/src/modules/sync/sync-scheduler.ts), iniciado junto com o backend:

1. espera `SYNC_SCHEDULE_STARTUP_DELAY_SECONDS` (30 s) e faz a 1ª verificação;
2. depois verifica a cada `SYNC_SCHEDULE_CHECK_INTERVAL_MINUTES` (1 dia);
3. em cada verificação, sincroniza as fontes cuja **última sincronização com status SUCCESS** tem mais de `SYNC_SCHEDULE_INTERVAL_DAYS` (30 dias), ou que nunca tiveram sucesso.

Consequência: uma fonte que sempre falha é tentada de novo **todo dia**.
