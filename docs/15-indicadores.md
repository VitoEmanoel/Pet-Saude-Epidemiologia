# 15. Indicadores de saúde das arboviroses

Indicadores pedidos pelo **GT1 - Vigilância Epidemiológica** ([documento original](INDICADORES%20DE%20SA%C3%9ADE%20DAS%20ARBOVIROSES.md)), calculados automaticamente pelo sistema (itens A5 e A6 do [plano](12-plano-de-acao.md)).

## 15.1 De onde vêm os números

| Dado | Origem | Atualização |
|---|---|---|
| Casos prováveis por ano | TABNET (SINAN), município de residência = Parnaíba | Automática (agendador ou "Sincronizar" no admin) |
| Casos por classificação final (sinais de alarme, grave, confirmados) | TABNET, mesma consulta com a coluna "Classificação" | Automática, junto com os casos |
| Casos de 60 anos ou mais | TABNET, faixas 60-64, 65-69, 70-79 e 80+ | Automática |
| População residente (total e 60+) | **Planilha enviada pelo admin** (tela População) | Manual, uma vez por ano ([09 §9.1b](09-guia-de-manutencao.md#91b-atualizar-a-população-todo-ano)) |

**Casos prováveis** = todas as notificações **exceto as descartadas** (regra do Ministério da Saúde para arboviroses). Para a dengue o TABNET já entrega essa contagem; para zika e chikungunya o sistema aplica o filtro "Classificação ≠ Descartado".

## 15.2 Indicadores por doença

| Indicador | Doenças | Cálculo | Unidade |
|---|---|---|---|
| Casos prováveis | dengue, zika, chikungunya | total do ano | casos |
| Coeficiente de incidência | dengue, zika, chikungunya | casos prováveis ÷ população × 100.000 | por 100 mil hab. |
| % com sinais de alarme | dengue | casos "Dengue com sinais de alarme" ÷ casos prováveis × 100 | % |
| % de dengue grave | dengue | casos "Dengue grave" ÷ casos prováveis × 100 | % |
| Incidência em idosos (60+) | chikungunya | casos prováveis de 60+ ÷ população de 60+ × 100.000 | por 100 mil idosos |
| Casos confirmados | zika, chikungunya | casos com classificação final confirmada | casos |

Todos os valores vêm por **ano**, com o numerador e o denominador usados, para conferência.

## 15.3 Regras (o sistema nunca estima)

| Situação | O que aparece |
|---|---|
| Ano sem população cadastrada | **"sem população"** (o valor fica vazio) |
| % de alarme/grave **antes de 2014** | **"não se aplica"**: até 2013 a dengue era classificada de outro jeito (clássico, com complicações, febre hemorrágica, síndrome do choque) |
| Incidência em idosos sem `populacao_60_mais` na planilha | "sem população" |
| **Ano corrente** | Marcado como **provisório**: ainda há casos em investigação (ex.: em 2026, 151 casos de dengue sem classificação final) e o DATASUS revisa os dados |
| Chikungunya 2015 (sem classificação no TABNET) | Entra nos casos e na incidência; "casos confirmados" fica sem dado |

Validação de 02/10/2026 (consulta manual ao TABNET): dengue 2024 = 510 casos, 42 com sinais de alarme (8,24%) e 1 grave; zika = 19 confirmados de 33 prováveis; chikungunya = 1.661 confirmados (2016–2025) de 1.714 prováveis.

## 15.4 O que não dá para calcular com o TABNET

| Pedido do GT1 | Por quê | Caminho possível |
|---|---|---|
| Qualquer indicador **por bairro** | O TABNET só chega ao nível de município | Dados do SINAN local da Secretaria Municipal de Saúde, com outra importação |
| **Zika em gestantes** | O formulário de zika não tem o campo gestante; o número de gestantes residentes também não vem do TABNET | Idem |
| Incidência **por sexo, faixa etária ou raça/cor** | A população cadastrada é só o total (e 60+) | Planilha de população com essas divisões (não previsto) |

## 15.5 Onde fica no sistema

- **Na tela:** painel **Indicadores** nas páginas de dengue, zika e chikungunya (seletor de indicador, valor do ano, cálculo e série) e no dashboard do admin, com **Baixar indicadores** (CSV).
- **API pública:** `GET /api/indicators?source=<slug>` ([06](06-api.md)); CSV só no admin: `GET /api/admin/indicators/export.csv?source=<slug>`.
- **Cálculo:** [`indicators.service.ts`](../backend/src/modules/public/indicators.service.ts) (`SOURCE_INDICATORS` diz quais indicadores cada doença tem).
- **Classificação:** tabela `classification_counts` ([04](04-banco-de-dados.md)), preenchida pelo coletor ([05](05-coleta-de-dados.md)).
- **População:** tabela `population_estimates`, tela **População** do admin ([08](08-area-administrativa.md)).
