# Validação técnica: Zika SINAN como casos prováveis (D7)

Data da validação: 02/10/2026 (item D7 do plano de ação)

## Problema

O formulário `zikabr.def` só oferece o incremento **"Todos os casos"**, que inclui as notificações **descartadas** (investigadas e que não eram zika). A dengue do painel usa **"Casos prováveis"** (todas as notificações exceto descartadas). Somar as duas em arboviroses misturava regras diferentes.

## Consulta por classificação (Parnaíba, município de residência = 827, 2015–2026)

```txt
"Ano 1º Sintoma(s)";"Ign/Branco";"Confirmado";"Descartado";"Inconclusivo";"Total"
"2016";-;-;36;3;39
"2017";-;2;57;4;63
"2018";-;1;8;-;9
"2019";-;1;12;1;14
"2020";1;5;5;-;11
"2021";-;6;6;4;16
"2022";1;1;12;-;14
"2023";-;1;15;-;16
"2024";-;2;1;-;3
"2025";-;-;2;-;2
"Total";2;19;154;12;187
```

**154 das 187 notificações (82%) foram descartadas.**

## Correção

Filtro do formulário `SClassificação` com as opções **1 (Ign/Branco), 2 (Confirmado) e 4 (Inconclusivo)**, ou seja, tudo menos **3 (Descartado)**. Enviado como `SClassifica%E7%E3o=1&SClassifica%E7%E3o=2&SClassifica%E7%E3o=4` (campo `extraParams` do segmento no coletor).

Consulta de controle com o filtro:

```txt
"Ano 1º Sintoma(s)";"Todos os casos"
"2016";3  "2017";6  "2018";1  "2019";2  "2020";6
"2021";10 "2022";2  "2023";1  "2024";2  "Total";33
```

Depois da sincronização, o banco tem exatamente esses valores ano a ano (total **33**), e cada visão (sexo, faixa etária, raça/cor) soma 33. Arboviroses passou de 7.899 para **7.745** (7.712 de dengue + 33 de zika).

## Efeito colateral corrigido junto

O registro de **2025** (2 notificações, ambas descartadas) não vem mais do TABNET. Antes, registros que sumiam da resposta ficavam no banco com o valor antigo. Agora, ao fim de uma coleta **completa**, o coletor apaga os registros da fonte que a coleta não renovou. Se a coleta falha no meio, nada é apagado (conferido no `npm run test:resilience`: 135/135 registros mantidos nos 4 cenários de falha).

## Evidências salvas

- `formulario_tabnet_zika_2026-10-02.html`: formulário com as opções de classificação.
