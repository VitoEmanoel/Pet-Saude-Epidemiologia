# Evidências de validação das fontes

Cada pasta guarda a prova de que uma fonte foi validada no DATASUS/TABNET: formulário salvo, consulta de teste e conclusões. Use como modelo ao validar uma fonte nova ([05 §5.5](../05-coleta-de-dados.md#55-como-descobrir-os-parâmetros-de-uma-fonte-nova-ou-que-mudou)).

## `tuberculose_sinan/` (fonte piloto, 13/06/2026)

| Arquivo | Conteúdo |
|---|---|
| [validacao.md](tuberculose_sinan/validacao.md) | Fase 2: URL, filtro municipal (opção `827`), períodos, dimensões disponíveis |
| [coleta_fase3.md](tuberculose_sinan/coleta_fase3.md) | Fase 3: primeira coleta real e teste de idempotência (500 registros) |
| [api_fase4.md](tuberculose_sinan/api_fase4.md) | Fase 4: endpoints com dados reais |
| [frontend_fase5.md](tuberculose_sinan/frontend_fase5.md) | Fase 5: telas implementadas |
| `formulario_tabnet_tuberculose_2026-06-13.html` | Formulário TABNET salvo (todas as opções de campos) |
| `consulta_parnaiba_residencia_2024_prn_2026-06-13.html` | Resposta real em formato `prn`; útil para testes do parser |
| `*_headers_*.txt` | Cabeçalhos HTTP das requisições |

Alguns detalhes desses registros mudaram depois (a exportação CSV foi para o admin, e o acesso por `Bearer` virou login com sessão). O comportamento atual está nos documentos numerados.

As demais fontes (hanseníase, sífilis congênita e gestacional, dengue, zika) foram validadas, mas ainda não têm pasta de evidências. Ao revalidá-las, crie `evidencias/<slug>/`.
