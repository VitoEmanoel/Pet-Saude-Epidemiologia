# 6. Referência da API

Base: `http://localhost:3333` (ou `NEXT_PUBLIC_API_URL`). Todas as respostas são JSON, salvo as exportações.

Erros seguem sempre o formato ([`api-response.ts`](../backend/src/utils/api-response.ts)):

```json
{ "error": { "code": "invalid_query", "message": "texto", "details": {} } }
```

| `code` | HTTP | Quando |
|---|---|---|
| `invalid_query` | 400 | Parâmetro não permitido, filtro de outro município, `source` ausente |
| `unauthorized` | 401 | Sem sessão admin / credencial errada |
| `forbidden` | 403 | Requisição admin de origem não permitida |
| `not_found` | 404 | Fonte ou rota inexistente |
| `sync_already_running` | 409 | A fonte já está sincronizando |
| `rate_limited` | 429 | 5 logins errados em 15 min |
| `not_implemented` | 501 | Fonte sem coletor |
| `admin_not_configured` | 503 | Faltam `ADMIN_USERNAME`, `ADMIN_PASSWORD` ou `ADMIN_SESSION_SECRET` |
| `internal_error` | 500 | Erro inesperado |

## 6.1 Rotas públicas

| Método e rota | Arquivo | Retorna |
|---|---|---|
| `GET /health` | `server.ts` | `{status:"ok", city, category}` |
| `GET /api/sources` | `routes/sources.ts` | Catálogo de fontes públicas (sem `zika_sinan`) |
| `GET /api/sources/:slug` | idem | Uma fonte |
| `GET /api/sources/:slug/availability` | idem | Status do filtro municipal |
| `GET /api/sources/:slug/summary` | idem | Cartões: total de casos, anos, último ano, última sincronização |
| `GET /api/sources/:slug/filters` | idem | Valores possíveis de ano, sexo, faixa etária e raça/cor |
| `GET /api/dashboard/overview` | `routes/dashboard.ts` | Resumo geral + evolução anual somando todas as fontes |
| `GET /api/records` | `routes/records.ts` | Registros paginados |
| `GET /api/charts/yearly-evolution` | `routes/charts.ts` | `series: [{year, value}]` |
| `GET /api/charts/by-sex` | idem | `series: [{label, value}]` |
| `GET /api/charts/by-age-group` | idem | idem (ordenado por faixa) |
| `GET /api/charts/by-race-color` | idem | idem |

### Parâmetros de consulta (`/api/records` e `/api/charts/*`)

| Parâmetro | Tipo | Observação |
|---|---|---|
| `source` | slug | **Obrigatório** nos gráficos |
| `year`, `month` | número | `month` não tem dados hoje |
| `sex`, `ageGroup`, `raceColor`, `condition` | texto | Valor exato (use os valores de `/filters`) |
| `page` | número | Só em `/api/records` (padrão 1) |
| `pageSize` | número | Só em `/api/records` (padrão 50, máx. 500) |

Qualquer outro parâmetro devolve **400**. Os parâmetros `city`, `cidade`, `municipality`, `municipio`, `ibgeCode`, `ibge_code`, `cityIbgeCode`, `city_ibge_code`, `uf`, `state`, `estado` são bloqueados de propósito.

Como os filtros funcionam nos gráficos:

- o gráfico **anual** usa a fatia anual; com filtro de sexo, usa a fatia por sexo (e o mesmo para faixa etária e raça/cor);
- cada gráfico por dimensão só tem dados da própria dimensão; por isso, **com filtro de sexo, os gráficos de faixa etária e raça/cor ficam vazios** (ver [04-banco-de-dados.md](04-banco-de-dados.md#42-ponto-essencial-as-4-agregações-convivem-na-mesma-tabela)).

Exemplos:

```bash
curl 'http://localhost:3333/api/sources/tuberculose_sinan/summary'
curl 'http://localhost:3333/api/charts/by-sex?source=tuberculose_sinan&year=2024'
curl 'http://localhost:3333/api/records?source=dengue_sinan&year=2010&pageSize=10'
curl 'http://localhost:3333/api/records?source=tuberculose_sinan&municipio=Teresina'   # → 400
```

## 6.2 Rotas administrativas (`/api/admin`)

Todas respondem com cabeçalhos anti-cache e de segurança. Requisições que **não são GET** com cabeçalho `Origin` fora de `CORS_ORIGIN` recebem 403.

| Método e rota | Autenticação | O que faz |
|---|---|---|
| `POST /api/admin/auth/login` | — | Body `{username, password}`. Cria o cookie `painel_admin_session` (8 h) |
| `GET /api/admin/auth/me` | sessão | Confirma se a sessão é válida |
| `POST /api/admin/auth/logout` | sessão | Apaga o cookie |
| `POST /api/admin/sync/:sourceSlug` | sessão | Sincroniza uma fonte e **espera terminar** (pode levar ~10 s) |
| `POST /api/admin/sync-all` | sessão | Sincroniza todas as fontes em sequência (~45 s) |
| `GET /api/admin/sync-history` | sessão | Últimos 50 jobs |
| `GET /api/admin/audit-logs` | sessão | Últimos 100 eventos de auditoria |
| `GET /api/admin/records/export.csv` | sessão | CSV com os mesmos filtros de `/api/records` (sem paginação) |
| `GET /api/admin/dashboard/export.html` | sessão | Relatório HTML autocontido de uma fonte (`source` obrigatório) |

Uso por linha de comando:

```bash
# login (guarda o cookie em cj.txt)
curl -c cj.txt -X POST http://localhost:3333/api/admin/auth/login \
  -H 'content-type: application/json' -H 'origin: http://localhost:3000' \
  -d '{"username":"admin","password":"SUA_SENHA"}'

# sincronizar uma fonte
curl -b cj.txt -X POST -H 'origin: http://localhost:3000' http://localhost:3333/api/admin/sync/dengue_sinan

# exportar CSV
curl -b cj.txt -o dengue.csv 'http://localhost:3333/api/admin/records/export.csv?source=dengue_sinan'
```

Alternativa para scripts: defina `ADMIN_ALLOW_BEARER_TOKEN=true` e `ADMIN_TOKEN=<token>` e envie `Authorization: Bearer <token>`.

## 6.3 Testes automatizados

Os testes do backend (`npm run test:backend`) e a suíte de QA que testa a API com o sistema no ar (`npm run test:e2e`) estão descritos em [13-testes.md](13-testes.md).
