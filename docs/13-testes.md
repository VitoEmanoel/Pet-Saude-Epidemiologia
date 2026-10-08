# 13. Testes

O projeto tem dois conjuntos de testes:

| Conjunto | Onde | Precisa do sistema no ar? | Para quê |
|---|---|---|---|
| Testes do backend | `backend/src/**/*.test.ts` | Não (sobe a API em memória; usa o **banco de teste** `pet_saude_test`, criado sozinho) | Rotas, validação, login, leitura do TABNET, normalização, somas do site, planilha de população, indicadores |
| Suíte de QA | `tests/` | **Sim** (`npm run start` + dados sincronizados) | Funcional, integração, regressão, segurança, interface, acessibilidade, carga, resiliência |

A suíte de QA fica **fora dos workspaces** do npm (tem o próprio `tests/package.json`) e fora das imagens Docker (`.dockerignore`), para não pesar no build.

## 13.1 Preparação (uma vez)

```bash
npm run test:setup     # instala Playwright, autocannon e axe-core em tests/ e baixa Chromium e Firefox
```

Credenciais e URLs são lidas do `.env` da raiz. Para apontar para outro ambiente: `QA_API_URL`, `QA_WEB_URL` e `ENV_FILE`.

## 13.2 Comandos

| Comando | O que testa | Duração |
|---|---|---|
| `npm run test:backend` | Testes do backend (58). Rodam no banco **`pet_saude_test`** (S10): o `backend/scripts/run-tests.mjs` cria/atualiza esse banco (migrations + fontes) e se recusa a rodar se ele não for local ou não terminar em `_test`. Incluem o núcleo (Q1): `tabnet-parsing` (respostas reais de `docs/evidencias/` e casos difíceis de rótulos e números) e `public-data` (somas do site com dados controlados) | ~15 s |
| `npm run test:e2e` | API: funcional, integração, regressão, validação, admin; segurança: sessão, login, CSRF/CORS, injeção, XSS, exposição, cabeçalhos | ~2 s |
| `npm run test:ui` | Interface no Chromium: 8 páginas × desktop/celular, gráficos, mapa, bloqueios da CSP, acessibilidade (axe), filtros, paginação, menu, tema, fluxo do admin, API fora do ar | ~1 min |
| `QA_BROWSER=firefox npm run test:ui` | O mesmo no Firefox | ~1 min |
| `npm run test:ui:webkit` | O mesmo no WebKit (motor do Safari), emulando iPhone 15. Roda na imagem Docker oficial do Playwright, porque o WebKit não roda direto no Arch Linux | ~2 min |
| `npm run test:security` | Segurança por categoria OWASP (injeção, controle de acesso, autenticação/sessão, configuração e lógica de negócio), em caixa preta, cinza e branca. Ver [14](14-testes-de-seguranca.md) | ~1 s |
| `npm run test:security:scan` | Ferramentas de mercado pelas imagens Docker oficiais: OWASP ZAP, sqlmap, Nuclei, Trivy, Semgrep, nmap. Relatórios em `tests/output/security/`. Uma só: `npm run test:security:scan -- trivy`. Reinicia o backend no fim | ~25 min |
| `npm run test:resilience` | Simula falhas do TABNET (rede, HTTP 503, layout alterado, falha no meio) e confere que os dados antigos ficam **intactos** (quantidade e conteúdo), que a coleta se recupera, que **duas sincronizações da mesma fonte em processos diferentes** não rodam juntas (O3) e que uma trava de processo morto vence. Usa o `backend/.env` e a internet; rode com `env -u DATABASE_URL` se o terminal tiver o `.env` da raiz carregado | ~1 min |
| `npm run test:load` | Carga: req/s e latência por rota; 10/100/300 visitas simultâneas. Imprime métricas (não reprova) | ~1,5 min |
| `npm run test:soak` | Teste longo: carga constante + memória/latência a cada 30 s em `tests/output/soak.csv` | 110 min (padrão) |

Variáveis opcionais:

| Variável | Efeito |
|---|---|
| `QA_TABNET=1` | Inclui no `test:e2e` os testes que sincronizam com o TABNET (precisa de internet) |
| `QA_LOCKOUT=1` | Inclui o teste de bloqueio de login. **Tranca o admin por 15 min** (para liberar: `docker compose --env-file .env restart backend`) |
| `QA_BROWSER` | `chromium` (padrão), `firefox` ou `webkit` |
| `QA_CONNS`, `QA_DURATION` | Conexões e segundos do `test:load` (padrão 50 e 10) |
| `QA_SOAK_MIN`, `QA_RATE` | Minutos e req/s do `test:soak` (padrão 110 e 40) |

Capturas de tela e resultados ficam em `tests/output/` (fora do git).

## 13.3 Defeitos conhecidos como testes `todo`

Cada problema de [11-limitacoes-conhecidas.md](11-limitacoes-conhecidas.md) que dá para verificar automaticamente tem um teste marcado como `todo`, com o código do item (ex.: `{ todo: "D2 — Fase 1" }`). Um teste `todo`:

- **roda** e mostra que o defeito continua lá;
- **não reprova** a suíte (o resultado aparece em `ℹ todo N`).

**Ao corrigir um item, remova o `todo` do teste correspondente.** A partir daí ele passa a ser obrigatório e protege contra a volta do defeito.

| Suíte | Testes `todo` hoje |
|---|---|
| `test:e2e` | S7 |
| `test:ui` | nenhum (U1 e U2 corrigidos) |
| `test:security` | nenhum (todos os achados S11–S18 corrigidos) |

Para ver os `todo` e se estão falhando:

```bash
cd tests && node --test --test-concurrency=1 --test-reporter=tap e2e/*.test.mjs | grep "# TODO"
```

## 13.4 Resultado de referência (02/10/2026, fim da Fase 2B)

| Suíte | Passam | Falham | Pulados | `todo` |
|---|---|---|---|---|
| `test:backend` | 69 | 0 | 0 | 0 |
| `test:e2e` | 102 | 0 | 3 (TABNET ×2, bloqueio) | 1 |
| `test:e2e` com `QA_TABNET=1` | +2 | 0 | | |
| `test:ui` (Chromium, Firefox, WebKit) | 79 | 0 | 0 | 0 |
| `test:security` | 48 | 0 | 1 (TABNET) | 0 |
| `test:resilience` | 9/9 | | | |

Carga (16 núcleos, fim da Fase 2B, Node 24): `/health` ~12.800 req/s; resumo de fonte ~470 req/s; visão geral ~365 req/s; página inicial ~2.400 req/s. O limite de requisições (S17) não age nesses testes porque eles saem de IP privado; resumo de fonte ~475 req/s; visão geral ~370 req/s (era ~225 antes do D4); página inicial ~2.500 req/s. Os cabeçalhos de segurança do S2 não têm custo mensurável (uma medição logo após o S2 deu `/health` ~6.000, mas era variação da máquina: repetida, voltou a ~8.500). Compare sempre mais de uma rodada antes de concluir regressão; 300 visitas simultâneas sem falha. Teste longo de 110 min a 40 req/s: 0 erros, memória do backend estável (~67 MB).

## 13.5 Cuidados

- Os testes `S3` (containers sem root) usam `docker compose exec` na pasta do projeto; se o Docker não estiver acessível (ex.: testando um servidor remoto), eles são pulados.
- **Esperas nos testes de interface:** as páginas abrem com `domcontentloaded` e a função `settle` espera a rede no máximo 10 s; a navegação do menu espera só a troca de endereço (`commit`). Esperar o evento "load" ou "rede ociosa" sem limite fazia testes aleatórios estourarem 30 s no Firefox, porque o mapa depende do OpenStreetMap (externo). Mesmo assim, o Firefox automatizado às vezes trava a abertura de uma página em rodadas longas (o servidor responde em ~2 ms e o teste isolado passa): `openPage` tenta abrir de novo, uma vez, numa sessão nova se a página não abrir em 15 s, e o Firefox dos testes usa só IPv4 (`localhost` resolve primeiro para `::1`, e o Docker publica só em IPv4). Resultado: Firefox 68/0 em 3 rodadas seguidas.
- A suíte e2e faz **no máximo 4 logins errados** e termina com um login correto (5 errados trancariam o admin). Mantenha essa regra ao criar testes.
- `npm run test:backend` usa só o banco de teste `pet_saude_test` (S10, 08/10/2026): a auditoria e os dados do sistema não são tocados. Os testes de agregação apagam e recriam registros **apenas** nesse banco (conferem o nome antes).
- Nenhum teste de interface clica em "Sincronizar"; só a suíte e2e com `QA_TABNET=1` dispara coleta.
- Ao criar um teste novo de defeito, use `todo` com o código do item do plano.
