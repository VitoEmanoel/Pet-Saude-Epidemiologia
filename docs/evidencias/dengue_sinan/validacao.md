# Validação técnica: Dengue SINAN (2014 em diante)

Data da validação: 02/10/2026 (item D1 do plano de ação)

## Problema

A fonte `dengue_sinan` coletava só o formulário `denguebr.def`, cujos arquivos vão de 2007 a 2013. O painel não mostrava nenhum caso de dengue a partir de 2014.

## Fonte encontrada

- Título: DENGUE - Notificações registradas no Sistema de Informação de Agravos de Notificação - Brasil.
- Sistema: SINAN Net.
- Formulário: `http://tabnet.datasus.gov.br/cgi/deftohtm.exe?sinannet/cnv/denguebbr.def`
- Endpoint de consulta: `http://tabnet.datasus.gov.br/cgi/tabcgi.exe?sinannet/cnv/denguebbr.def`

## Parâmetros (iguais aos da tabela 2007–2013)

| Campo | Valor |
|---|---|
| Linha | `Ano_1º_Sintoma(s)` (enviado como `Ano_1%BA_Sintoma(s)`) |
| Incremento | `Casos_Prováveis` (`Casos_Prov%E1veis`) |
| Colunas usadas | `Sexo`, `Faixa_Etária`, `Raça` |
| Arquivos de período | `dengbr14.dbf` … `dengbr26.dbf` = 2014 a 2026 |
| Município de residência | `SMunicípio_de_residência` = `827` (`220770 PARNAIBA`) |

Os arquivos têm o mesmo prefixo (`dengbr`) da tabela antiga, mas pertencem a outro `.def`; a tabela antiga para em 2013 e esta começa em 2014, sem sobreposição.

## Consulta controlada

Todos os anos (2014–2026), sem coluna, município de residência = Parnaíba. Resposta salva em `consulta_parnaiba_residencia_2014-2026_prn_2026-10-02.html`:

```txt
Município de residência: 220770 PARNAIBA
"Ano 1º Sintoma(s)";"Casos Prováveis"
"2014";99
"2015";219
"2016";108
"2017";170
"2018";5
"2019";89
"2020";40
"2021";140
"2022";2075
"2023";752
"2024";510
"2025";152
"2026";969
"Total";5328
```

Conclusão: **5.328 casos prováveis** (incluindo a epidemia de 2022) estavam fora do painel.

## Notas da fonte

- "Para os casos prováveis foram incluídas todas notificações, exceto casos descartados."
- Para incidência, o DATASUS recomenda usar o local de residência (é o filtro usado).
- Dados de 2026 atualizados em 28/09/2026, **sujeitos a revisão**; anos recentes podem mudar a cada publicação.
- Dados disponibilizados no TABNET em setembro de 2026.

## Evidências salvas

- `consulta_parnaiba_residencia_2014-2026_prn_2026-10-02.html`
- `consulta_headers_2026-10-02.txt`
