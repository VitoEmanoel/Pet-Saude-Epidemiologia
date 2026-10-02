# 9. Guia de manutenção (passo a passo)

Receitas para as tarefas mais comuns. Depois de qualquer mudança de código no fluxo Docker, rode `npm run start` (ele refaz o build).

---

## 9.1 Incluir um ano novo de dados

O TABNET publica um arquivo por ano (ex.: `tubebr26.dbf` para 2026). A lista de anos coletados está **fixa no código**: quando o DATASUS publica um ano novo, é preciso incluí-lo.

1. Abra o formulário da fonte (URL `deftohtm.exe?...`, ver [05-coleta-de-dados.md](05-coleta-de-dados.md#53-configuração-de-cada-fonte)) e confira o último arquivo da lista "Período".
2. Em [`backend/src/modules/datasus/sinan-tabnet.collector.ts`](../backend/src/modules/datasus/sinan-tabnet.collector.ts), aumente o último número do segmento mais recente da fonte:

   ```ts
   segments: [{ tabnetQueryUrl: "...tubercbr.def", periodFiles: numberedFiles("tubebr", 1, 25) }],  // antes: 2001–2025
   segments: [{ tabnetQueryUrl: "...tubercbr.def", periodFiles: numberedFiles("tubebr", 1, 26) }],  // depois: 2001–2026
   ```

   Na dengue, o ano novo entra no **2º segmento** (`denguebbr.def`). Se o DATASUS criar um formulário novo para uma faixa de anos, acrescente outro segmento.

3. Sincronize a fonte (`npm run sync:data` ou o botão no admin) e confira o novo ano no site.

> Se você incluir um arquivo que ainda não existe, o TABNET devolve erro e a sincronização fica `FAILED`. Os dados antigos são mantidos.

Para saber quais fontes estão desatualizadas: **Admin → Dashboard da fonte** ou `GET /api/sources/<slug>/summary` (campo `lastAvailableYear`).

---

## 9.2 Adicionar uma fonte nova (ex.: chikungunya)

1. **Valide no TABNET** seguindo [05-coleta-de-dados.md §5.5](05-coleta-de-dados.md#55-como-descobrir-os-parâmetros-de-uma-fonte-nova-ou-que-mudou). Anote a URL do `.def`, os arquivos de período, a linha, o incremento, o nome da coluna de faixa etária e o valor da opção de Parnaíba.
2. **Cadastre a fonte** em [`backend/src/config/sources.ts`](../backend/src/config/sources.ts):

   ```ts
   {
     slug: "chikungunya_sinan",
     name: "Casos de Chikungunya",
     system: "SINAN",
     category: ALLOWED_DATASUS_CATEGORY,
     municipalityFilterStatus: "available",
     sourceUrl: "http://tabnet.datasus.gov.br/cgi/deftohtm.exe?sinannet/cnv/chikunbr.def", // confirme a URL real
     active: true,
     syncEnabled: true,
     kind: "internal"   // "primary" se for ganhar página própria
   }
   ```

3. **Configure o coletor** acrescentando uma entrada em `collectorConfigs` no `sinan-tabnet.collector.ts` (copie uma existente parecida, como `zika_sinan`, e ajuste os campos).
4. **Se for compor arboviroses**, acrescente o slug em `composedOf` da `arboviroses_sinan`:

   ```ts
   composedOf: ["dengue_sinan", "zika_sinan", "chikungunya_sinan"]
   ```

5. **Se for ter página própria** (`kind: "primary"`):
   - crie `frontend/src/app/<rota>/page.tsx` copiando `app/dengue/page.tsx` e trocando `source`, `title` e `active`;
   - acrescente o item em `navItems` de [`frontend/src/components/layout/AppShell.tsx`](../frontend/src/components/layout/AppShell.tsx).
6. (Opcional) Crie um atalho em `backend/package.json`: `"sync:chikungunya": "tsx src/scripts/sync-data.ts chikungunya_sinan"`.
7. Suba o sistema (`npm run start`, que roda o seed e cadastra a fonte) e sincronize: `npm run sync:data -- chikungunya_sinan`.
8. Confira o resultado no admin (histórico) e no banco ([04-banco-de-dados.md §4.3](04-banco-de-dados.md#43-consultas-úteis-sql)).
9. Salve as evidências em `docs/evidencias/<slug>/` e atualize as tabelas de [01-visao-geral.md](01-visao-geral.md) e [05-coleta-de-dados.md](05-coleta-de-dados.md).

---

## 9.3 Uma fonte parou de sincronizar

1. Veja o erro: **Admin → Histórico de sincronizações**, ou

   ```sql
   SELECT id, status, error_message, started_at FROM sync_jobs ORDER BY id DESC LIMIT 5;
   ```

2. Interprete:

   | Mensagem | Causa provável | O que fazer |
   |---|---|---|
   | `TABNET retornou HTTP 5xx` / `fetch failed` / `aborted` | TABNET fora do ar ou lento (timeout de 60 s) | Tentar mais tarde |
   | `Resposta TABNET nao contem bloco PRE` | Parâmetro inválido (arquivo de ano inexistente, nome de campo mudou) | Abra o HTML salvo em `backend/storage/raw-imports/<slug>/` e leia a mensagem do TABNET; revalide os parâmetros (§5.5) |
   | `Resposta TABNET prn nao contem linhas de dados` | Consulta válida mas sem dados | Confira filtro de município e período |
   | `Coleta concluida, mas nenhum registro municipal foi retornado` | Parnaíba sem casos ou opção de município errada | Revalide o `value` da opção de Parnaíba |
   | `Sincronizacao ja em andamento` | Outra coleta da mesma fonte em curso | Aguarde |

3. Reproduza manualmente com o `curl` de [05-coleta-de-dados.md §5.5](05-coleta-de-dados.md#55-como-descobrir-os-parâmetros-de-uma-fonte-nova-ou-que-mudou).

---

## 9.4 Alterar a estrutura do banco

1. Edite [`backend/prisma/schema.prisma`](../backend/prisma/schema.prisma).
2. Com o banco de desenvolvimento rodando ([02 §2.4](02-instalacao-e-execucao.md#24-modo-desenvolvimento-sem-docker-para-o-código)):

   ```bash
   npm run prisma:migrate -- --name descreva_a_mudanca
   ```

   Isso cria `backend/prisma/migrations/<data>_descreva_a_mudanca/migration.sql` e regenera o cliente Prisma.
3. Faça commit da pasta da migration junto com o código.
4. Em produção, o `npm run start` aplica a migration automaticamente (`prisma migrate deploy`).

Nunca edite uma migration que já foi aplicada em outro ambiente: crie uma nova.

---

## 9.5 Mudar textos, cores ou layout

| O quê | Onde |
|---|---|
| Nome de uma doença no menu | `navItems` em `frontend/src/components/layout/AppShell.tsx` |
| Título de uma página | `title` em `frontend/src/app/<rota>/page.tsx` |
| Nome oficial de uma fonte (API, admin, exportação) | `name` em `backend/src/config/sources.ts` |
| Título da aba do navegador | `metadata` em `frontend/src/app/layout.tsx` |
| Cores | `frontend/tailwind.config.ts` e `frontend/src/app/globals.css` |
| Avisos e textos dos dashboards | `TuberculosisDashboard.tsx` (doenças) e `OverviewDashboard.tsx` (início) |
| Visual do HTML exportado | `backend/src/modules/admin/dashboard-export.service.ts` |

---

## 9.6 Atualizar dependências

```bash
npm outdated                 # ver o que está desatualizado
npm audit --omit=dev         # ver vulnerabilidades
npm install <pacote>@<versão> --workspace frontend   # ou backend
npm run test:backend && npm run build:backend && npm run build:frontend
```

Atualize uma coisa por vez e teste. Mudanças de versão principal (Next, React, Prisma, Express) exigem ler o guia de migração do pacote.

Depois de atualizar, reconstrua as imagens (`docker compose --env-file .env up -d --build backend frontend`) e rode a suíte de QA (`npm run test:e2e` e `npm run test:ui`, ver [13](13-testes.md)).

**`overrides` no `package.json` da raiz.** O Next.js 15 traz uma cópia própria e antiga do `postcss` (8.4.31, com vulnerabilidade alta). Como a correção oficial só existe no Next 16 (mudança de versão principal), o `package.json` da raiz força o `postcss` corrigido dentro do `next`:

```json
"overrides": { "next": { "postcss": "^8.5.28" } }
```

Ao migrar para o Next 16, teste remover esse bloco: se `npm audit` continuar limpo sem ele, ele não é mais necessário.

**Pacote de testes (`tests/`).** Tem dependências próprias, que não vão para produção. Em 02/10/2026, `npm audit` dentro de `tests/` mostra 3 alertas **moderados** no `uuid` usado pelo `autocannon` (ferramenta de carga). A "correção" sugerida rebaixaria o `autocannon` da versão 8 para a 2, por isso foi aceito: só roda na máquina de quem testa.

---

## 9.7 Rotina mensal sugerida

- [ ] Admin → Histórico: todas as fontes com `SUCCESS` no último mês?
- [ ] Algum ano novo publicado no TABNET? (§9.1)
- [ ] Backup do banco ([04 §4.4](04-banco-de-dados.md#44-migrations-seed-e-backup))
- [ ] `npm audit --omit=dev` sem vulnerabilidades críticas
- [ ] Espaço em disco (`docker system df`)
