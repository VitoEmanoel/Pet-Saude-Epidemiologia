# 1. Visão geral do sistema

## O que é

O **Painel Epidemiológico de Parnaíba (PET-Saúde)** é um site que mostra dados públicos de doenças de notificação **exclusivamente do município de Parnaíba - PI**.

Os dados vêm do **DATASUS/TABNET** (sistema público do Ministério da Saúde). O sistema:

1. busca os dados automaticamente no TABNET (sem exportação manual);
2. guarda uma cópia bruta de cada resposta (para auditoria);
3. organiza ("normaliza") os números e salva num banco PostgreSQL próprio;
4. exibe tudo num site com indicadores, gráficos, mapa e tabela.

Quem visita o site **nunca** acessa o DATASUS diretamente: o site lê apenas o banco do próprio sistema.

```txt
DATASUS/TABNET ──► Backend (coletor) ──► PostgreSQL ──► API ──► Site (frontend)
                        │
                        └──► arquivos HTML brutos (auditoria)
```

## Regras fixas do projeto (não mudar sem decisão da coordenação)

| Regra | Onde está garantida no código |
|---|---|
| Só dados de **Parnaíba - PI**, código IBGE **2207702** | [`backend/src/config/city.ts`](../backend/src/config/city.ts) |
| Só a seção **Epidemiológicas e Morbidade** do DATASUS | `ALLOWED_DATASUS_CATEGORY` no mesmo arquivo |
| Lista fechada de fontes permitidas | [`backend/src/config/sources.ts`](../backend/src/config/sources.ts) |
| A API recusa filtros de outro município (`city`, `uf`, `ibgeCode`...) | [`backend/src/routes/records-query.ts`](../backend/src/routes/records-query.ts) |
| O frontend não consulta o DATASUS | [`frontend/src/lib/api.ts`](../frontend/src/lib/api.ts) só chama a API própria |
| Nunca inventar, estimar ou aproximar dados | Os coletores só gravam o que o TABNET retornou |
| Exportação de dados apenas na área administrativa | Rotas `/api/admin/...` |

A especificação original completa (com as 13 fontes previstas inicialmente) está em [00-especificacao-original.md](00-especificacao-original.md).

## Doenças/agravos cobertos hoje

| Página do site | Identificador (`slug`) | Tipo | Origem no TABNET |
|---|---|---|---|
| Tuberculose | `tuberculose_sinan` | primária | `sinannet/cnv/tubercbr.def` |
| Hanseníase | `hanseniase_sinan` | primária | `sinannet/cnv/hanswbr.def` |
| Sífilis congênita | `sifilis_congenita_sinan` | primária | `sinannet/cnv/sifilisbr.def` |
| Dengue | `dengue_sinan` | primária | `sinannet/cnv/denguebr.def` (2007–2013) + `sinannet/cnv/denguebbr.def` (2014 em diante) |
| Zika | `zika_sinan` | primária (casos prováveis: notificações exceto descartadas) | `sinannet/cnv/zikabr.def` |
| Chikungunya | `chikungunya_sinan` | primária (casos prováveis; 2015 sem classificação entra inteiro) | `sinannet/cnv/chikunbr.def` |
| Sífilis gestacional | `sifilis_gestacional_sinan` | primária | `sinannet/cnv/sifilisgestantepi.def` |
| Arboviroses | `arboviroses_sinan` | **derivada** (soma dengue + zika + chikungunya) | — |

- **primária**: coletada diretamente do TABNET e exibida no site.
- **derivada**: não é coletada; é montada somando outras fontes.
- **interna**: coletada só para compor outra fonte, sem página própria (nenhuma hoje; a zika era interna até o A1).

Pendente: incluir **chikungunya** em arboviroses (ver [12-plano-de-acao.md](12-plano-de-acao.md)).

## Público do sistema

| Perfil | O que faz | Onde |
|---|---|---|
| Visitante | Consulta indicadores, gráficos e tabela | `http://<servidor>:3000` |
| Administrador | Faz login, sincroniza fontes, exporta CSV/HTML, vê histórico e auditoria | `http://<servidor>:3000/admin` |
| Mantenedor (você) | Sobe o sistema, atualiza fontes, corrige problemas | Este manual |

## Tecnologias

| Parte | Tecnologia | Para que serve |
|---|---|---|
| Linguagem | TypeScript | Todo o código (backend e frontend) |
| Backend | Node.js 24 (LTS) + Express | API HTTP |
| Banco | PostgreSQL 16 + Prisma (ORM) | Armazenamento e migrations |
| Frontend | Next.js 15 + React 19 + Tailwind CSS | Site |
| Gráficos | ECharts | Gráficos dos dashboards |
| Mapa | Leaflet / react-leaflet | Mapa de Parnaíba |
| Infra | Docker + Docker Compose | Sobe tudo com um comando |

## Glossário

| Termo | Significado |
|---|---|
| **DATASUS** | Departamento de Informática do SUS; publica dados de saúde. |
| **TABNET** | Ferramenta web do DATASUS para montar tabelas. Não é uma API moderna: é um formulário HTML. |
| **SINAN** | Sistema de Informação de Agravos de Notificação (de onde vêm todas as fontes atuais). |
| **`.def`** | Arquivo de definição de uma tabela TABNET (ex.: `tubercbr.def`). Identifica a fonte. |
| **`.dbf` / arquivos de período** | Cada ano de dados no TABNET é um arquivo (ex.: `tubebr24.dbf` = 2024). |
| **formato `prn`** | Saída do TABNET em texto separado por `;` dentro de um bloco `<pre>`. É o que o coletor lê. |
| **Município de residência** | Filtro usado: casos de pessoas que **moram** em Parnaíba (recomendado para análise epidemiológica). |
| **Slug** | Identificador da fonte no código (ex.: `tuberculose_sinan`). |
| **Sincronização (sync)** | Execução de coleta de uma fonte: busca no TABNET + grava no banco. |
| **Normalização** | Padronizar valores (ex.: "Ign/Branco" → "Ignorado"). |
| **`recordKey`** | Hash único de cada registro; evita duplicar dados ao sincronizar de novo. |
| **Migration** | Script que altera a estrutura do banco (gerado pelo Prisma). |
| **Seed** | Script que cadastra as fontes permitidas no banco. |
