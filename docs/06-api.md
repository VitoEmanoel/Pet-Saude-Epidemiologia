# 6. Referência da API

Base: `http://localhost:3333` (ou `NEXT_PUBLIC_API_URL`). Todas as respostas são JSON, salvo as exportações.

**Cabeçalhos de segurança** (`helmet` em [`server.ts`](../backend/src/server.ts), em todas as rotas): `Content-Security-Policy: default-src 'none'` (a API não serve páginas), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Strict-Transport-Security`, `Cross-Origin-Resource-Policy: same-site` (o frontend e a API precisam estar no mesmo site, ex.: `painel.x.gov.br` e `api.x.gov.br`, ou atrás do mesmo proxy). Sem `X-Powered-By`. As rotas do admin acrescentam os seus ([08](08-area-administrativa.md)).

Erros seguem sempre o formato ([`api-response.ts`](../backend/src/utils/api-response.ts)):

```json
{ "error": { "code": "invalid_query", "message": "texto", "details": {} } }
```

| `code` | HTTP | Quando |
|---|---|---|
| `invalid_query` | 400 | Parâmetro não permitido, filtro de outro município, `source` ausente |
| `invalid_body` | 400 | Corpo da requisição não é um JSON válido |
| `unauthorized` | 401 | Sem sessão admin / credencial errada |
| `forbidden` | 403 | Requisição admin de origem não permitida |
| `not_found` | 404 | Fonte ou rota inexistente |
| `sync_already_running` | 409 | A fonte já está sincronizando |
| `rate_limited` | 429 | 5 logins errados em 15 min |
| `not_implemented` | 501 | Fonte sem coletor |
| `admin_not_configured` | 503 | Faltam `ADMIN_USERNAME`, `ADMIN_PASSWORD` ou `ADMIN_SESSION_SECRET` |
| `payload_too_large` | 413 | Corpo da requisição acima de 100 KB |
| `internal_error` | 500 | Erro inesperado (detalhes só no log do backend, nunca na resposta) |

Os erros são tratados no fim de [`server.ts`](../backend/src/server.ts). O tratador de erro do Express **precisa ter 4 parâmetros** `(error, request, response, next)`: com 3, o Express não o reconhece e devolve a página de erro padrão em HTML.

## 6.1 Rotas públicas

| Método e rota | Arquivo | Retorna |
|---|---|---|
| `GET /health` | `server.ts` | `{status:"ok", city, category}` |
| `GET /api/sources` | `routes/sources.ts` | Catálogo de fontes públicas (sem `zika_sinan`) |
| `GET /api/sources/:slug` | idem | Uma fonte |
| `GET /api/sources/:slug/availability` | idem | Status do filtro municipal |
| `GET /api/sources/:slug/summary` | idem | Cartões: total de casos, anos, último ano, última sincronização |
| `GET /api/sources/:slug/filters` | idem | Valores possíveis de ano, sexo, faixa etária e raça/cor |
| `GET /api/dashboard/overview` | `routes/dashboard.ts` | Resumo geral e evolução anual somando as 5 fontes primárias públicas (sem a zika interna, sem contar a dengue duas vezes via arboviroses) + `casesBySource` (casos e período de cada fonte pública) |
| `GET /api/records` | `routes/records.ts` | Registros paginados de **uma visão** (`aggregation`); cada registro traz o campo `aggregation` |
| `GET /api/charts/yearly-evolution` | `routes/charts.ts` | `series: [{year, value}]` |
| `GET /api/charts/by-sex` | idem | `series: [{label, value}]` |
| `GET /api/charts/by-age-group` | idem | idem (ordenado por faixa) |
| `GET /api/charts/by-race-color` | idem | idem |

### Parâmetros de consulta (`/api/records` e `/api/charts/*`)

| Parâmetro | Tipo | Observação |
|---|---|---|
| `source` | slug | **Obrigatório** nos gráficos |
| `year`, `month` | número | `month` não tem dados hoje |
| `sex`, `ageGroup`, `raceColor`, `condition` | texto | Valor exato (use os valores de `/filters`). Só **uma** dimensão demográfica por vez na tabela/CSV |
| `aggregation` | `yearly`, `sex`, `age_group`, `race_color`, `all` | Só tabela e CSV. Visão dos casos. Sem o parâmetro: segue o filtro demográfico ou, sem filtro, `yearly`. `all` traz as 4 visões (cuidado: a soma conta cada caso 4 vezes) |
| `page` | número | Só em `/api/records` (padrão 1) |
| `pageSize` | número | Só em `/api/records` (padrão 50, máx. 500) |

Qualquer outro parâmetro devolve **400**. Na tabela e no CSV, também devolvem 400: `aggregation` inválido, visão que não combina com o filtro (ex.: `sex=Masculino&aggregation=age_group`) e mais de um filtro demográfico (o DATASUS não fornece dados cruzados). Os parâmetros `city`, `cidade`, `municipality`, `municipio`, `ibgeCode`, `ibge_code`, `cityIbgeCode`, `city_ibge_code`, `uf`, `state`, `estado` são bloqueados de propósito.

Como os filtros funcionam nos gráficos:

- **só um filtro demográfico por vez** (sexo, faixa etária ou raça/cor): dois ou mais devolvem 400, porque o DATASUS não fornece dados cruzados (ver [04-banco-de-dados.md](04-banco-de-dados.md#42-ponto-essencial-as-4-agregações-convivem-na-mesma-tabela));
- o gráfico **anual** usa a fatia anual; com filtro de sexo, usa a fatia por sexo (e o mesmo para faixa etária e raça/cor);
- cada gráfico por dimensão aplica só o filtro da **própria** dimensão (mais o ano). Ex.: com `sex=Masculino`, o gráfico por faixa etária mostra todas as pessoas daquele ano e a resposta traz `"ignoredFilters": ["sex"]`, para a interface avisar.

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
| `GET /api/admin/records/export.csv` | sessão | CSV com os mesmos filtros e a mesma regra de visão de `/api/records` (sem paginação); coluna `aggregation` |
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
