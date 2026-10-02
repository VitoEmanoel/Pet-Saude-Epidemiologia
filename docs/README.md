# Documentação: Painel Epidemiológico de Parnaíba (PET-Saúde)

Manual de manutenção do sistema. Foi escrito para alguém com conhecimento básico de terminal e programação conseguir instalar, operar e corrigir o sistema.

## Por onde começar

| Quero... | Leia |
|---|---|
| Entender o que o sistema faz | [01. Visão geral](01-visao-geral.md) |
| Instalar e rodar pela primeira vez | [02. Instalação e execução](02-instalacao-e-execucao.md) |
| Resolver um erro agora | [10. Solução de problemas](10-solucao-de-problemas.md) |
| Fazer uma tarefa de manutenção (ano novo, fonte nova, senha, backup...) | [09. Guia de manutenção](09-guia-de-manutencao.md) |
| Mexer no código | [03. Arquitetura](03-arquitetura.md), depois o documento da parte específica |

## Índice

| # | Documento | Conteúdo |
|---|---|---|
| 00 | [Especificação original](00-especificacao-original.md) | Requisitos definidos no início do projeto (registro; o escopo atual é menor) |
| 01 | [Visão geral](01-visao-geral.md) | Objetivo, regras fixas, doenças cobertas, tecnologias, glossário |
| 02 | [Instalação e execução](02-instalacao-e-execucao.md) | Pré-requisitos, primeira execução, comandos, modo dev, variáveis `.env`, servidor |
| 03 | [Arquitetura](03-arquitetura.md) | Componentes, pastas, fluxo de sincronização e de consulta, agendador |
| 04 | [Banco de dados](04-banco-de-dados.md) | Tabelas, modelo de agregações, SQL úteis, migrations, backup |
| 05 | [Coleta de dados (TABNET)](05-coleta-de-dados.md) | Como o TABNET funciona, parâmetros, configuração por fonte, normalização |
| 06 | [API](06-api.md) | Todas as rotas públicas e administrativas, erros, testes |
| 07 | [Frontend](07-frontend.md) | Páginas, componentes, tema |
| 08 | [Área administrativa](08-area-administrativa.md) | Funções, segurança, tarefas comuns |
| 09 | [Guia de manutenção](09-guia-de-manutencao.md) | Receitas passo a passo |
| 10 | [Solução de problemas](10-solucao-de-problemas.md) | Sintoma → causa → solução |
| 11 | [Problemas conhecidos](11-limitacoes-conhecidas.md) | Os 33 problemas encontrados (D, O, S, U, Q), com causa, evidência e correção |
| 12 | [Plano de ação](12-plano-de-acao.md) | Checklist do que fazer, do mais urgente ao menos urgente |

## Outras pastas

| Pasta | Conteúdo |
|---|---|
| [diagramas/](diagramas/) | Diagramas editáveis (`.drawio`, abrir em https://app.diagrams.net) do banco e do fluxo de sincronização |
| [evidencias/](evidencias/) | Registros da validação técnica das fontes (consultas reais ao TABNET) |

## Como manter esta documentação

- Mudou comportamento, comando, variável ou rota? Atualize o documento correspondente **no mesmo commit**.
- Fonte nova ou ano novo: atualize as tabelas de [01](01-visao-geral.md) e [05](05-coleta-de-dados.md).
- Corrigiu um item de [11](11-limitacoes-conhecidas.md)? Remova-o de lá e marque-o em [12](12-plano-de-acao.md).
- Os nomes `NN-assunto.md` mantêm a ordem de leitura; documentos novos entram no índice acima.
