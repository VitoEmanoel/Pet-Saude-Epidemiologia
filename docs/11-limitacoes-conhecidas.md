# 11. Problemas e limitações conhecidos

Levantamento de 01/10/2026: análise do código e sistema rodando no Docker com dados reais, mais 8 baterias de testes (funcional, integração, regressão, carga, estresse, teste longo de 110 min, segurança, interface/acessibilidade em Chrome, Firefox e Safari/WebKit, resiliência e backup).

Cada problema tem um **código** (D = dados, O = operação, S = segurança, U = usabilidade, Q = qualidade). O plano para corrigir, com caixinhas de acompanhamento, está em [12-plano-de-acao.md](12-plano-de-acao.md). **Ao corrigir um item, marque-o lá e remova-o daqui.**

| Tema | Alta | Média | Baixa | Total |
|---|---|---|---|---|
| Dados exibidos (D) | 0 | 0 | 1 | 1 |
| Implantação e operação (O) | 0 | 3 | 1 | 4 |
| Segurança (S) | 0 | 0 | 2 | 2 |
| Interface e usabilidade (U) | 0 | 0 | 3 | 3 |
| Qualidade e desempenho (Q) | 0 | 1 | 3 | 4 |
| **Total** | **0** | **4** | **10** | **14** |

---

## D. Dados exibidos

### D6. Cartão "Registros" ignora filtros. **Resolvido (03/10/2026)**
- **Sintoma:** com qualquer filtro, continua mostrando o total (ex.: 500).
- **Correção:** no site o cartão conta as linhas da tabela "Registros" (segue filtros e "Detalhar por"); no admin o total técnico virou "Linhas no banco".

**Limitações da fonte (não são defeitos):** o TABNET só chega ao nível de **município**: não há bairro em nenhum formulário, então indicadores por bairro precisam do SINAN local da Secretaria de Saúde. O formulário de zika não tem campo de **gestante**, então a incidência de zika em gestantes também não sai do TABNET. Ver [INDICADORES DE SAÚDE DAS ARBOVIROSES](INDICADORES%20DE%20SA%C3%9ADE%20DAS%20ARBOVIROSES.md) e a Fase 2C do plano.

---

## O. Implantação e operação

### O2. HTMLs brutos se perdem ao recriar o container. **Resolvido (03/10/2026)**
- **Evidência:** recriando o backend, 32 arquivos → 0; 38 linhas em `raw_imports` apontando para arquivos inexistentes.
- **Correção:** volume `backend_storage` em `/app/backend/storage` (desenvolvimento e produção). Arquivos de antes do volume continuam faltando até a próxima sincronização.

### O3. Trava de sincronização só em memória. **Média**
- **Sintoma:** processos diferentes (agendador e coleta manual por outro container) podem sincronizar a mesma fonte ao mesmo tempo.
- **Correção:** trava no banco (`pg_advisory_lock`).

### O4. Gravação da coleta sem transação. **Média**
- **Sintoma:** falha no meio deixa registros associados ao job que falhou (os valores continuam corretos, verificado em teste de injeção de falhas).
- **Correção:** gravar em lote dentro de uma transação por sincronização.

### O6. Infraestrutura e código sem uso. **Baixa**
- `tuberculosis-sinan.collector.ts` (não importado), dependência `zod`, variável `VITE_API_URL`, status `PENDING/PARTIAL_SUCCESS/SKIPPED` e coluna `month` sem uso.

---

## S. Segurança

Os achados S11–S18 da campanha de testes de segurança de 02/10/2026 ([14](14-testes-de-seguranca.md)) foram todos corrigidos na Fase 2B.

### S7. POST no admin sem `Origin` passa pela checagem de origem. **Baixa**
- Mitigado pelo cookie `SameSite=Strict`. **Correção:** exigir `Origin`/`Referer` em métodos que alteram estado.

### S10. Testes gravam na auditoria do banco real. **Baixa**
- `npm run test:backend` insere logins falsos em `admin_audit_logs` do banco configurado.
- **Correção:** banco de teste separado ou auditoria desligada nos testes.

**Limitação (não é defeito):** um único usuário administrador, sem cadastro; não há como saber qual pessoa fez cada ação.

---

## U. Interface e usabilidade

### U4. Mesmo título em todas as páginas. **Baixa**
- `<title>` e `<h1>` iguais; abas e leitores de tela não distinguem as páginas.

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
- `TuberculosisDashboard.tsx` exporta `DiseaseDashboard` (nome do arquivo engana). O antigo `AdminDashboard.tsx` (~1.700 linhas) já foi dividido em telas.

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
