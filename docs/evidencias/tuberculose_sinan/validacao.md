# Validacao tecnica - Tuberculose SINAN

Data da validacao: 2026-06-13

## Fonte

- Fonte: TUBERCULOSE - Casos confirmados notificados no Sistema de Informacao de Agravos de Notificacao - Brasil.
- Sistema: SINAN Net.
- Categoria do projeto: Epidemiologicas e Morbidade.
- URL do formulario: `http://tabnet.datasus.gov.br/cgi/deftohtm.exe?sinannet/cnv/tubercbr.def`
- Endpoint de consulta: `http://tabnet.datasus.gov.br/cgi/tabcgi.exe?sinannet/cnv/tubercbr.def`

## Resultado da validacao

- A fonte possui filtro municipal.
- O filtro por municipio de residencia esta disponivel.
- O filtro por municipio de notificacao tambem esta disponivel.
- Parnaiba aparece no formulario como `220770 PARNAIBA`.
- O valor interno da opcao de Parnaiba no formulario TABNET e `827`.
- Para o projeto, a consulta piloto deve usar municipio de residencia, porque as notas tecnicas da propria pagina orientam usar local de residencia para analise epidemiologica/incidencia.
- O formato `prn` retorna colunas separadas por `;`, adequado para parser no backend.

## Consulta controlada realizada

Consulta de teste:

```txt
Linha=Ano_Diagnostico
Coluna=--Nao-Ativa--
Incremento=Casos_confirmados
Arquivos=tubebr24.dbf
SMunicipio_de_residencia=827
formato=prn
mostre=Mostra
```

Observacao tecnica: os nomes reais dos campos com acento precisam ser enviados ao TABNET em `iso-8859-1`/Latin-1. Na requisicao validada, os campos foram enviados com percent-encoding Latin-1.

## Resposta confirmada

A resposta do TABNET confirmou:

```txt
Municipio de residencia: 220770 PARNAIBA
Periodo: 2024
Ano Diagnostico;Casos confirmados
2024;86
Total;86
```

Esses valores foram usados apenas para validar a fonte. A importacao oficial do sistema ainda sera implementada na Fase 3.

## Periodos disponiveis

O formulario lista arquivos anuais de `tubebr01.dbf` ate `tubebr25.dbf`, correspondendo a 2001 ate 2025.

As notas da pagina indicam:

- dados de 2001 a 2019 finalizados;
- dados de 2020 a 2025 atualizados em abril/2026 e sujeitos a revisao;
- dados disponibilizados no TABNET em 05/2026.

## Dimensoes relevantes encontradas

- Ano Diagnostico.
- Mes Diagnostico.
- Ano Notificacao.
- Mes Notificacao.
- Ano Inicio Tratamento.
- Mes Inicio Tratamento.
- UF de notificacao.
- Municipio de notificacao.
- UF de residencia.
- Municipio de residencia.
- Faixa etaria.
- Faixa etaria 7.
- Faixa etaria 13.
- Sexo.
- Raca.
- Tipo de entrada.
- Forma.
- Aids.
- Alcoolismo.
- Diabetes.
- HIV.
- Situacao de encerramento.

Observacao: nao foi identificado um filtro geral de agravo nesta fonte. Para esta fonte piloto, o agravo/condicao ja e a propria Tuberculose.

## Evidencias salvas

- `formulario_tabnet_tuberculose_2026-06-13.html`
- `formulario_headers_2026-06-13.txt`
- `consulta_parnaiba_residencia_2024_prn_2026-06-13.html`
- `consulta_headers_2026-06-13.txt`

## Proxima etapa

Implementar o coletor da Fase 3 para:

- montar a requisicao TABNET com encoding correto;
- baixar a resposta `prn`;
- extrair o bloco `<PRE>`;
- converter as linhas separadas por `;` em JSON;
- normalizar os registros;
- salvar em `raw_imports`, `sync_jobs` e `epidemiological_records`.
