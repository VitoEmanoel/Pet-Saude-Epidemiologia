# 5. Coleta de dados (DATASUS/TABNET)

## 5.1 Como o TABNET funciona

O TABNET não é uma API: é um **formulário HTML**. Cada fonte tem duas URLs:

| URL | Uso |
|---|---|
| `http://tabnet.datasus.gov.br/cgi/deftohtm.exe?sinannet/cnv/<arquivo>.def` | **Formulário** (abra no navegador para ver as opções) |
| `http://tabnet.datasus.gov.br/cgi/tabcgi.exe?sinannet/cnv/<arquivo>.def` | **Endpoint** que recebe o POST do formulário (é o que o coletor usa) |

O coletor envia o formulário como se um usuário clicasse em "Mostra", pedindo o formato `prn`. A resposta é um HTML com um bloco `<PRE>` contendo a tabela separada por `;`:

```txt
"Ano Diagnóstico";"Casos confirmados"
"2024";86
"Total";86
```

Exemplo real salvo: [evidencias/tuberculose_sinan/consulta_parnaiba_residencia_2024_prn_2026-06-13.html](evidencias/tuberculose_sinan/consulta_parnaiba_residencia_2024_prn_2026-06-13.html).

## 5.2 Parâmetros enviados

| Campo do formulário | Significado | Exemplo |
|---|---|---|
| `Linha` | O que vai nas linhas (sempre o ano) | `Ano_Diagn%F3stico` |
| `Coluna` | Dimensão nas colunas | `--N%E3o-Ativa--` (nenhuma), `Sexo`, `Fx_Et%E1ria`, `Ra%E7a` |
| `Incremento` | O que é contado | `Casos_confirmados` |
| `Arquivos` | Um por ano de dados (repetido) | `tubebr01.dbf` … `tubebr25.dbf` |
| `SMunic%EDpio_de_resid%EAncia` | Filtro de município de residência | `827` (valor interno de Parnaíba no formulário) |
| `formato` | Formato da saída | `prn` |
| `mostre` | Botão do formulário | `Mostra` |

**Atenção ao encoding:** o TABNET usa **Latin-1 (ISO-8859-1)**. Nomes com acento vão "percent-encoded" em Latin-1, **não** em UTF-8:

| Letra | Código | | Letra | Código |
|---|---|---|---|---|
| á | `%E1` | | ó | `%F3` |
| ã | `%E3` | | ç | `%E7` |
| ê | `%EA` | | í | `%ED` |
| º | `%BA` | | | |

O código de Parnaíba no IBGE de 6 dígitos é `220770`. O **valor interno** da opção no formulário muda conforme a fonte: `827` nas tabelas nacionais e `152` na de sífilis gestacional (tabela só do Piauí).

## 5.3 Configuração de cada fonte

Toda a configuração fica no objeto `collectorConfigs` em [`sinan-tabnet.collector.ts`](../backend/src/modules/datasus/sinan-tabnet.collector.ts):

| Slug | `.def` | Arquivos de período | Linha (ano) | Incremento | Coluna de faixa etária | Opção do município |
|---|---|---|---|---|---|---|
| tuberculose_sinan | `tubercbr` | `tubebr01..25` (2001–2025) | Ano Diagnóstico | Casos confirmados | `Fx_Etária` | 827 |
| hanseniase_sinan | `hanswbr` | `hansbr01..26` (2001–2026) | Ano Diagnóstico | Frequência | `Faixa_Etária_Hans` | 827 |
| sifilis_congenita_sinan | `sifilisbr` | `sifcbr07..24` | Ano Diagnóstico | Casos confirmados | `Faixa_Etária` | 827 |
| dengue_sinan | `denguebr` + `denguebbr` (2 segmentos) | `dengbr07..13` (2007–2013) + `dengbr14..26` (2014–2026) | Ano 1º Sintoma(s) | Casos prováveis | `Faixa_Etária` | 827 |
| sifilis_gestacional_sinan | `sifilisgestantepi` | `sifgpi07..24` | Ano de Diagnóstico | Casos confirmados | `Faixa_Etária` | **152** |
| chikungunya_sinan | `chikunbr` (2 segmentos) | `chikbr14..15` (sem filtro: não há classificação) + `chikbr16..26` | Ano 1º Sintoma(s) | Todos os casos **+ filtro Classificação ≠ Descartado** a partir de 2016 (= casos prováveis) | `Faixa_Etária` | 827 |
| zika_sinan | `zikabr` | `zikabr15..26` | Ano 1º Sintoma(s) | Todos os casos **+ filtro Classificação ≠ Descartado** (= casos prováveis, D7) | `Faixa_Etária` | 827 |

**Casos prováveis em todas as arboviroses.** Para dengue o TABNET já oferece o incremento "Casos prováveis". Para zika e chikungunya, o único incremento é "Todos os casos" (inclui descartados), então o filtro de classificação tira os descartados. Na chikungunya, 2014–2015 não têm classificação e entram sem filtro (nenhum caso foi descartado). Regra do DATASUS: casos prováveis = todas as notificações exceto as descartadas.

**Registros que somem.** Ao fim de uma coleta completa, o coletor apaga os registros da fonte que a coleta não renovou (ex.: um ano que ficou sem casos depois de uma revisão do DATASUS). Se a coleta falha no meio, nada é apagado.

**Consulta por classificação (A5).** Fontes com `classificationColumnEncoded` (dengue: `Class._Final`; zika e chikungunya: `Classificação`) fazem uma 5ª consulta por segmento, ano × classificação final, gravada em `classification_counts` (não em `epidemiological_records`). Segmentos com `skipClassification` (chikungunya 2014–2015, sem classificação) pulam essa consulta.

**Novas tentativas (O5).** Falha temporária do TABNET (rede, tempo esgotado, HTTP 5xx) é repetida até 3 vezes, com espera de 3 s e 10 s (`TABNET_RETRY_DELAYS_MS`). Resposta com layout diferente (sem o bloco `<PRE>`) não é repetida: é falha real. A situação de cada fonte aparece no admin (`/api/admin/source-health`).

**Anos novos automáticos (D5).** Os arquivos de período da tabela acima são o mínimo. A cada coleta, o último segmento de cada fonte recebe os arquivos mais novos que o formulário oferecer (`withDiscoveredPeriodFiles`, `listPeriodFilesInForm`, `newerPeriodFiles`). Se o formulário não carregar, segue a lista configurada.

Campos de `SinanTabnetCollectorConfig`:

| Campo | Para que serve |
|---|---|
| `sourceSlug` | Igual ao slug em `sources.ts` |
| `diseaseOrCondition`, `metric` | Gravados em cada registro |
| `segments` | Lista de **segmentos**: cada um tem `tabnetQueryUrl` (URL `tabcgi.exe?...def`), `periodFiles` (arquivos de ano; `numberedFiles(prefixo, início, fim)` gera `prefixoNN.dbf`) e, opcionalmente, `extraParams` (filtros extras do formulário já codificados, ex.: classificação da zika). Quase todas as fontes têm 1 segmento; a dengue tem 2, porque o DATASUS divide os anos em dois formulários. As 4 consultas rodam em cada segmento |
| `lineEncoded` / `lineLabel` | Linha (padrão: `Ano_Diagnóstico`) |
| `incrementEncoded` / `incrementLabel` | O que contar |
| `sourceTablePrefix` | Prefixo do `source_table` (ex.: `tabnet_tuberculose`) |
| `ageGroupColumnEncoded` / `ageGroupColumnLabel` | Nome da coluna de faixa etária, que varia entre fontes |
| `municipalityResidenceFilterEncoded` | Nome do campo de município, se diferente do padrão |
| `municipalityResidenceOptionValue` | Valor da opção de Parnaíba, se diferente de `827` |

## 5.4 Normalização aplicada

| Dado | Regra |
|---|---|
| Ano | Primeira coluna; linhas "Total" ou anos < 1900 são ignoradas |
| Número | `-` vira 0; o ponto de milhar é removido (`1.234` → 1234) |
| Coluna "Total" | Ignorada (evita contar duas vezes) |
| Sexo | `Masculino`, `Feminino`, `Em branco`, `Ignorado` |
| Faixa etária | "Ign/Branco" → `Ignorado`; `<1 Ano` → `Menor de 1 ano`; `80 e +` → `80 anos e mais`; o resto fica como veio |
| Raça/cor | `Branca`, `Preta`, `Amarela`, `Parda`, `Indigena`; "Ign/Branco" → `Ignorado` |

As faixas etárias **não são iguais entre fontes** (tuberculose usa `1-4`, `5-9`...; hanseníase usa `0 a 14 anos`, `15 anos e mais`). A ordem de exibição está em `AGE_GROUP_ORDER` em `public-data.service.ts`.

## 5.5 Como descobrir os parâmetros de uma fonte nova (ou que mudou)

1. Abra a URL do **formulário** (`deftohtm.exe?...def`) no navegador.
2. Use "Inspecionar elemento" (F12) e procure os `<select>`:
   - `name="Linha"`, `name="Coluna"`, `name="Incremento"`: o atributo `value` de cada `<option>` é o que vai no parâmetro;
   - `name="Arquivos"`: lista de arquivos por ano (veja o primeiro e o último);
   - o select de **Município de residência**: encontre `PARNAIBA` e anote o `value` da opção.
3. Converta acentos para Latin-1 (tabela acima).
4. Faça um teste manual (resposta deve ter `<PRE>`):

   ```bash
   curl -s 'http://tabnet.datasus.gov.br/cgi/tabcgi.exe?sinannet/cnv/tubercbr.def' \
     --data 'Linha=Ano_Diagn%F3stico&Coluna=--N%E3o-Ativa--&Incremento=Casos_confirmados&Arquivos=tubebr24.dbf&SMunic%EDpio_de_resid%EAncia=827&formato=prn&mostre=Mostra' \
     | iconv -f latin1 -t utf8 | sed -n '/<PRE>/,/<\/PRE>/p'
   ```

5. Registre o que encontrou em `docs/evidencias/<slug>/` (modelo: [evidencias/tuberculose_sinan/validacao.md](evidencias/tuberculose_sinan/validacao.md)).

O passo a passo para cadastrar a fonte no código está em [09-guia-de-manutencao.md](09-guia-de-manutencao.md).

## 5.6 Arquivos brutos

- Local: `backend/storage/raw-imports/<slug>/<data-hora>_<slug>_<consulta>.html` (Latin-1).
- Cerca de 150 KB por sincronização completa.
- Não vão para o git.
- No Docker **não há volume** para essa pasta: os arquivos se perdem quando o container do backend é recriado (o registro em `raw_imports` continua). Ver [11-limitacoes-conhecidas.md](11-limitacoes-conhecidas.md).
