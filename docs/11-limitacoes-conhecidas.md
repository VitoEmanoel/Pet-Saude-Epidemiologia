# 11. Problemas e limitações conhecidos

Levantamento de 01/10/2026: análise do código e sistema rodando no Docker com dados reais, mais 8 baterias de testes (funcional, integração, regressão, carga, estresse, teste longo de 110 min, segurança, interface/acessibilidade em Chrome, Firefox e Safari/WebKit, resiliência e backup).

Cada problema tem um **código** (D = dados, O = operação, S = segurança, U = usabilidade, Q = qualidade). O plano para corrigir, com caixinhas de acompanhamento, está em [12-plano-de-acao.md](12-plano-de-acao.md). **Ao corrigir um item, marque-o lá e remova-o daqui.**

| Tema | Alta | Média | Baixa | Total |
|---|---|---|---|---|
| Dados exibidos (D) | 0 | 1 | 1 | 2 |
| Implantação e operação (O) | 0 | 3 | 2 | 5 |
| Segurança (S) | 0 | 0 | 3 | 3 |
| Interface e usabilidade (U) | 0 | 3 | 4 | 7 |
| Qualidade e desempenho (Q) | 0 | 1 | 3 | 4 |
| **Total** | **0** | **8** | **13** | **21** |

---

## D. Dados exibidos

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
- `tuberculosis-sinan.collector.ts` (não importado), dependência `zod`, variável `VITE_API_URL`, status `PENDING/PARTIAL_SUCCESS/SKIPPED` e coluna `month` sem uso.

---

## S. Segurança

### S7. POST no admin sem `Origin` passa pela checagem de origem. **Baixa**
- Mitigado pelo cookie `SameSite=Strict`. **Correção:** exigir `Origin`/`Referer` em métodos que alteram estado.

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
- Backend é o gargalo (1.440% CPU vs 95% do banco) e satura ~2.000 conexões simultâneas. Capacidade atual é suficiente; um cache em memória no backend multiplicaria a folga (o Redis foi removido no O6; volta só se o cache precisar ser compartilhado).

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
