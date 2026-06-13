# Coleta Fase 3 - Tuberculose SINAN

Data da execucao validada: 2026-06-13

## Objetivo

Implementar e validar o coletor real da fonte piloto `tuberculose_sinan`, usando o DATASUS/TABNET como origem e persistindo os dados no PostgreSQL.

## Rota usada

```txt
POST /api/admin/sync/tuberculose_sinan
Authorization: Bearer dev-admin-token
```

## Consultas executadas no TABNET

Todas as consultas usam:

```txt
Fonte: sinannet/cnv/tubercbr.def
Linha: Ano_Diagnostico
Incremento: Casos_confirmados
Municipio de residencia: 220770 PARNAIBA
Opcao interna TABNET: 827
Formato: prn
Periodos: 2001 a 2025
```

Dimensoes coletadas:

- Total anual.
- Sexo.
- Faixa etaria.
- Raca/cor.

## Resultado da execucao

Primeira execucao validada:

```txt
sync_job_id: 1
status: SUCCESS
raw_imports: 4
records_imported: 500
```

Reprocessamento validado:

```txt
sync_job_id: 2
status: SUCCESS
raw_imports: 4
records_imported: 500
```

## Validacao de idempotencia

Apos executar a sincronizacao duas vezes:

```txt
epidemiological_records: 500
sync_jobs: 2
raw_imports: 8
```

Conclusao: os registros normalizados nao foram duplicados. O `record_key` esta funcionando como chave estavel para upsert.

## Validacao municipal

Consulta no banco confirmou:

```txt
city_ibge_code: 2207702
city: Parnaiba
state_code: PI
records: 500
```

Nenhum registro de outro municipio foi salvo.

## Distribuicao dos registros normalizados

```txt
tabnet_tuberculose_yearly_residence: 25
tabnet_tuberculose_by_sex_residence: 50
tabnet_tuberculose_by_age_group_residence: 275
tabnet_tuberculose_by_race_color_residence: 150
```

## Arquivos brutos

As respostas brutas da coleta sao salvas localmente em:

```txt
backend/storage/raw-imports/tuberculose_sinan/
```

Esse diretorio esta no `.gitignore`, porque contem arquivos gerados por execucao.

## Comportamento implementado

- Cria job em `sync_jobs`.
- Executa consultas TABNET no backend.
- Envia parametros com percent-encoding Latin-1.
- Baixa resposta HTML com bloco `PRE` em formato `prn`.
- Calcula hash SHA-256 da resposta bruta.
- Salva arquivo bruto em disco.
- Registra importacao em `raw_imports`.
- Converte tabela `prn` em linhas estruturadas.
- Normaliza ano, sexo, faixa etaria e raca/cor.
- Fixa cidade como Parnaiba - PI, codigo IBGE `2207702`.
- Gera `record_key` estavel.
- Faz upsert em `epidemiological_records`.
- Atualiza disponibilidade da fonte.
- Registra falhas sem apagar dados antigos.
- Bloqueia sincronizacao de fontes ainda nao implementadas.

## Proxima etapa

A Fase 4 deve conectar as rotas publicas ao PostgreSQL para que o frontend passe a exibir os dados reais coletados.

