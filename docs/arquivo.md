# Como o sistema funciona hoje

Atualizado em: 2026-06-22

Este documento resume o comportamento atual do sistema, com foco em:

- como as fontes sao definidas e validadas;
- como o backend busca os dados no DATASUS/TABNET;
- onde os dados brutos e normalizados ficam armazenados;
- como o painel web le esses dados.

## Visao geral

O sistema opera com cidade fixa em Parnaiba - PI. O fluxo atual e este:

1. O backend possui uma lista controlada de fontes permitidas.
2. Quando uma fonte e sincronizada, o backend consulta o DATASUS/TABNET.
3. A resposta bruta e salva em disco para auditoria.
4. Os dados sao normalizados e gravados no PostgreSQL.
5. O frontend nao consulta o DATASUS diretamente. Ele consome a API local.
6. O painel web mostra indicadores, graficos, tabelas e o catalogo de fontes a partir do banco.

## Fontes permitidas

As fontes aceitas pelo sistema estao declaradas em `backend/src/config/sources.ts`.

Ali existem tres classificacoes importantes:

- `primary`: fonte principal, usada para coleta publica.
- `derived`: fonte derivada, montada a partir de outras fontes.
- `internal`: fonte usada internamente e nao exposta no catalogo publico.

No estado atual, o catalogo publico inclui:

- `tuberculose_sinan`
- `hanseniase_sinan`
- `sifilis_congenita_sinan`
- `dengue_sinan`
- `arboviroses_sinan`
- `sifilis_gestacional_sinan`

Existe tambem `zika_sinan`, mas ela e classificada como `internal`, entao nao aparece no painel publico.

## Como a coleta funciona

A coleta pode acontecer de tres formas:

- manualmente pela area administrativa;
- via script de linha de comando (`backend/src/scripts/sync-data.ts`);
- automaticamente pelo agendador de sincronizacao (`backend/src/modules/sync/sync-scheduler.ts`).

O controle central esta em `backend/src/modules/sync/sync.service.ts`.

### Regras do processo

- A fonte precisa estar na lista permitida.
- Apenas uma sincronizacao por fonte pode rodar ao mesmo tempo.
- Se a fonte nao tiver filtro municipal disponivel, o job e encerrado como indisponivel.
- Se a fonte nao tiver coletor implementado, o sistema retorna erro de suporte.
- O backend atualiza o cadastro da fonte antes de coletar, para manter nome, sistema, URL e status sincronizados.

## Como o backend busca os dados

Os coletores do projeto usam o DATASUS/TABNET por requisicao HTTP `POST`.

O fluxo geral e:

1. Montar os parametros do formulario TABNET.
2. Enviar a requisicao para a URL oficial da fonte.
3. Receber a resposta em HTML no formato `prn`.
4. Extrair o bloco `<pre>`.
5. Decodificar e ler a tabela semicolon-separated.
6. Normalizar os campos.
7. Salvar a resposta bruta e os registros tratados.

Os pontos principais dessa etapa ficam em:

- `backend/src/modules/datasus/tabnet-client.ts`
- `backend/src/modules/datasus/tabnet-prn.ts`
- `backend/src/modules/datasus/sinan-tabnet.collector.ts`
- `backend/src/modules/datasus/tuberculosis-sinan.collector.ts`

### O que e normalizado

Os coletores convertem a resposta TABNET em registros com estes campos principais:

- ano
- valor
- sexo
- faixa etaria
- raca/cor
- agravo/doenca
- metricas e dimensoes auxiliares
- identificador estavel do registro (`recordKey`)

No banco, esses registros vao para `epidemiological_records`.

## Onde as fontes coletadas ficam guardadas

### 1. Banco de dados

O PostgreSQL guarda o estado estruturado do sistema. As tabelas mais importantes para as fontes sao:

- `data_sources`: cadastro da fonte
- `data_availability`: disponibilidade municipal da fonte
- `sync_jobs`: historico de sincronizacoes
- `raw_imports`: metadados das importacoes brutas
- `epidemiological_records`: registros epidemiologicos normalizados

O schema esta em `backend/prisma/schema.prisma`.

### 2. Arquivos brutos em disco

Além do banco, o sistema salva o HTML bruto recebido do TABNET no filesystem.

O caminho atual e montado dentro do backend assim:

- `backend/storage/raw-imports/<sourceSlug>/`

Para a fonte de tuberculose, por exemplo, os arquivos ficam em algo como:

- `backend/storage/raw-imports/tuberculose_sinan/`

Cada importacao gera um arquivo com nome baseado em data e hora, no formato:

- `<timestamp>_<sourceSlug>_<queryName>.html`

O caminho relativo desse arquivo e gravado na coluna `stored_path` da tabela `raw_imports`.

### 3. Metadados da importacao

Cada importacao bruta tambem registra no banco:

- URL consultada;
- parametros usados na requisicao;
- formato de resposta;
- hash SHA-256 do conteudo;
- quantidade de linhas importadas;
- relacao com o job de sincronizacao.

Isso permite auditoria e rastreabilidade da coleta sem depender apenas do banco normalizado.

## Como o painel web usa esses dados

O frontend nao acessa o DATASUS diretamente. Ele consome a API local do backend por meio de `frontend/src/lib/api.ts`.

### Visao geral

A pagina inicial usa:

- `GET /api/sources`
- `GET /api/dashboard/overview`

Isso alimenta o quadro geral com:

- total de casos;
- total de registros normalizados;
- numero de fontes;
- fontes com dados municipais;
- fontes pendentes de validacao;
- grafico de evolucao anual.

Essa logica fica em:

- `frontend/src/components/dashboard/OverviewDashboard.tsx`

### Paginas por fonte

As paginas de cada fonte usam:

- `GET /api/sources/:slug/summary`
- `GET /api/sources/:slug/filters`
- `GET /api/charts/yearly-evolution`
- `GET /api/charts/by-sex`
- `GET /api/charts/by-age-group`
- `GET /api/charts/by-race-color`
- `GET /api/records`

O componente principal responsavel e:

- `frontend/src/components/dashboard/TuberculosisDashboard.tsx`

Esse mesmo padrao e reaproveitado para outras fontes do painel.

### Area administrativa

A area administrativa usa endpoints protegidos em `/api/admin` para:

- autenticar o usuario;
- ver historico de sincronizacoes;
- ver logs de auditoria;
- disparar sincronizacao manual;
- exportar registros em CSV.

## Resumo direto da persistencia

Se a pergunta for "onde o sistema guarda as fontes coletadas que ele exibe no painel web", a resposta pratica e:

- os dados estruturados ficam no PostgreSQL, principalmente em `epidemiological_records`;
- o arquivo bruto original fica em `backend/storage/raw-imports/...`;
- o caminho desse arquivo e guardado em `raw_imports.stored_path`;
- o cadastro da fonte fica em `data_sources`;
- o estado de disponibilidade fica em `data_availability`;
- o historico de cada execucao fica em `sync_jobs`.

## Observacoes importantes

- O sistema trabalha com municipio fixo e bloqueia filtros para outras cidades.
- O painel publico mostra apenas fontes permitidas.
- Fontes derivadas, como `arboviroses_sinan`, nao sao coletadas diretamente como fonte oficial unica; elas dependem da composicao de outras fontes.
- O frontend mostra apenas o que a API do backend ja consolidou e salvou.

