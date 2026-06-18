# Plano de fases

## Fase 1 - Fundacao do projeto

Objetivo: criar a base tecnica para que o projeto tenha escopo fixo, API inicial, banco modelado e infraestrutura local.

Entregas:

- Monorepo com `backend` e `frontend`.
- Backend Express com TypeScript.
- Configuracao fixa de Parnaiba - PI.
- Lista fixa de fontes permitidas.
- Rotas iniciais da API.
- Bloqueio de parametros de municipio nas consultas publicas.
- Area administrativa protegida por autenticacao.
- Schema Prisma para PostgreSQL.
- Docker Compose com PostgreSQL e Redis.

## Fase 2 - Validacao tecnica do DATASUS/TABNET

Objetivo: validar uma fonte real por vez, comecando por uma fonte piloto.

Entregas:

- Descoberta da URL real da fonte.
- Mapeamento dos parametros TABNET.
- Confirmacao de filtro municipal para Parnaiba.
- Identificacao do formato de retorno.
- Registro formal de disponibilidade municipal.
- Primeiro conector de coleta.

Fonte piloto recomendada: `tuberculose_sinan`.

## Fase 3 - Coleta e normalizacao

Objetivo: transformar a coleta validada em dados persistidos e consultaveis.

Entregas:

- Download dos dados brutos.
- Armazenamento/auditoria da importacao.
- Normalizacao para registros epidemiologicos.
- Upsert por chave estavel.
- Historico de sincronizacoes.
- Tratamento de erro por fonte.

## Fase 4 - Dashboard funcional

Objetivo: apresentar dados reais coletados para Parnaiba.

Entregas:

- Visao geral.
- Pagina da fonte piloto.
- Paginas de tuberculose, hanseniase, sifilis, dengue, arboviroses e sifilis gestacional.
- Cards de indicadores.
- Graficos de evolucao anual.
- Tabela paginada.
- Exportacao CSV administrativa.
- Mensagens de transparencia.

## Fase 5 - Expansao das fontes

Objetivo: repetir o fluxo validado para as demais fontes permitidas.

Entregas:

- Conectores por fonte.
- Status de disponibilidade por fonte.
- Sincronizacao manual por fonte.
- Sincronizacao geral.
- Agendamento mensal.
