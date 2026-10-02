# 8. Área administrativa

Endereço: `http://<servidor>:3000/admin`. Usuário: `ADMIN_USERNAME` (padrão `admin`). Senha: `ADMIN_PASSWORD` do `.env`.

## 8.1 O que dá para fazer

As telas ficam no **menu lateral**, que abre pelo botão ☰ no canto superior esquerdo. No rodapé do menu estão o tema claro/escuro, "Conectado como …" e o botão **Sair**.

| Tela | Endereço | O que tem |
|---|---|---|
| Painel | `/admin` | Números gerais (fontes, registros, sincronizações, falhas) e o **dashboard da fonte**: escolha fonte e filtros; ao lado ficam **Baixar CSV** (registros) e **Baixar dashboard** (HTML com indicadores e gráficos). Os dois arquivos seguem exatamente os filtros da tela |
| Fontes | `/admin/fontes` | Coluna **Situação** (Em dia / Atenção / Problema, com o motivo), filtro municipal, link para a página no TABNET, **Sincronizar** cada uma ou **Sincronizar todas** (~1 minuto) |
| Sincronizações | `/admin/sincronizacoes` | As 50 sincronizações mais recentes: início, fonte, status, registros, duração, origem (agendador, admin, linha de comando) e erro. Filtros por fonte e status |
| Auditoria | `/admin/auditoria` | Os 500 eventos mais recentes, com **data e hora (com segundos), usuário, IP, ação, status, detalhes** em frase ("Baixou CSV de Casos de Dengue, ano 2024 (25 registros)") e **navegador** ("Firefox 155 · Linux"; passe o mouse para ver o texto completo). Filtros por ação e status e busca por texto |

**Alerta de fontes (O5):** quando alguma fonte falha 3 vezes seguidas, nunca sincronizou, está há mais de *intervalo do agendador + 7 dias* sem atualizar ou teve aviso na descoberta de anos novos, aparece um **alerta no topo do Painel** com o motivo e o link para Fontes. Antes de falhar, o sistema tenta de novo sozinho (até 3 tentativas) quando o TABNET oscila. E-mail de alerta fica para a implantação (item 6.6 do plano).

**Usuário na auditoria:** é o `ADMIN_USERNAME`. Tentativas de login com senha errada e pedidos bloqueados aparecem como **"Não identificado"** (ainda não há sessão), e o usuário digitado aparece nos detalhes. Como há uma única conta de administrador, para saber **qual pessoa** usou a conta é preciso cruzar horário, IP e navegador; contas individuais são o item 7.4 do plano.

Fontes derivadas (arboviroses) não têm botão de sincronizar: sincronize `dengue_sinan` e a zika (pelo "Sincronizar todas").

## 8.2 Como a segurança funciona

[`backend/src/middleware/admin-auth.ts`](../backend/src/middleware/admin-auth.ts):

| Mecanismo | Detalhe |
|---|---|
| Sessão | Cookie `painel_admin_session` `httpOnly`, `SameSite=Strict`, restrito a `/api/admin`, válido por **8 horas**, assinado com HMAC-SHA256 usando `ADMIN_SESSION_SECRET`. O cookie carrega o id de uma sessão guardada no banco (`admin_sessions`): o **logout revoga a sessão no servidor**, então um cookie copiado antes deixa de valer |
| Comparação de senha | Em tempo constante: compara os hashes SHA-256 dos dois lados com `timingSafeEqual`, então nem o tamanho da senha vaza pelo tempo de resposta (vale também para a assinatura do cookie e o token Bearer) |
| Cookie `Secure` | `ADMIN_COOKIE_SECURE=true` em HTTPS (obrigatório ao publicar; o `start` e o backend avisam) |
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
