# Frontend Fase 5 - Dados reais

Data da validacao: 2026-06-13

## Objetivo

Construir o frontend funcional usando os dados reais expostos pela API da Fase 4.

## Telas implementadas

```txt
/
/tuberculose
```

## Visao geral

Itens implementados:

- Layout com header e menu lateral.
- Cards de resumo.
- Grafico de evolucao anual com dados reais.
- Tabela de fontes permitidas.
- Status municipal por fonte.
- Link para a fonte piloto validada.
- Mensagem de transparencia sobre DATASUS/TABNET e Parnaiba - PI.

## Pagina Tuberculose

Itens implementados:

- Cards reais da fonte piloto.
- Grafico de evolucao anual.
- Grafico por sexo.
- Grafico por faixa etaria.
- Grafico por raca/cor.
- Mapa destacando Parnaiba - PI.
- Filtros por ano, sexo, faixa etaria e raca/cor.
- Tabela paginada de registros reais.
- Exportacao CSV.
- Ultima atualizacao.
- Status da coleta.
- Aviso condicional para fonte sem dados municipais.
- Aviso condicional para falha de sincronizacao.

## Endpoints consumidos

```txt
GET /api/dashboard/overview
GET /api/sources
GET /api/sources/tuberculose_sinan/summary
GET /api/sources/tuberculose_sinan/filters
GET /api/charts/yearly-evolution?source=tuberculose_sinan
GET /api/charts/by-sex?source=tuberculose_sinan
GET /api/charts/by-age-group?source=tuberculose_sinan
GET /api/charts/by-race-color?source=tuberculose_sinan
GET /api/records?source=tuberculose_sinan
GET /api/records/export.csv?source=tuberculose_sinan
```

## Validacoes executadas

Builds:

```txt
npm run build:frontend
npm run build:backend
npm run test:backend
```

Resultado:

```txt
frontend build: OK
backend build: OK
backend tests: 5/5
```

HTTP local:

```txt
GET http://localhost:3000 -> 200
GET http://localhost:3000/tuberculose -> 200
```

Validacao visual:

- Desktop: pagina de Tuberculose renderizou cards, graficos, mapa, filtros e tabela.
- Mobile: pagina de Tuberculose renderizou sem overflow horizontal incoerente.

## Observacoes

- Os graficos usam `echarts`.
- O mapa usa `leaflet` e `react-leaflet`.
- Os icones usam `lucide-react`.
- O mapa depende dos tiles publicos do OpenStreetMap no navegador.

