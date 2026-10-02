# 11. Problemas e limitações conhecidos

Levantamento de 01/10/2026: análise do código e sistema rodando no Docker com dados reais, mais 8 baterias de testes (funcional, integração, regressão, carga, estresse, teste longo de 110 min, segurança, interface/acessibilidade em Chrome, Firefox e Safari/WebKit, resiliência e backup).

Cada problema tem um **código** (D = dados, O = operação, S = segurança, U = usabilidade, Q = qualidade). O plano para corrigir, com caixinhas de acompanhamento, está em [12-plano-de-acao.md](12-plano-de-acao.md). **Ao corrigir um item, marque-o lá e remova-o daqui.**

| Tema | Alta | Média | Baixa | Total |
|---|---|---|---|---|
| Dados exibidos (D) | 1 | 2 | 1 | 4 |
| Implantação e operação (O) | 0 | 3 | 2 | 5 |
| Segurança (S) | 2 | 4 | 4 | 10 |
| Interface e usabilidade (U) | 0 | 3 | 4 | 7 |
| Qualidade e desempenho (Q) | 0 | 1 | 3 | 4 |
| **Total** | **3** | **13** | **14** | **30** |

---

## D. Dados exibidos

### D1. Dengue (e arboviroses) sem dados depois de 2013. **Alta**
- **Sintoma:** dengue mostra só 2007–2013; arboviroses mostra dengue até 2013 e só zika depois (2016–2025), parecendo uma queda que não existe.
- **Causa:** `periodFiles: numberedFiles("dengbr", 7, 13)` em `backend/src/modules/datasus/sinan-tabnet.collector.ts`. Os dados de 2014+ ficam em outra tabela TABNET, nunca configurada.
- **Evidência:** `GET /api/sources/dengue_sinan/summary` → `lastAvailableYear: 2013`.
- **Correção:** localizar no TABNET o `.def` de dengue 2014+, validar e configurar (provavelmente como fonte nova que também compõe `dengue_sinan`/arboviroses).

### D4. "Total de casos" da página inicial não tem significado. **Média**
- **Sintoma:** 6.476 = soma de doenças diferentes, métricas diferentes (confirmados + prováveis + frequência) e **187 casos de zika** (fonte interna, não exibida).
- **Causa:** `getDashboardOverview` e `baseSourceSlugs` em `public-data.service.ts` incluem fontes `internal`.
- **Correção:** excluir fontes internas e trocar o indicador por algo com sentido (ex.: total por doença, ou remover).

### D5. Anos de coleta fixos no código. **Média**
- **Sintoma:** ano novo publicado no DATASUS não aparece até alguém editar `periodFiles`.
- **Correção:** ler a lista de arquivos do formulário TABNET automaticamente, ou ao menos alertar quando existir arquivo novo.

### D6. Cartão "Registros" ignora filtros. **Baixa**
- **Sintoma:** com qualquer filtro, continua mostrando o total (ex.: 500).

---

## O. Implantação e operação

### O2. HTMLs brutos se perdem ao recriar o container. **Média**
- **Evidência:** recriando o backend, 32 arquivos → 0; 38 linhas em `raw_imports` apontando para arquivos inexistentes.
- **Correção:** volume Docker para `/app/backend/storage`.

### O3. Trava de sincronização só em memória. **Média**
- **Sintoma:** processos diferentes (agendador e coleta manual por outro container) podem sincronizar a mesma fonte ao mesmo tempo.
- **Correção:** trava no banco (`pg_advisory_lock`).

### O4. Gravação da coleta sem transação. **Média**
- **Sintoma:** falha no meio deixa registros associados ao job que falhou (os valores continuam corretos, verificado em teste de injeção de falhas).
- **Correção:** gravar em lote dentro de uma transação por sincronização.

### O5. Falhas de coleta silenciosas. **Baixa**
- **Sintoma:** fonte que falha é retentada todo dia pelo agendador, sem alerta para ninguém; sem retry com espera para falhas temporárias.
- **Correção:** retry com backoff + alerta (e-mail/log destacado/aviso no admin).

### O6. Infraestrutura e código sem uso. **Baixa**
- Redis (sobe e não é usado), `tuberculosis-sinan.collector.ts` (não importado), dependência `zod`, variável `VITE_API_URL`, status `PENDING/PARTIAL_SUCCESS/SKIPPED` e coluna `month` sem uso.

---

## S. Segurança

### S1. Dependências com vulnerabilidades. **Alta**
- `npm audit --omit=dev`: 7 vulnerabilidades: **1 crítica (`next`)**, altas em `sharp`, `postcss`, `nanoid`; moderadas em `express`, `body-parser`, `qs`. Todas com correção disponível.

### S2. Site público sem cabeçalhos de segurança. **Alta**
- Faltam CSP, `X-Frame-Options` (clickjacking), `X-Content-Type-Options`, `Referrer-Policy`, HSTS no Next.js; a API pública também não envia `nosniff`.
- **Correção:** `headers()` no `next.config.ts`; `helmet` no Express.

### S3. Containers rodam como `root`. **Média**
- Backend e frontend com `uid=0`. **Correção:** `USER node` no `Dockerfile`.

### S4. IP da auditoria falsificável. **Média**
- **Evidência:** login com `X-Forwarded-For: 8.8.8.8` → auditoria grava `8.8.8.8` (`getRequestIp` em `admin-audit.service.ts`).
- **Correção:** `app.set("trust proxy", ...)` conforme o deploy e usar só `request.ip`.

### S5. Bloqueio de login tranca o admin legítimo. **Média**
- **Evidência:** após 5 senhas erradas, até a senha correta recebe 429 por 15 min. Conexões vindas do host aparecem como `172.18.0.1` (gateway Docker); atrás de proxy, todos dividem o mesmo IP, então qualquer pessoa consegue trancar o admin.
- **Correção:** `trust proxy` (S4) + limite por usuário/IP real; considerar atraso progressivo em vez de bloqueio total.

### S6. Handler de erro do Express não funciona. **Média**
- `server.ts` declara o handler com 3 parâmetros (Express exige 4) e depois do 404. JSON inválido retorna página HTML (sem stack trace em produção).
- **Correção:** assinatura `(error, _req, res, _next)`.

### S7. POST no admin sem `Origin` passa pela checagem de origem. **Baixa**
- Mitigado pelo cookie `SameSite=Strict`. **Correção:** exigir `Origin`/`Referer` em métodos que alteram estado.

### S8. Tecnologia anunciada nos cabeçalhos. **Baixa**
- `X-Powered-By: Express` e `X-Powered-By: Next.js`. **Correção:** `app.disable("x-powered-by")`; `poweredByHeader: false`.

### S9. Cookie sem `Secure`. **Baixa (configuração)**
- Correto em HTTP local; **obrigatório** `ADMIN_COOKIE_SECURE=true` ao publicar com HTTPS.

### S10. Testes gravam na auditoria do banco real. **Baixa**
- `npm run test:backend` insere logins falsos em `admin_audit_logs` do banco configurado.
- **Correção:** banco de teste separado ou auditoria desligada nos testes.

**Limitação (não é defeito):** um único usuário administrador, sem cadastro; não há como saber qual pessoa fez cada ação.

---

## U. Interface e usabilidade

### U1. Login do admin não envia com Enter. **Média**
- Não há `<form>` em `AdminDashboard.tsx`; também prejudica gerenciadores de senha.

### U2. Contraste insuficiente (WCAG AA). **Média**
- "Parnaíba - PI" no cabeçalho (`#459cd7` sobre `#143a60` = 3,87:1) e botão "Limpar" (`#e8531e` sobre branco = 3,69:1). Mínimo: 4,5:1.

### U3. Linguagem técnica e textos sem acento. **Média**
- Status "SUCCESS" em inglês; "1 registros" (plural errado); rótulos "Ultimo ano", "Faixa etaria", "Sifilis congenita", "Atualizacao".

### U4. Mesmo título em todas as páginas. **Baixa**
- `<title>` e `<h1>` iguais; abas e leitores de tela não distinguem as páginas.

### U5. Favicon inexistente. **Baixa**
- `/favicon.ico` → 404.

### U6. Alvos de toque pequenos no celular. **Baixa**
- Elementos clicáveis < 24 px (6 na página inicial, 2 por página de doença).

### U7. Página de doença muito longa no celular. **Baixa**
- ~6.000 px de rolagem, quase toda na lista de registros (um cartão grande por registro).

---

## Q. Qualidade de código e desempenho

### Q1. Testes cobrem pouco. **Média**
- Só 13 testes de rota/login. Sem testes do parser PRN, coletor e agregações (a parte mais crítica). Os HTMLs em `docs/evidencias/` servem de base.

### Q2. Sem lint, formatação padrão e CI. **Baixa**

### Q3. Código difícil de manter. **Baixa**
- `AdminDashboard.tsx` com ~1.700 linhas; `TuberculosisDashboard.tsx` exporta `DiseaseDashboard`.

### Q4. Sem cache. **Baixa**
- Backend é o gargalo (1.440% CPU vs 95% do banco) e satura ~2.000 conexões simultâneas. Capacidade atual é suficiente; um cache (Redis já disponível) multiplicaria a folga.

---

## O que foi testado e está bom

| Área | Resultado |
|---|---|
| Estabilidade | 110 min, 246 mil requisições, 0 erros, memória estável |
| Capacidade | 300 visitas simultâneas sem falha; recupera-se sozinho após saturar |
| Resiliência | Falhas do TABNET preservam os dados antigos; recuperação automática |
| Banco | Reinício do PostgreSQL: ~2 s de indisponibilidade; backup/restauração conferem |
| Compatibilidade | Chrome, Firefox 155 e Safari (WebKit 26.6/iPhone 15): todos os fluxos passam |
| Segurança da sessão | Cookie forjado/adulterado/expirado rejeitado; HttpOnly + SameSite=Strict |
| Injeção | SQL/NoSQL/XSS/CSV sem sucesso |
| Regra principal | Impossível consultar outro município |
| Integridade | Números batem com o DATASUS; resincronizar não duplica |
