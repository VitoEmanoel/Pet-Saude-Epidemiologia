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
- [ ] Testes automatizados passando (`npm run test:backend` + suíte da Fase 0, quando existir)
- [ ] Verificado com o sistema rodando (`npm run start`), não só no código
- [ ] Documentação atualizada (docs 01–10 afetados; remover o item de `11-limitacoes-conhecidas.md`)
- [ ] Commit feito com mensagem clara citando o código do item (ex.: `fix(sync): use compiled script in Docker (O1)`)

## Painel de progresso

| Fase | Objetivo | Itens | Concluídos |
|---|---|---|---|
| 0 | Preparar o terreno | 4 | 3 |
| 1 | Dados corretos | 4 | 0 |
| 2 | Segurança mínima para publicar | 7 | 0 |
| 3 | Operação confiável | 6 | 0 |
| 4 | Usabilidade e acessibilidade | 8 | 0 |
| 5 | Qualidade de código | 5 | 0 |
| 6 | Implantação em produção | 7 | 0 |
| 7 | Evolução do produto | 6 | 0 |
| | **Total** | **47** | **3** |

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
- [ ] **0.3** Trazer a suíte de testes de QA para dentro do projeto (hoje está fora do repositório)
  - [ ] Criar `tests/e2e/` com os testes de API (funcional, integração, regressão, segurança)
  - [ ] Criar `tests/ui/` com os testes de navegador (Playwright: Chromium, Firefox, WebKit)
  - [ ] Criar `tests/load/` com os testes de carga (autocannon)
  - [ ] Ler credenciais do `.env` sem copiá-lo; nenhum caminho absoluto
  - [ ] Scripts no `package.json`: `test:e2e`, `test:ui`, `test:load`
  - [ ] Manter os testes dos defeitos conhecidos (D1–D4, S6) marcados como "esperado falhar" até serem corrigidos
  - [ ] **Pronto quando:** `npm run test:e2e` roda contra o sistema no ar e o resultado bate com o relatório de 01/10/2026 (42 passam, 5 falhas esperadas)

---

## Fase 1: Dados corretos (urgente)

**Antes de mostrar o painel a qualquer pessoa.** Hoje ele pode levar a conclusões erradas.

- [ ] **D3** Tabela e CSV contam cada caso 4 vezes
  - [ ] Definir a solução: filtro "tipo de agregação" na tabela, padrão = total anual
  - [ ] Backend: parâmetro de agregação em `/api/records` e no CSV
  - [ ] Frontend: seletor de agregação na tabela pública e no admin
  - [ ] Coluna/texto que explique o tipo de agregação em linguagem simples
  - [ ] Teste: soma da tabela de tuberculose 2024 = 86
  - [ ] Atualizar docs 04, 06 e 07
- [ ] **D2** Filtros cruzados zeram gráficos
  - [ ] Decidir a abordagem: (a) cada gráfico ignora filtros de outras dimensões, ou (b) só um filtro demográfico por vez
  - [ ] Implementar em `buildChartWhere` (`public-data.service.ts`) e/ou no `DiseaseDashboard`
  - [ ] Aviso na interface explicando que o DATASUS não fornece dados cruzados
  - [ ] Teste: com `sex=Masculino`, os gráficos de faixa etária e raça/cor não ficam vazios (ou o filtro fica desabilitado)
  - [ ] Atualizar docs 04, 06 e 07
- [ ] **D4** "Total de casos" da página inicial
  - [ ] Excluir fontes `internal` (zika) de `baseSourceSlugs`/visão geral
  - [ ] Substituir o número único por casos por doença (ou remover o indicador)
  - [ ] Teste: total geral = soma das fontes públicas
- [ ] **D1** Dengue a partir de 2014
  - [ ] Encontrar no TABNET a tabela de dengue 2014+ (seguir [05 §5.5](05-coleta-de-dados.md#55-como-descobrir-os-parâmetros-de-uma-fonte-nova-ou-que-mudou))
  - [ ] Validar parâmetros e o valor da opção de Parnaíba; salvar evidências em `docs/evidencias/dengue_sinan/`
  - [ ] Configurar a coleta (nova configuração/fonte) e incluí-la na composição de dengue e arboviroses
  - [ ] Sincronizar e conferir a série completa (2007–ano atual) contra o TABNET manualmente
  - [ ] Teste: `lastAvailableYear` de dengue > 2013
  - [ ] Atualizar docs 01 e 05

---

## Fase 2: Segurança mínima para publicar (alta)

**Antes de colocar o sistema na internet.**

- [ ] **S1** Atualizar dependências vulneráveis
  - [ ] Atualizar `next` (crítica) e rodar o build e os testes de UI
  - [ ] Atualizar `sharp`, `postcss`, `nanoid`, `express`, `body-parser`, `qs`
  - [ ] `npm audit --omit=dev` sem críticas nem altas
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
  - [ ] Esconder `source_table` técnico (mostrar "Total do ano", "Por sexo"...)
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
  - [ ] Unificar os 4 handlers de `charts.ts`
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
