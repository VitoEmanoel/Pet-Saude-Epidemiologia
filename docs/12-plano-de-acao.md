# 12. Plano de ação

Lista de tudo que precisa ser feito, **do mais urgente para o menos urgente**. Os códigos (D1, S2, ...) remetem à descrição detalhada de cada problema em [11-limitacoes-conhecidas.md](11-limitacoes-conhecidas.md).

## Como usar

1. Trabalhe **na ordem da tabela "Ordem de prioridade"** abaixo (os números das fases são só identificadores; a 2C vem antes da 3). Dentro de uma fase, a ordem dos itens também é a recomendada.
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

## Ordem de prioridade (combinada em 02/10/2026)

| Ordem | Fase | Prioridade | Por quê |
|---|---|---|---|
| ✅ | 0, 1, 2, 2B | Concluídas | Terreno, dados corretos e segurança para publicar |
| **1º** | **2C** Arboviroses e indicadores | **Alta (próxima)** | Corrige números que o público vê (zika com descartados), inclui chikungunya e entrega os indicadores do GT1 |
| 2º | **4** Ajustes visuais e acessibilidade | Média-alta | Deixa o site público no nível do admin (textos, contraste, celular) |
| 3º | **4B** Telas novas | Média | Contas individuais no admin, ativar/desativar fontes, transparência |
| 4º | **3** Operação confiável | Média | Volume dos arquivos brutos, coleta em transação, testes do núcleo |
| 5º | **6** Implantação em produção | Quando houver servidor | Depende da decisão de servidor/domínio |
| 6º | **5** Qualidade de código | Baixa | Lint, CI, limpeza |
| 7º | **7** Evolução do produto | Baixa | Teste com usuários e fontes novas |

## Painel de progresso

| Fase | Objetivo | Itens | Concluídos |
|---|---|---|---|
| 0 | Preparar o terreno | 4 | 4 |
| 1 | Dados corretos | 4 | 4 |
| 2 | Segurança mínima para publicar | 7 | 7 |
| 2B | Achados dos testes de segurança | 8 | 8 |
| 2C | Arboviroses e indicadores de saúde | 10 | 4 |
| 3 | Operação confiável | 4 | 0 |
| 4 | Ajustes visuais e acessibilidade | 9 | 1 |
| 4B | Telas novas | 3 | 0 |
| 5 | Qualidade de código | 5 | 0 |
| 6 | Implantação em produção | 8 | 0 |
| 7 | Evolução do produto | 2 | 0 |
| | **Total** | **64** | **28** |

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
- [x] **S2** Cabeçalhos de segurança (02/10/2026, branch `fix/s2-cabecalhos`)
  - [x] Next.js: CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options`, `Referrer-Policy`, HSTS e `Permissions-Policy` (via `headers()` em `next.config.ts`; ver [07 §7.5](07-frontend.md#75-cabeçalhos-de-segurança))
  - [x] Express: `helmet` na API (CSP `default-src 'none'`, `X-Frame-Options: DENY`, HSTS sem `includeSubDomains`)
  - [x] Conferir que mapa (tiles OpenStreetMap) e gráficos continuam funcionando com a CSP: Chromium, Firefox e WebKit, e também em `npm run dev`
  - [x] Teste de segurança dos cabeçalhos passando (+3 testes novos: diretivas da CSP, cabeçalhos da API, CORS); o teste de interface agora falha se a CSP bloquear qualquer recurso
- [x] **S3** Containers sem root (02/10/2026, branch `fix/s3-containers-sem-root`)
  - [x] `USER node` nos estágios finais do `Dockerfile`; `backend/storage` e `frontend/.next/cache` com dono `node`
  - [x] `docker compose exec backend id` ≠ `uid=0`: backend e frontend com `uid=1000(node)`; teste automático no `test:e2e`
  - [x] Conferido sem root: migrations, seed, sincronização (`npm run sync:data` e serviço `sync-data`) gravando os arquivos brutos
- [x] **S4 + S5** Proxy, IP real e bloqueio de login (02/10/2026, branch `fix/s4-s5-proxy-e-bloqueio`)
  - [x] `app.set("trust proxy", ...)` configurável por `TRUST_PROXY` (vazio, número de proxies ou lista de IPs/redes; `true` é recusado)
  - [x] Auditoria usa só `request.ip`
  - [x] Bloqueio de login por IP real: tentativas de terceiros não trancam o administrador em outro endereço. **Atraso progressivo não foi feito**: a senha é um segredo forte e o limite de 5 por IP já barra força bruta; segurar respostas abertas facilitaria derrubar o servidor com conexões presas
  - [x] Mapa de tentativas não cresce sem limite (entradas vencidas são descartadas)
  - [x] Testes: `X-Forwarded-For` falso não é gravado (e2e) nem escapa do bloqueio (backend); senha correta funciona após tentativas de terceiros, atrás de proxy confiável (backend)
- [x] **S6** Handler de erro do Express com 4 parâmetros, antes do 404 (02/10/2026, branch `fix/s6-handler-de-erro`)
  - [x] Teste: JSON inválido → resposta JSON 400 (`invalid_body`); corpo acima de 100 KB → 413 (`payload_too_large`)
- [x] **S8** Remover `X-Powered-By` (Express e Next.js) (02/10/2026, feito junto com o S2: `helmet` e `poweredByHeader: false`)
- [x] **S9** Documentar e validar `ADMIN_COOKIE_SECURE=true` no checklist de publicação (Fase 6) (02/10/2026, branch `fix/s9-cookie-secure`)
  - [x] Checklist de publicação em [02 §2.8](02-instalacao-e-execucao.md#28-checklist-de-publicação)
  - [x] `npm run start` recusa `FRONTEND_URL` em HTTPS sem `ADMIN_COOKIE_SECURE=true` (e avisa no caso inverso); o backend escreve `AVISO DE SEGURANCA` no log quando `CORS_ORIGIN` é HTTPS e o cookie não é `Secure` (cobre a VPS, que não usa o `start`)
  - [x] Teste: com `true` o cookie sai com `Secure`, `HttpOnly` e `SameSite=Strict`; sem, sai sem `Secure`

---

## Fase 2B: Achados dos testes de segurança (alta, antes de publicar)

Resultado da campanha de 02/10/2026 ([14](14-testes-de-seguranca.md)). Cada item tem um teste `todo` em `tests/security/owasp.test.mjs`; ao corrigir, remova o `todo`.

- [x] **S13** Migrar as imagens para Node.js LTS suportado (02/10/2026, branch `fix/s13-node-lts`)
  - [x] `node:24-alpine` (Node 24.21, suporte até abril de 2028) + `apk upgrade` nas imagens finais
  - [x] **Sem npm/yarn/corepack nas imagens finais** (backend e frontend): mesmo o npm 12 mais novo traz dependências com falhas. Migrations, seed e sincronização passam a ser chamados com `node` direto (`start.sh`, `sync-data.sh`, serviço `sync-data`)
  - [x] Trivy: backend e frontend **sem nenhuma falha média, alta ou crítica** (antes: 1 crítica + 25 altas)
  - [x] `postgres:16-alpine` (imagem oficial, já a mais recente): 1 crítica + 21 altas no `gosu`, binário que só troca de usuário ao iniciar, sem rede. **Risco aceito**; reavaliar a cada atualização da imagem
- [x] **S11** Logout invalida a sessão no servidor (02/10/2026, branch `fix/s11-logout-revoga-sessao`): tabela `admin_sessions` (migration `20261002170000_add_admin_sessions`); o cookie assinado leva o id da sessão; o logout preenche `revoked_at`. Cookies antigos (sem id) deixam de valer: é preciso entrar de novo uma vez
- [x] **S17** Limite de requisições por IP na API pública (02/10/2026, branch `fix/s17-limite-de-requisicoes`): `express-rate-limit`, `RATE_LIMIT_PER_MINUTE` (padrão 600/min por IP; 0 desliga), 429 em JSON com cabeçalho `RateLimit`; IPs privados isentos (uso local, testes e proxy sem `TRUST_PROXY`, que de outra forma bloquearia todos os visitantes juntos). Defesa contra ataque distribuído fica para o proxy/provedor (Fase 6)
- [x] **S15** `start.sh` recusa `POSTGRES_PASSWORD` padrão no perfil `servidor` (02/10/2026, branch `fix/s15-senha-banco`): recusa também `ADMIN_PASSWORD` < 12 e `ADMIN_SESSION_SECRET` < 32 caracteres; o backend avisa no log (`getWeakConfigWarnings`) quando a origem não é localhost; docs/02 §2.8 explica como trocar a senha do banco existente
- [x] **S12** `/api/records` aceita só fontes públicas (02/10/2026, branch `fix/s12-fonte-interna`): validação com `getPublicSourceBySlug`; achado extra durante a correção: **sem `source`, a listagem também trazia a zika** (90 registros na 1ª página); agora restrita às primárias públicas
- [x] **S14** Filtros inválidos devolvem 400 (02/10/2026, branch `fix/s14-validacao-filtros`): `year` com 4 dígitos, `month` 1–12, `page`/`pageSize` inteiros ≥ 1, sem parâmetro repetido ou objeto; vazio = sem filtro; `pageSize` > 500 continua reduzido a 500. Vale para registros, gráficos e exportações do admin
- [x] **S16** Comparação de credenciais e token sem vazar tamanho (02/10/2026, branch `fix/s16-comparacao-constante`): `safeEqual` compara SHA-256 dos dois lados; token Bearer passou a usar `safeEqual`
- [x] **S18** COOP/CORP no site; `HEALTHCHECK` nas imagens (02/10/2026, branch `fix/s18-endurecimentos`): `Cross-Origin-Opener-Policy` e `Cross-Origin-Resource-Policy` `same-origin` no `next.config.ts`; `HEALTHCHECK` no backend (`/health`) e no frontend (página inicial); desligado no serviço `sync-data`

---

## Fase 2C: Arboviroses e indicadores de saúde (alta, próxima)

Pedido do GT1 - Vigilância Epidemiológica, a partir de [INDICADORES DE SAÚDE DAS ARBOVIROSES](INDICADORES%20DE%20SA%C3%9ADE%20DAS%20ARBOVIROSES.md). Análise do TABNET feita em 02/10/2026 (formulários `denguebr`, `denguebbr`, `zikabr`, `chikunbr`). Executar na ordem: os indicadores dependem dos números corrigidos e da população.

**Bloco 1: números corretos e chikungunya**

- [x] **D7** Zika e chikungunya contadas como **casos prováveis** (iguais à dengue) (02/10/2026, branch `fix/d7-casos-provaveis`)
  - [x] Filtro "Classificação ≠ Descartado" no próprio TABNET (`extraParams` do segmento); a chikungunya nasce com a mesma regra no A2
  - [x] Zika: 187 → **33** prováveis; arboviroses 7.899 → 7.745. Evidências em `docs/evidencias/zika_sinan/`
  - [x] Teste: valores por ano idênticos à consulta manual ao TABNET; e2e de referência (arboviroses − dengue = 33)
  - [x] Achado durante a correção: registros que somem da resposta do TABNET ficavam com o valor antigo (ex.: zika 2025). Agora a coleta completa apaga o que não renovou; coleta com falha não apaga nada (resiliência 6/6)
  - [ ] Guardar também os **confirmados**: fica para o A5, que já precisa consultar a classificação (dengue com sinais de alarme e grave)
- [x] **A1** Zika com **página própria** no site (02/10/2026, branch `feat/a1-pagina-zika`): fonte primária, página `/zika`, item no menu depois de Dengue, entra na visão geral (total 11.650); testes de S12 passaram a verificar a regra (nenhuma fonte interna exposta) em vez da zika
- [x] **A2** Incluir a **chikungunya** (02/10/2026, branch `feat/a2-chikungunya`): `chikunbr.def`, Parnaíba = 827, página `/chikungunya` e item no menu
  - [x] Evidências em `docs/evidencias/chikungunya_sinan/` (2.306 notificações, 592 descartadas; **1.714 casos prováveis**; epidemias em 2017 e 2022–2023)
  - [x] 2015 (51 casos) sem classificação: entra inteiro como provável (nenhum caso descartado), em um segmento sem filtro
- [x] **A3** **Arboviroses** = dengue + zika + chikungunya, todas por casos prováveis (02/10/2026, branch `feat/a3-arboviroses-completa`): **9.459** casos (7.712 + 33 + 1.714); teste confere a soma ano a ano
- [ ] **D5** Anos novos automáticos (subiu da Fase 3: sem ele, 2027 não entra sozinho em nenhuma doença)
  - [ ] Ler os arquivos de período disponíveis no formulário TABNET
  - [ ] Ou, no mínimo, alerta quando houver arquivo de ano novo não configurado
- [ ] **O5** Falhas de coleta visíveis (subiu da Fase 3)
  - [ ] Retry com espera para falhas temporárias do TABNET
  - [ ] Aviso no admin (e/ou e-mail) quando uma fonte falhar N vezes seguidas

**Bloco 2: população**

- [ ] **A4** **População por ano** a partir de planilha CSV
  - [ ] Colunas: `ano`, `populacao` (obrigatórias) e `populacao_60_mais` (opcional, para o indicador de idosos); fonte declarada (ex.: estimativa IBGE)
  - [ ] Tela no admin para enviar a planilha: valida (anos repetidos, números inválidos), mostra o que mudou e grava; auditoria registra quem enviou
  - [ ] Modelo de planilha para baixar e instruções em `docs/`

**Bloco 3: indicadores e filtro**

- [ ] **A5** Indicadores calculados automaticamente (a cada sincronização e a cada envio de população)

  | Indicador | Cálculo | Disponível |
  |---|---|---|
  | Incidência de dengue | casos prováveis ÷ população × 100.000 | Todos os anos com população |
  | % dengue com sinais de alarme | casos "com sinais de alarme" ÷ casos prováveis × 100 | **2014+** (classificação nova) |
  | % dengue grave | casos "grave" ÷ casos prováveis × 100 | **2014+** |
  | Incidência de chikungunya | prováveis ÷ população × 100.000 | Com A2 |
  | Incidência de chikungunya em idosos | prováveis 60+ (faixas 60-64, 65-69, 70-79, 80+) ÷ população 60+ × 100.000 | Se o CSV tiver `populacao_60_mais` |
  | Incidência de zika | prováveis ÷ população × 100.000 | Com D7 |

  - [ ] Decisão do GT1 para **antes de 2014** (classificação antiga: clássico, com complicações, febre hemorrágica, síndrome do choque): mostrar "não se aplica" ou definir equivalência
  - [ ] Ano sem população cadastrada: indicador aparece como "sem população" (nunca estimar)
- [ ] **A6** **Filtro por indicador** no painel público e no admin: casos, incidência por 100 mil, % sinais de alarme, % grave, incidência em idosos; gráficos e exportações (CSV/HTML) seguem o indicador escolhido
  - [ ] Incidência só no total do município (a população não vem por sexo/idade/raça); com filtro demográfico, avisar
  - [ ] Texto explicativo de cada indicador (descrição e cálculo do documento do GT1)
- [ ] **A7** (opcional, baixa) Série **mensal** (o TABNET tem "Mês 1º Sintoma(s)")

**Fora do alcance do TABNET** (registrado em [11](11-limitacoes-conhecidas.md)): indicadores **por bairro** e **zika em gestantes**. Caminho, se o GT1 quiser: dados do SINAN local da Secretaria Municipal de Saúde, com outra forma de importação.

---

## Fase 3: Operação confiável (média)

- [ ] **O2** Volume Docker para `backend/storage`
  - [ ] Teste: recriar o container mantém os HTMLs brutos
  - [ ] Usar volume nomeado (herda o dono `node` da imagem); se for pasta do servidor, `chown 1000:1000` (ver S3)
- [ ] **O3 + O4** Coleta segura
  - [ ] Trava de sincronização no banco (`pg_advisory_lock`)
  - [ ] Gravação dos registros em lote dentro de transação
  - [ ] Teste de injeção de falhas: falha no meio não altera registros nem histórico
- O5 e D5 subiram para a Fase 2C.
- [ ] **Q1** Testes do núcleo do sistema
  - [ ] Testes do parser PRN com os HTMLs de `docs/evidencias/`
  - [ ] Testes de normalização (sexo, faixa etária, raça/cor, números)
  - [ ] Testes das agregações (`public-data.service.ts`)
- [ ] **S10** Testes isolados do banco real (banco de teste ou auditoria desligada em teste)

---

## Fase 4: Ajustes visuais e acessibilidade (média-alta, depois da 2C)

Ordem sugerida: U8, U3, U2, U4, U5, D6 (rápidos, deixam o site público no nível do admin); depois U7 e U6.

- [ ] **U8** Indicadores em 2 colunas no celular também no site público (no admin já está)
- [ ] **U3** Linguagem para o público
  - [x] Esconder `source_table` técnico (mostrar "Total do ano", "Por sexo"...) (feito junto com o D3)
  - [ ] Traduzir status ("SUCCESS" → "Atualizado")
  - [ ] Revisar acentuação de todos os textos da interface (menu do site e telas do admin já revisados)
- [x] **U1** Login do admin dentro de `<form>` (Enter envia; gerenciador de senhas funciona) (02/10/2026, junto com a reorganização do admin)
- [ ] **U2** Corrigir contraste dos 2 elementos (≥ 4,5:1); teste axe sem violações
- [ ] **D6** Cartão "Registros" reflete os filtros (ou troca o rótulo para "Registros totais")
- [ ] **U4** Título e `<h1>` próprios por página (admin já feito: cada tela tem título na aba e no cabeçalho; falta o site público)
- [ ] **U5** Favicon
- [ ] **U6** Alvos de toque ≥ 24 px no celular
- [ ] **U7** Lista de registros mais compacta no celular (ou paginação menor / recolhível)

---

## Fase 4B: Telas novas (média)

- [ ] **7.4** Mais de um administrador: contas individuais, tela de usuários no admin e **auditoria por pessoa** (completa o pedido de "saber quem fez o quê")
- [ ] **7.5** Ativar/desativar fontes pela área administrativa
- [ ] **7.3** Transparência no site: última atualização em destaque, período disponível, link da fonte oficial, aviso de dados desatualizados

---

### Pedidos de interface (02/10/2026)

- [x] Admin em telas separadas: Painel (com download ao lado dos filtros), Fontes, Sincronizações e Auditoria; seção "Exportação" removida
- [x] Auditoria com usuário, IP, detalhes em frase, navegador e filtros
- [x] Menu lateral em gaveta (☰) no site e no admin; **Sair** e tema claro/escuro no rodapé do menu; cabeçalho mais alto
- [x] Mapa não passa mais por cima do cabeçalho (`isolate`)

---

## Fase 5: Qualidade de código (baixa)

- [ ] **Q2** ESLint + Prettier configurados e CI (GitHub Actions) rodando typecheck, lint e testes
- [ ] **Q3** Refatorações
  - [x] Dividir `AdminDashboard.tsx` em componentes (02/10/2026: telas em `components/admin/`)
  - [ ] Renomear `TuberculosisDashboard.tsx` → `DiseaseDashboard.tsx`
  - [x] Unificar os 4 handlers de `charts.ts` (feito junto com o D2)
- [ ] **O6** Remover o que não é usado
  - [x] Redis: removido do Compose, `.env.example` e scripts (02/10/2026, branch `fix/o6-remove-redis`)
  - [ ] Coletor antigo `tuberculosis-sinan.collector.ts`
  - [ ] `zod` (ou passar a usá-lo para validar entradas)
  - [ ] `VITE_API_URL`
- [ ] **Q4** Cache das respostas públicas (invalidado ao fim de cada sincronização)
- [ ] **S7** Exigir `Origin`/`Referer` em POST administrativos

---

## Fase 6: Implantação em produção

- [ ] **6.1** Definir servidor, domínio e responsável pela operação. Uma VPS de 1 CPU / 2 GB / 20 GB basta ([02 §2.7](02-instalacao-e-execucao.md#27-servidor-pequeno-vps-e-imagens-construídas-fora-dele)); criar 2 GB de swap
- [ ] **6.2** Seguir o [checklist de publicação](02-instalacao-e-execucao.md#28-checklist-de-publicação). HTTPS com proxy reverso (nginx/Caddy) + `TRUST_PROXY` conforme o proxy, conferindo o IP real na auditoria (S4) + `ADMIN_COOKIE_SECURE=true` (S9)
- [ ] **6.3** Expor só 80/443; backend e frontend atrás do proxy
- [ ] **6.4** Backup automático diário do banco + teste de restauração mensal ([04 §4.4](04-banco-de-dados.md#44-migrations-seed-e-backup))
- [ ] **6.5** Monitoramento: `/health`, espaço em disco, status das sincronizações
- [ ] **6.6** Alerta de falha de sincronização (depende do O5)
- [ ] **6.7** Documento de implantação em `docs/` (passo a passo do servidor)
- [ ] **6.8** Construir as imagens fora da VPS e só enviá-las ([02 §2.7](02-instalacao-e-execucao.md#27-servidor-pequeno-vps-e-imagens-construídas-fora-dele))
  - [ ] Script `npm run deploy:build` (build com `.env.producao` + `docker save`) e `scripts/deploy-vps.sh` (load + migrations + seed + up, sem build)
  - [ ] Ou: GitHub Actions publicando as imagens no GitHub Container Registry a cada push na `main`; na VPS, `docker compose pull`
  - [ ] Conferir a arquitetura da VPS (`uname -m`); se for ARM, instalar `buildx` + QEMU na máquina que constrói (o Docker do Victor está sem `buildx` em 02/10/2026)
  - [ ] Pastas do servidor montadas nos containers com dono `1000:1000` (containers rodam sem root desde o S3)

---

## Fase 7: Evolução do produto

- [ ] **7.1** Teste com usuários reais
  - [ ] Preparar roteiro (tarefas, observação, questionário SUS)
  - [ ] Aplicar com 5 participantes (agentes de saúde, gestores, estudantes PET)
  - [ ] Registrar resultados e transformar os problemas encontrados em itens deste plano
- 7.2 (chikungunya) virou o item A2 da Fase 2C; 7.3, 7.4 e 7.5 foram para a Fase 4B.
- [ ] **7.6** Avaliar novas fontes da especificação original ([00](00-especificacao-original.md)) e sífilis adquirida
