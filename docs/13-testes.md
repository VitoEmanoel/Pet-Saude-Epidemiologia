# 13. Testes

O projeto tem dois conjuntos de testes:

| Conjunto | Onde | Precisa do sistema no ar? | Para quê |
|---|---|---|---|
| Testes do backend | `backend/src/routes/public-api.test.ts` | Não (sobe a API em memória, mas usa o banco do `DATABASE_URL`) | Rotas, validação, login |
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
| `npm run test:backend` | Testes do backend (13) | segundos |
| `npm run test:e2e` | API: funcional, integração, regressão, validação, admin; segurança: sessão, login, CSRF/CORS, injeção, XSS, exposição, cabeçalhos | ~2 s |
| `npm run test:ui` | Interface no Chromium: 8 páginas × desktop/celular, gráficos, mapa, acessibilidade (axe), filtros, paginação, menu, tema, fluxo do admin, API fora do ar | ~1 min |
| `QA_BROWSER=firefox npm run test:ui` | O mesmo no Firefox | ~1 min |
| `npm run test:ui:webkit` | O mesmo no WebKit (motor do Safari), emulando iPhone 15. Roda na imagem Docker oficial do Playwright, porque o WebKit não roda direto no Arch Linux | ~2 min |
| `npm run test:resilience` | Simula falhas do TABNET (rede, HTTP 503, layout alterado, falha no meio) e confere que os dados antigos são mantidos e que a coleta se recupera. Usa o `backend/.env` e a internet | ~15 s |
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
| `test:e2e` | D1, D2, D3, D4, S2 (×2), S4, S6, S7, S8 (×2) |
| `test:ui` | D2 (desktop e celular), U1, U2 |

Para ver os `todo` e se estão falhando:

```bash
cd tests && node --test --test-concurrency=1 --test-reporter=tap e2e/*.test.mjs | grep "# TODO"
```

## 13.4 Resultado de referência (01/10/2026)

| Suíte | Passam | Falham | Pulados | `todo` |
|---|---|---|---|---|
| `test:backend` | 13 | 0 | 0 | 0 |
| `test:e2e` | 66 | 0 | 3 (TABNET ×2, bloqueio) | 11 |
| `test:e2e` com `QA_TABNET=1` | +2 | 0 | | |
| `test:ui` (Chromium, Firefox, WebKit) | 44 | 0 | 0 | 4 |
| `test:resilience` | 6/6 | | | |

Carga (16 núcleos): `/health` ~8.800 req/s; resumo de fonte ~470 req/s; visão geral ~225 req/s; 300 visitas simultâneas sem falha. Teste longo de 110 min a 40 req/s: 0 erros, memória do backend estável (~67 MB).

## 13.5 Cuidados

- A suíte e2e faz **no máximo 4 logins errados** e termina com um login correto (5 errados trancariam o admin). Mantenha essa regra ao criar testes.
- `npm run test:backend` grava logins de teste na auditoria do banco configurado (item S10). Nunca rode contra produção.
- Nenhum teste de interface clica em "Sincronizar"; só a suíte e2e com `QA_TABNET=1` dispara coleta.
- Ao criar um teste novo de defeito, use `todo` com o código do item do plano.
