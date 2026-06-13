# API Fase 4 - Dados reais

Data da validacao: 2026-06-13

## Objetivo

Conectar as rotas publicas da API ao PostgreSQL para expor os dados reais ja coletados da fonte piloto `tuberculose_sinan`.

## Endpoints validados

```txt
GET /api/dashboard/overview
GET /api/sources/tuberculose_sinan/summary
GET /api/sources/tuberculose_sinan/filters
GET /api/records?source=tuberculose_sinan&page=1&pageSize=3
GET /api/records?source=tuberculose_sinan&year=2024&pageSize=2
GET /api/records/export.csv?source=tuberculose_sinan&year=2024
GET /api/charts/yearly-evolution?source=tuberculose_sinan
GET /api/charts/by-sex?source=tuberculose_sinan
GET /api/charts/by-age-group?source=tuberculose_sinan
GET /api/charts/by-race-color?source=tuberculose_sinan
```

## Numeros retornados

Resumo geral:

```txt
totalRecords: 500
totalCases: 1856
sourcesWithMunicipalData: 1
sourcesPendingValidation: 12
dataStatus: synced
```

Resumo da fonte:

```txt
firstAvailableYear: 2001
lastAvailableYear: 2025
latestYear: 2025
latestYearValue: 70
lastSyncStatus: SUCCESS
municipalityDataAvailable: true
```

## Graficos

Graficos com dados reais implementados:

- Evolucao anual.
- Por sexo.
- Por faixa etaria.
- Por raca/cor.

A faixa etaria foi ordenada em sequencia epidemiologica:

```txt
Menor de 1 ano
1-4
5-9
10-14
15-19
20-39
40-59
60-64
65-69
70-79
80 anos e mais
```

## Exportacao CSV

Endpoint implementado:

```txt
GET /api/records/export.csv
```

O CSV respeita os mesmos filtros publicos de `GET /api/records`, exceto paginacao.

## Protecoes validadas

- `GET /api/records?city=Teresina` retorna erro `invalid_query`.
- `GET /api/records?source=fonte_invalida` retorna erro `not_found`.
- `GET /api/charts/yearly-evolution` sem `source` retorna erro `invalid_query`.
- Endpoints publicos continuam sem aceitar troca de municipio.

## Testes automatizados

Comando validado:

```txt
npm run test:backend
```

Resultado:

```txt
tests: 5
pass: 5
fail: 0
```

Coberturas adicionadas:

- Health check com cidade fixa.
- Bloqueio de filtro por municipio.
- Fonte fora da lista permitida.
- Grafico anual exigindo `source`.
- Fonte inexistente em `/api/sources/:slug`.

