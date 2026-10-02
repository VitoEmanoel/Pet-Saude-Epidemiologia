# 4. Banco de dados

- Banco: **PostgreSQL 16**, nome padrão `pet_saude`.
- Modelo: [`backend/prisma/schema.prisma`](../backend/prisma/schema.prisma) (é a fonte da verdade; os diagramas em [diagramas/](diagramas/) são ilustrativos).
- Alterações de estrutura são feitas por **migrations** em `backend/prisma/migrations/`.

## 4.1 Tabelas

```txt
data_sources 1───1 data_availability
     │1
     ├────────* sync_jobs 1───* raw_imports
     ├────────* raw_imports
     └────────* epidemiological_records *───1 sync_jobs

admin_audit_logs (independente)
```

### `data_sources`: cadastro das fontes

Reflete o que está em `backend/src/config/sources.ts`. É atualizada pelo seed e no início de cada sincronização.

| Coluna | Significado |
|---|---|
| `slug` | Identificador único (ex.: `tuberculose_sinan`) |
| `name`, `system`, `category`, `source_url` | Dados descritivos |
| `municipality_filter_available` | A fonte permite filtrar por município? |
| `active` | Fonte ativa |

### `data_availability`: situação atual de cada fonte (1 linha por fonte)

| `status` | Quando acontece |
|---|---|
| `UNKNOWN` | Ainda não validada |
| `AVAILABLE` | Última coleta trouxe registros de Parnaíba |
| `NO_RECORDS_FOR_CITY` | Coleta funcionou, mas veio vazia |
| `MUNICIPAL_FILTER_UNAVAILABLE` | Fonte não permite filtro municipal |
| `ERROR` | Última coleta falhou (a mensagem fica em `message`) |

### `sync_jobs`: histórico de sincronizações

| Coluna | Significado |
|---|---|
| `status` | `RUNNING`, `SUCCESS`, `FAILED`, `UNAVAILABLE` (também existem `PENDING`, `PARTIAL_SUCCESS`, `SKIPPED`, ainda não usados) |
| `started_at`, `finished_at` | Início e fim |
| `records_imported` | Quantos registros foram gravados/atualizados |
| `error_message` | Motivo da falha |
| `requested_by` | Quem pediu: `admin_api`, `admin_api_sync_all`, `cli`, `scheduler` |

> Um job que ficou `RUNNING` para sempre indica que o processo foi morto no meio da coleta.

### `raw_imports`: rastro de cada consulta ao TABNET

Uma linha por consulta (são 4 por sincronização).

| Coluna | Significado |
|---|---|
| `request_url`, `request_params` | URL e parâmetros enviados (em JSON legível) |
| `content_hash` | SHA-256 da resposta |
| `stored_path` | Caminho do HTML salvo em `backend/storage/raw-imports/<slug>/` |
| `row_count` | Registros extraídos dessa resposta |

### `epidemiological_records`: os números exibidos no site

| Coluna | Significado |
|---|---|
| `source_id`, `sync_job_id` | De qual fonte e de qual sincronização veio |
| `state`, `state_code`, `city`, `city_ibge_code` | Sempre Piauí / PI / Parnaíba / 2207702 |
| `year` | Ano (de diagnóstico ou de 1º sintoma, conforme a fonte) |
| `month` | Não usado hoje (sempre nulo) |
| `disease_or_condition` | Ex.: `Tuberculose` |
| `metric` | O que o número conta: `casos_confirmados`, `frequencia`, `casos_provaveis`, `todos_os_casos` |
| `value` | O número |
| `sex`, `age_group`, `race_color` | Dimensão do registro (no máximo **uma** preenchida, ver abaixo) |
| `source_table` | Tipo de agregação, ex.: `tabnet_tuberculose_by_sex_residence` |
| `dimensions` | JSON com metadados (tipo de agregação, códigos TABNET) |
| `record_key` | Hash único (fonte + tabela + município + ano + dimensões). Garante que sincronizar de novo **atualiza** em vez de duplicar |

### `admin_audit_logs`: auditoria da área administrativa

Logins (sucesso/falha), logouts, exportações, sincronizações e requisições bloqueadas, com IP, navegador e detalhes (`metadata`).

## 4.2 Ponto essencial: as 4 agregações convivem na mesma tabela

O TABNET devolve totais por **uma dimensão de cada vez**. Para cada fonte e ano existem, portanto, 4 "fatias" dos **mesmos casos**:

| `source_table` contém | `sex` | `age_group` | `race_color` | Exemplo (tuberculose 2024) |
|---|---|---|---|---|
| `_yearly_` | nulo | nulo | nulo | 1 linha: 86 |
| `_by_sex_` | preenchido | nulo | nulo | 2 linhas que somam 86 |
| `_by_age_group_` | nulo | preenchido | nulo | várias linhas que somam 86 |
| `_by_race_color_` | nulo | nulo | preenchido | várias linhas que somam 86 |

Consequências:

- **Nunca some** a coluna `value` de todas as linhas: cada caso aparece 4 vezes. Para totais, filtre `source_table LIKE '%_yearly_%'`.
- Por isso a API (`/api/records` e o CSV) mostra **uma visão por vez** (parâmetro `aggregation`, ver [06](06-api.md)): sem filtro, o total do ano; com filtro de sexo, a visão por sexo; e assim por diante.
- **Não existe cruzamento** (ex.: homens de 20-39 anos). Não dá para obter isso com os dados atuais.

Distribuição real após uma sincronização completa (01/10/2026):

| Fonte | anual | sexo | faixa etária | raça/cor | anos |
|---|---|---|---|---|---|
| tuberculose_sinan | 25 | 50 | 275 | 150 | 2001–2025 |
| hanseniase_sinan | 30 | 90 | 60 | 180 | 1988–2026 |
| sifilis_congenita_sinan | 16 | 48 | 48 | 80 | 2008–2024 |
| sifilis_gestacional_sinan | 17 | 17 | 68 | 102 | 2008–2024 |
| dengue_sinan | 7 | 21 | 77 | 42 | 2007–2013 |
| zika_sinan | 10 | 20 | 100 | 50 | 2016–2025 |

## 4.3 Consultas úteis (SQL)

Abrir um terminal SQL:

```bash
# com o fluxo Docker oficial
docker compose --env-file .env exec postgres psql -U postgres -d pet_saude
```

```sql
-- Situação de cada fonte
SELECT s.slug, a.status, a.message, a.checked_at
FROM data_sources s LEFT JOIN data_availability a ON a.source_id = s.id;

-- Últimas sincronizações
SELECT j.id, s.slug, j.status, j.records_imported, j.requested_by, j.started_at, j.finished_at, j.error_message
FROM sync_jobs j JOIN data_sources s ON s.id = j.source_id
ORDER BY j.id DESC LIMIT 20;

-- Casos por ano de uma fonte (total correto, sem duplicar)
SELECT year, value FROM epidemiological_records r
JOIN data_sources s ON s.id = r.source_id
WHERE s.slug = 'tuberculose_sinan' AND r.source_table LIKE '%\_yearly\_%'
ORDER BY year;

-- Jobs presos em RUNNING
SELECT * FROM sync_jobs WHERE status = 'RUNNING';

-- Últimos eventos de auditoria
SELECT created_at, action, status, ip_address, metadata FROM admin_audit_logs ORDER BY id DESC LIMIT 20;
```

## 4.4 Migrations, seed e backup

| Tarefa | Comando |
|---|---|
| Aplicar migrations pendentes | `npm run prisma:deploy` (o `npm run start` já faz) |
| Criar migration após editar `schema.prisma` | `npm run prisma:migrate -- --name descricao_curta` (modo dev, ver [02](02-instalacao-e-execucao.md#24-modo-desenvolvimento-sem-docker-para-o-código)) |
| Recadastrar fontes | `npm run prisma:seed` |
| Ver o banco num navegador | `npm --workspace backend run prisma:studio` |

Backup e restauração (fluxo Docker):

```bash
# backup
docker compose --env-file .env exec -T postgres pg_dump -U postgres -d pet_saude -Fc > backup_$(date +%F).dump

# restauração (substitui o conteúdo atual)
docker compose --env-file .env exec -T postgres pg_restore -U postgres -d pet_saude --clean --if-exists < backup_AAAA-MM-DD.dump
```

> Os dados de `epidemiological_records` sempre podem ser recriados com `npm run sync:data`. O que **não** se recupera sem backup: o histórico de `sync_jobs`, `raw_imports` e `admin_audit_logs`.
