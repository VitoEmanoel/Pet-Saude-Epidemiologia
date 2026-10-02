# 7. Frontend (site)

Next.js 15 (App Router) + React 19 + Tailwind CSS. Todas as páginas buscam dados **no navegador** (componentes `"use client"`) chamando a API de [`lib/api.ts`](../frontend/src/lib/api.ts).

## 7.1 Páginas

| URL | Arquivo | Componente principal |
|---|---|---|
| `/` | `app/page.tsx` | `OverviewDashboard`: cartões gerais, evolução anual, mapa, catálogo de fontes |
| `/tuberculose` | `app/tuberculose/page.tsx` | `DiseaseDashboard source="tuberculose_sinan"` |
| `/hanseniase` | `app/hanseniase/page.tsx` | `DiseaseDashboard source="hanseniase_sinan"` |
| `/sifilis` | `app/sifilis/page.tsx` | `DiseaseDashboard source="sifilis_congenita_sinan"` |
| `/dengue` | `app/dengue/page.tsx` | `DiseaseDashboard source="dengue_sinan"` |
| `/arboviroses` | `app/arboviroses/page.tsx` | `DiseaseDashboard source="arboviroses_sinan"` |
| `/sifilis-gestacional` | `app/sifilis-gestacional/page.tsx` | `DiseaseDashboard source="sifilis_gestacional_sinan"` |
| `/admin` | `app/admin/page.tsx` | `AdminOverview`: indicadores gerais e dashboard da fonte com **Baixar CSV** e **Baixar dashboard** |
| `/admin/fontes` | `app/admin/fontes/page.tsx` | `AdminSources`: situação das fontes, sincronizar uma ou todas |
| `/admin/sincronizacoes` | `app/admin/sincronizacoes/page.tsx` | `AdminSyncHistory`: últimas 50 sincronizações, com filtros |
| `/admin/auditoria` | `app/admin/auditoria/page.tsx` | `AdminAudit`: quem fez o quê, quando, IP e navegador |

As telas do admin ficam dentro de `app/admin/layout.tsx` (`AdminShell`), que guarda a sessão e o menu: trocar de tela não recarrega o login.

Cada página de doença tem só 10 linhas: escolhe o `source` e o título. Toda a lógica está em **`DiseaseDashboard`**, exportado por [`components/dashboard/TuberculosisDashboard.tsx`](../frontend/src/components/dashboard/TuberculosisDashboard.tsx). O nome do arquivo é histórico: o componente serve a todas as doenças.

## 7.2 Componentes

| Componente | Função |
|---|---|
| `layout/SideDrawer.tsx` | **Menu lateral em gaveta**, usado pelo site e pelo admin: fica escondido e abre pelo botão ☰ do cabeçalho; fecha ao escolher um item, ao clicar fora ou com Esc. O botão de **tema claro/escuro** fica no rodapé dele |
| `layout/AppShell.tsx` | Cabeçalho e itens do menu (lista `navItems`) do site público |
| `layout/AdminShell.tsx` | Cabeçalho e menu do admin (lista `ADMIN_PAGES`), com "Conectado como …" e **Sair** no rodapé do menu |
| `dashboard/OverviewDashboard.tsx` | Página inicial: cartões, evolução anual (soma das doenças) e tabela de fontes com casos e período de cada doença |
| `dashboard/TuberculosisDashboard.tsx` | `DiseaseDashboard`: filtros, cartões, 4 gráficos, mapa e tabela paginada. Só um filtro demográfico por vez: escolher sexo limpa faixa etária e raça/cor (e vice-versa); os gráficos das outras dimensões mostram um aviso ("Mostrando todos os sexos: o DATASUS não separa…"), montado por `lib/demographics.ts`. A tabela tem o seletor **Detalhar por** (total do ano, sexo, faixa etária, raça/cor); com filtro demográfico ele fica travado na mesma dimensão |
| `admin/AdminSession.tsx` | Sessão do admin compartilhada pelas telas (`useAdminSession`); sem sessão mostra o formulário de login (`<form>`: Enter envia) |
| `admin/AdminSourceDashboard.tsx` | Dashboard da fonte no admin; os downloads seguem os filtros da tela |
| `admin/AdminAudit.tsx` | Tradução dos eventos de auditoria em frases (`describeAuditEvent`) e do navegador (`describeBrowser`) |
| `admin/admin-ui.tsx`, `admin/useAdminLoader.ts` | Peças comuns das telas do admin (painel, botões, status, paginação) e carregamento com volta ao login se a sessão cair |
| `dashboard/ChartPanel.tsx` / `EChart.tsx` | Gráficos (linha/barra) com ECharts |
| `maps/ParnaibaMap.tsx` | Mapa Leaflet centrado em Parnaíba (`[-2.905, -41.776]`), carregado só no navegador. O bloco tem a classe `isolate`: sem ela, as camadas do Leaflet (`z-index` 400–1000) passam por cima do cabeçalho fixo (`z-20`) ao rolar. Qualquer outro mapa ou componente com `z-index` alto precisa do mesmo cuidado |
| `ui/MetricCard.tsx`, `StatusPill.tsx`, `ThemeToggle.tsx` | Cartão de indicador, selo de status, alternância claro/escuro |

## 7.3 Identidade visual e tema

- Cores PET-Saúde definidas como `pet-*` em [`tailwind.config.ts`](../frontend/tailwind.config.ts) e em [`globals.css`](../frontend/src/app/globals.css).
- Tema claro/escuro: script em `app/layout.tsx` lê `localStorage["painel-theme"]` ou a preferência do sistema e aplica a classe `dark` em `<html>`.

## 7.4 Variável importante

`NEXT_PUBLIC_API_URL` é **embutida no build**. Se mudar o endereço da API, rode `npm run start` de novo (ele refaz o build do frontend). Ela também define o `connect-src` da CSP (§7.5): sem rebuild, o navegador bloqueia as chamadas para o endereço novo.

## 7.5 Cabeçalhos de segurança

Definidos em `headers()` no [`next.config.ts`](../frontend/next.config.ts), valem para todas as páginas:

| Cabeçalho | Valor | Para quê |
|---|---|---|
| `Content-Security-Policy` | ver abaixo | Limita de onde a página carrega scripts, imagens e dados |
| `X-Frame-Options` | `DENY` | Impede o site de ser embutido em outro (*clickjacking*) |
| `X-Content-Type-Options` | `nosniff` | O navegador não "adivinha" o tipo dos arquivos |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Não envia o endereço completo da página para outros sites |
| `Permissions-Policy` | câmera, microfone e localização desligados | O site não usa |
| `Cross-Origin-Opener-Policy` | `same-origin` | Páginas de outros sites abertas a partir daqui (ou que abrem o painel) não acessam a janela do site |
| `Cross-Origin-Resource-Policy` | `same-origin` | Outros sites não podem embutir os arquivos do painel |
| `Strict-Transport-Security` | `max-age=31536000` | Em HTTPS, força o navegador a usar sempre HTTPS (ignorado em HTTP) |

O `X-Powered-By` está desligado (`poweredByHeader: false`).

**CSP.** O que está liberado e por quê:

- `script-src 'self' 'unsafe-inline'`: o Next.js injeta scripts inline para montar as páginas, e o `layout.tsx` tem o script do tema. Trocar por *nonce* exigiria renderizar todas as páginas no servidor a cada acesso. Em `npm run dev` entra também `'unsafe-eval'` (exigido pelo modo de desenvolvimento).
- `img-src ... https://*.tile.openstreetmap.org`: imagens do mapa.
- `connect-src 'self' <origem de NEXT_PUBLIC_API_URL>`: chamadas à API. Em desenvolvimento entra `ws:` para a recarga automática.
- `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`.

**Ao adicionar algo externo** (outro provedor de mapa, fonte do Google, script de análise de acesso), inclua o domínio na diretiva certa do `next.config.ts`. Sintoma de esquecimento: o recurso não aparece e o console do navegador mostra "Content Security Policy" ou "Refused to load". O teste de interface (`npm run test:ui`) falha com "bloqueios da CSP".
