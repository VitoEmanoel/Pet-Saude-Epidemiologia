# 12. Plano de ação

Lista de tudo que precisa ser feito, **do mais urgente para o menos urgente**. Os códigos (D1, S2, ...) remetem à descrição detalhada de cada problema em [11-limitacoes-conhecidas.md](11-limitacoes-conhecidas.md).

## Como usar

1. Trabalhe **na ordem das fases**. Dentro de uma fase, a ordem dos itens também é a recomendada.
2. Marque cada subtarefa trocando `[ ]` por `[x]` assim que concluída.
3. Um item só é marcado como concluído quando cumprir a **definição de pronto** abaixo.
4. Ao concluir um item, anote ao lado: data e hash do commit. Exemplo: `- [x] **O1** ... (02/10/2026, a1b2c3d)`.
5. Atualize o **painel de progresso** ao fim de cada sessão de trabalho.

### Definição de pronto (vale para todo item)

- [ ] Código implementado
- [ ] Testes automatizados passando: `npm run test:backend`, `npm run test:e2e` e `npm run test:ui` (ver [13-testes.md](13-testes.md)); remover o `todo` do teste do item corrigido
- [ ] Verificado com o sistema rodando (`npm run start`), não só no código
- [ ] Documentação atualizada (docs 01–10 afetados; remover o item de `11-limitacoes-conhecidas.md`)
- [ ] Commit feito com mensagem clara citando o código do item (ex.: `fix(sync): use compiled script in Docker (O1)`)

## Painel de progresso

| Fase | Objetivo | Itens | Concluídos |
|---|---|---|---|
| 0 | Preparar o terreno | 4 | 4 |
| 1 | Dados corretos | 4 | 4 |
| 2 | Segurança mínima para publicar | 7 | 1 |
| 3 | Operação confiável | 6 | 0 |
| 4 | Usabilidade e acessibilidade | 8 | 0 |
| 5 | Qualidade de código | 5 | 0 |
| 6 | Implantação em produção | 7 | 0 |
| 7 | Evolução do produto | 6 | 0 |
| | **Total** | **47** | **9** |

---

## Fase 0: Preparar o terreno (urgente, rápido)

Pré-requisitos para trabalhar com segurança nas fases seguintes.

- [x] **0.1** Commitar a reorganização da documentação (docs 00–12, `.claude/settings.json`) (01/10/2026, branch `docs/reorganiza-documentacao`)
- [x] **0.2** Criar branch de trabalho para as correções (ex.: `fix/fase-1-dados`) e não commitar direto na `main`
- [x] **O1** Corrigir `npm run sync:data` no Docker (01/10/2026, branch `fix/o1-sync-data`)
  - [x] Trocar `tsx src/scripts/sync-data.ts` por `node backend/dist/scripts/sync-data.js` em `scripts/sync-data.sh`, no `RUN_INITIAL_SYNC` de `scripts/start.sh` e no serviço `sync-data` do `docker-compose.yml`
  - [x] Testar `npm run sync:data` com o sistema no Docker (todas as fontes e uma fonte com `npm run sync:data -- <slug>`)
  - [x] Testar `RUN_INITIAL_SYNC=true` no `.env` + `npm run start`
  - [x] Testar o serviço `sync-data` do Compose (`--profile manual`)
  - [ ] **Pronto quando:** o comando do README sincroniza as 6 fontes sem erro
- [x] **0.3** Trazer a suíte de testes de QA para dentro do projeto (01/10/2026, branch `feat/0.3-suite-de-testes`)
  - [x] Criar `tests/e2e/` com os testes de API (funcional, integração, regressão, segurança)
  - [x] Criar `tests/ui/` com os testes de navegador (Playwright: Chromium, Firefox, WebKit)
  - [x] Criar `tests/load/` com os testes de carga (autocannon) e o teste longo
  - [x] Criar `tests/resilience/` com a injeção de falhas do TABNET
  - [x] Ler credenciais do `.env` sem copiá-lo; nenhum caminho absoluto
  - [x] Scripts no `package.json`: `test:setup`, `test:e2e`, `test:ui`, `test:ui:webkit`, `test:load`, `test:soak`, `test:resilience`
  - [x] Defeitos conhecidos marcados como `todo` com o código do item (D1–D4, D2 na UI, S2, S4, S6, S7, S8, U1, U2)
  - [x] Documentar em `docs/13-testes.md`
  - [x] **Resultado:** e2e 66 passam, 0 falham, 11 `todo`; UI 44/0/4 nos 3 navegadores; resiliência 6/6

---

## Fase 1: Dados corretos (urgente)

**Antes de mostrar o painel a qualquer pessoa.** Hoje ele pode levar a conclusões erradas.

- [x] **D3** Tabela e CSV contam cada caso 4 vezes (02/10/2026, branch `fix/d3-agregacao-registros`)
  - [x] Definir a solução: uma visão por vez; padrão = total do ano; com filtro demográfico, a visão da mesma dimensão
  - [x] Backend: parâmetro `aggregation` (`yearly`, `sex`, `age_group`, `race_color`, `all`) em `/api/records` e no CSV; 400 para visão inválida, incompatível ou dois filtros demográficos
  - [x] Frontend: seletor "Detalhar por" na tabela pública e "Visão" na exportação do admin
  - [x] Coluna "Visão" em português no lugar do nome técnico da tabela; coluna `aggregation` no CSV
  - [x] Teste: soma da tabela de tuberculose 2024 = 86 (e soma de cada visão = total)
  - [x] Atualizar docs 04, 06, 07 e 10

- [x] **D2** Filtros cruzados zeram gráficos (02/10/2026, branch `fix/d2-filtros-cruzados`)
  - [x] Decidir a abordagem: combinação de (a) e (b). Um filtro demográfico por vez, e cada gráfico de dimensão aplica só o próprio filtro, avisando o que não pôde aplicar
  - [x] Backend: `onlyOwnDimension` nos gráficos, `ignoredFilters` na resposta, 400 com dois filtros demográficos (gráficos e exportação HTML)
  - [x] Frontend: escolher um filtro demográfico limpa os outros (público, pré-visualização e exportação do admin); aviso nos gráficos (`lib/demographics.ts`)
  - [x] Teste: com `sex=Masculino`, os gráficos de faixa etária e raça/cor não ficam vazios e trazem `ignoredFilters`
  - [x] Atualizar docs 06, 07 e 10

- [x] **D4** "Total de casos" da página inicial (02/10/2026, branch `fix/d4-total-geral`)
  - [x] Excluir fontes `internal` (zika) da visão geral (sem mexer em `baseSourceSlugs`, que a composição de arboviroses usa)
  - [x] Casos e período por doença na tabela de fontes da página inicial (`casesBySource`); cartão e gráfico dizem que são a soma das doenças
  - [x] Teste: total geral = soma das fontes públicas; casos por doença = resumo de cada página; gráfico soma o total
  - [x] Bônus: visão geral ~60% mais rápida (225 → ~355 req/s) ao trocar ~12 consultas por uma agrupada

- [x] **D1** Dengue a partir de 2014 (02/10/2026, branch `fix/d1-dengue-2014`)
  - [x] Encontrar no TABNET a tabela de dengue 2014+: `denguebbr.def`, arquivos `dengbr14..26`
  - [x] Validar parâmetros e o valor da opção de Parnaíba (`827`); evidências em `docs/evidencias/dengue_sinan/`
  - [x] Configurar a coleta: o coletor passou a aceitar vários segmentos (formulário + anos) por fonte; a dengue tem 2
  - [x] Sincronizar e conferir a série completa (2007–2026) contra o TABNET: os 13 anos novos idênticos à consulta manual (5.328 casos)
  - [x] Teste: `lastAvailableYear` de dengue > 2013, série sem buraco, dengue 2022 = 2.075
  - [x] Atualizar docs 01, 04, 05, 09 e evidências

---

## Fase 2: Segurança mínima para publicar (alta)

**Antes de colocar o sistema na internet.**

- [x] **S1** Atualizar dependências vulneráveis (02/10/2026, branch `fix/s1-dependencias`)
  - [x] Atualizar `next` (crítica) e rodar o build e os testes de UI: `15.5.19` → `15.5.27` (correção retroportada, sem migrar para o Next 16)
  - [x] Atualizar `sharp` (0.35.5), `postcss` (8.5.28, inclusive a cópia interna do `next` via `overrides`), `nanoid` (3.3.19), `express` (4.22.3), `body-parser` (1.20.8), `qs` (6.16.0)
  - [x] `npm audit --omit=dev` e `npm audit` (com dependências de desenvolvimento): **0 vulnerabilidades** (era 7: 1 crítica, 3 altas, 3 moderadas)
  - [x] Pacote `tests/`: 3 moderadas no `autocannon` aceitas (só testes; ver [09 §9.6](09-guia-de-manutencao.md#96-atualizar-dependências))
- [ ] **S2** Cabeçalhos de segurança
  - [ ] Next.js: CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options`, `Referrer-Policy`, HSTS (via `headers()` em `next.config.ts`)
  - [ ] Express: `helmet` (ou equivalente) na API pública
  - [ ] Conferir que mapa (tiles OpenStreetMap) e gráficos continuam funcionando com a CSP
  - [ ] Teste de segurança dos cabeçalhos passando
- [ ] **S3** Containers sem root
  - [ ] `USER node` nos estágios finais do `Dockerfile`; ajustar permissões de `backend/storage`
  - [ ] `docker compose exec backend id` ≠ `uid=0`
- [ ] **S4 + S5** Proxy, IP real e bloqueio de login
  - [ ] `app.set("trust proxy", ...)` configurável por variável de ambiente
  - [ ] Auditoria usa só `request.ip`
  - [ ] Bloqueio de login não tranca o administrador legítimo (ex.: por IP real + atraso progressivo)
  - [ ] Testes: `X-Forwarded-For` falso não é gravado; senha correta funciona após tentativas de terceiros
- [ ] **S6** Handler de erro do Express com 4 parâmetros, antes do 404
  - [ ] Teste: JSON inválido → resposta JSON 400
- [ ] **S8** Remover `X-Powered-By` (Express e Next.js)
- [ ] **S9** Documentar e validar `ADMIN_COOKIE_SECURE=true` no checklist de publicação (Fase 6)

---

## Fase 3: Operação confiável (média)

- [ ] **O2** Volume Docker para `backend/storage`
  - [ ] Teste: recriar o container mantém os HTMLs brutos
- [ ] **O3 + O4** Coleta segura
  - [ ] Trava de sincronização no banco (`pg_advisory_lock`)
  - [ ] Gravação dos registros em lote dentro de transação
  - [ ] Teste de injeção de falhas: falha no meio não altera registros nem histórico
- [ ] **O5** Falhas visíveis
  - [ ] Retry com espera para falhas temporárias do TABNET
  - [ ] Aviso no admin (e/ou e-mail) quando uma fonte falhar N vezes seguidas
- [ ] **D5** Anos novos automáticos
  - [ ] Ler os arquivos de período disponíveis no formulário TABNET
  - [ ] Ou, no mínimo, alerta quando houver arquivo de ano novo não configurado
- [ ] **Q1** Testes do núcleo do sistema
  - [ ] Testes do parser PRN com os HTMLs de `docs/evidencias/`
  - [ ] Testes de normalização (sexo, faixa etária, raça/cor, números)
  - [ ] Testes das agregações (`public-data.service.ts`)
- [ ] **S10** Testes isolados do banco real (banco de teste ou auditoria desligada em teste)

---

## Fase 4: Usabilidade e acessibilidade (média)

- [ ] **U3** Linguagem para o público
  - [x] Esconder `source_table` técnico (mostrar "Total do ano", "Por sexo"...) (feito junto com o D3)
  - [ ] Traduzir status ("SUCCESS" → "Atualizado")
  - [ ] Revisar acentuação de todos os textos da interface
- [ ] **U1** Login do admin dentro de `<form>` (Enter envia; gerenciador de senhas funciona)
- [ ] **U2** Corrigir contraste dos 2 elementos (≥ 4,5:1); teste axe sem violações
- [ ] **D6** Cartão "Registros" reflete os filtros (ou troca o rótulo para "Registros totais")
- [ ] **U4** Título e `<h1>` próprios por página
- [ ] **U5** Favicon
- [ ] **U6** Alvos de toque ≥ 24 px no celular
- [ ] **U7** Lista de registros mais compacta no celular (ou paginação menor / recolhível)

---

## Fase 5: Qualidade de código (baixa)

- [ ] **Q2** ESLint + Prettier configurados e CI (GitHub Actions) rodando typecheck, lint e testes
- [ ] **Q3** Refatorações
  - [ ] Dividir `AdminDashboard.tsx` em componentes
  - [ ] Renomear `TuberculosisDashboard.tsx` → `DiseaseDashboard.tsx`
  - [x] Unificar os 4 handlers de `charts.ts` (feito junto com o D2)
- [ ] **O6** Remover o que não é usado: coletor antigo, `zod` (ou passar a usá-lo para validar entradas), `VITE_API_URL`, Redis (ou usá-lo no Q4)
- [ ] **Q4** Cache das respostas públicas (invalidado ao fim de cada sincronização)
- [ ] **S7** Exigir `Origin`/`Referer` em POST administrativos

---

## Fase 6: Implantação em produção

- [ ] **6.1** Definir servidor, domínio e responsável pela operação
- [ ] **6.2** HTTPS com proxy reverso (nginx/Caddy) + `trust proxy` (S4) + `ADMIN_COOKIE_SECURE=true` (S9)
- [ ] **6.3** Expor só 80/443; backend e frontend atrás do proxy
- [ ] **6.4** Backup automático diário do banco + teste de restauração mensal ([04 §4.4](04-banco-de-dados.md#44-migrations-seed-e-backup))
- [ ] **6.5** Monitoramento: `/health`, espaço em disco, status das sincronizações
- [ ] **6.6** Alerta de falha de sincronização (depende do O5)
- [ ] **6.7** Documento de implantação em `docs/` (passo a passo do servidor)

---

## Fase 7: Evolução do produto

- [ ] **7.1** Teste com usuários reais
  - [ ] Preparar roteiro (tarefas, observação, questionário SUS)
  - [ ] Aplicar com 5 participantes (agentes de saúde, gestores, estudantes PET)
  - [ ] Registrar resultados e transformar os problemas encontrados em itens deste plano
- [ ] **7.2** Chikungunya na visão de arboviroses ([09 §9.2](09-guia-de-manutencao.md#92-adicionar-uma-fonte-nova-ex-chikungunya))
- [ ] **7.3** Transparência: última atualização em destaque, período disponível, link da fonte oficial, aviso de dados desatualizados
- [ ] **7.4** Mais de um administrador (contas individuais e auditoria por pessoa)
- [ ] **7.5** Ativar/desativar fontes pela área administrativa
- [ ] **7.6** Avaliar novas fontes da especificação original ([00](00-especificacao-original.md)) e sífilis adquirida
