# 8. Área administrativa

Endereço: `http://<servidor>:3000/admin`. Usuário: `ADMIN_USERNAME` (padrão `admin`). Senha: `ADMIN_PASSWORD` do `.env`.

## 8.1 O que dá para fazer

| Seção da tela | Ação |
|---|---|
| Fontes | Ver o status de cada fonte e **sincronizar** uma fonte (botão "Sincronizar fonte") |
| Sincronizar todas | Coleta todas as fontes em sequência (~1 minuto) |
| Exportação | Baixar **CSV** dos registros ou **HTML** do dashboard de uma fonte, com filtros |
| Dashboard da fonte | Pré-visualizar gráficos e tabela com filtros |
| Histórico de sincronizações | Últimos 50 jobs, com status, registros e erro |
| Auditoria administrativa | Últimos 100 eventos (logins, exportações, sincronizações) |

Fontes derivadas (arboviroses) não têm botão de sincronizar: sincronize `dengue_sinan` e a zika (pelo "Sincronizar todas").

## 8.2 Como a segurança funciona

[`backend/src/middleware/admin-auth.ts`](../backend/src/middleware/admin-auth.ts):

| Mecanismo | Detalhe |
|---|---|
| Sessão | Cookie `painel_admin_session` `httpOnly`, `SameSite=Strict`, restrito a `/api/admin`, válido por **8 horas**, assinado com HMAC-SHA256 usando `ADMIN_SESSION_SECRET` |
| Comparação de senha | Em tempo constante (`timingSafeEqual`) |
| Limite de tentativas | 5 erros por IP real → bloqueio de 15 minutos **só para aquele IP** (em memória: reiniciar o backend zera). Tentativas de outra pessoa não trancam o administrador que acessa de outro endereço. Atrás de proxy, depende de `TRUST_PROXY` ([02 §2.5](02-instalacao-e-execucao.md#25-variáveis-de-ambiente-env)) |
| Origem | POST/PUT/DELETE só aceitos de origens em `CORS_ORIGIN` |
| Cabeçalhos | `no-store`, `X-Frame-Options: DENY`, CSP restritiva, `nosniff` |
| Auditoria | Tudo registrado em `admin_audit_logs` |

Há **um único usuário** administrador (não existe cadastro de usuários).

## 8.3 Tarefas comuns

| Tarefa | Como |
|---|---|
| Trocar a senha | Edite `ADMIN_PASSWORD` no `.env` e rode `npm run restart` |
| Derrubar todas as sessões | Troque `ADMIN_SESSION_SECRET` e rode `npm run restart` |
| Desbloquear login após 5 erros | Espere 15 min ou reinicie o backend (`docker compose --env-file .env restart backend`) |
| Site em HTTPS | `ADMIN_COOKIE_SECURE=true` (sem isso o cookie não é marcado `Secure`) |
| Admin diz "não configurado" (503) | Falta `ADMIN_USERNAME`, `ADMIN_PASSWORD` ou `ADMIN_SESSION_SECRET` no `.env` |
| Login funciona no curl mas não no navegador | Confira se `CORS_ORIGIN` contém exatamente a URL do site (protocolo, host e porta) |
