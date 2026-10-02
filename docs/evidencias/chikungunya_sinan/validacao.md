# Validação técnica: Chikungunya SINAN (A2)

Data da validação: 02/10/2026 (item A2 do plano de ação)

## Fonte

- Formulário: `http://tabnet.datasus.gov.br/cgi/deftohtm.exe?sinannet/cnv/chikunbr.def`
- Consulta: `http://tabnet.datasus.gov.br/cgi/tabcgi.exe?sinannet/cnv/chikunbr.def`
- Arquivos: `chikbr14.dbf` … `chikbr26.dbf` (2014–2026)
- Município de residência: `SMunicípio_de_residência` = `827` (`220770 PARNAIBA`), igual às outras fontes
- Linha: `Ano 1º Sintoma(s)`; incremento: só **"Todos os casos"**; colunas: `Sexo`, `Faixa_Etária`, `Raça`
- Classificação (`SClassificação`): 1 Ign/Branco, 2 **Descartado**, 3 Chikungunya

## Consulta por classificação (Parnaíba)

```txt
"Ano 1º Sintoma(s)";"Ign/Branco";"Descartado";"Chikungunya";"Total"
"2016";-;24;112;136
"2017";-;281;841;1122
"2018";-;18;2;20
"2019";-;24;114;138
"2020";-;13;8;21
"2021";-;5;7;12
"2022";-;81;186;267
"2023";-;112;381;493
"2024";-;18;9;27
"2025";-;7;1;8
"2026";2;9;-;11
"Total";2;592;1661;2255
```

Sem a coluna de classificação, o total é **2.306**: a diferença (51) é **2015**, cujo arquivo não tem a classificação preenchida. Com o filtro de classificação, 2015 some da resposta.

## Regra adotada

Casos prováveis = notificações exceto descartadas (mesma regra da dengue e da zika). Dois segmentos no coletor:

| Segmento | Arquivos | Filtro | Resultado |
|---|---|---|---|
| 1 | `chikbr14..15` | nenhum (não há classificação; nenhum caso foi descartado) | 2015 = 51 |
| 2 | `chikbr16..26` | `SClassificação` = 1 e 3 (tudo menos Descartado) | 1.663 |

**Total: 1.714 casos prováveis** (2015–2026). Epidemias em 2017 (841) e 2022–2023 (186 e 381).

Depois da sincronização, o banco tem exatamente esses valores por ano, e cada visão (sexo, faixa etária, raça/cor) soma o total anual.

## Evidências salvas

- `formulario_tabnet_chikungunya_2026-10-02.html`: formulário com as opções de classificação.
