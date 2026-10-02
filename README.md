# Painel Epidemiológico de Parnaíba - PI (PET-Saúde)

Sistema web que coleta automaticamente dados públicos do **DATASUS/TABNET** (SINAN), filtrados **exclusivamente para Parnaíba - PI** (IBGE 2207702), e os exibe em dashboards com indicadores, gráficos, mapa e tabela.

```txt
DATASUS/TABNET ──► backend (coletor) ──► PostgreSQL ──► API ──► site
```

Doenças cobertas: tuberculose, hanseníase, sífilis congênita, sífilis gestacional, dengue e arboviroses (dengue + zika).

**Stack:** Node.js 20 · TypeScript · Express · Prisma · PostgreSQL · Next.js · React · Tailwind · ECharts · Docker Compose

## Início rápido

Pré-requisitos: Linux (ou WSL2), Node.js 20+, Docker Engine oficial com Compose.

```bash
npm install
cp .env.example .env      # troque ADMIN_PASSWORD e ADMIN_SESSION_SECRET
npm run doctor            # confere o ambiente
npm run start             # sobe banco, backend e frontend
npm run sync:data         # baixa os dados do DATASUS (sem isso o painel fica vazio)
```

| | Endereço |
|---|---|
| Site | http://localhost:3000 |
| Administração | http://localhost:3000/admin |
| API | http://localhost:3333 (saúde: `/health`) |

Outros comandos: `npm run stop`, `npm run restart`, `npm run logs`, `npm run dev` (desenvolvimento), `npm run test:backend`.

## Documentação

O manual completo de instalação, operação e manutenção está em **[docs/](docs/README.md)**:

- [Visão geral e regras do projeto](docs/01-visao-geral.md)
- [Instalação e execução](docs/02-instalacao-e-execucao.md)
- [Arquitetura](docs/03-arquitetura.md) · [Banco de dados](docs/04-banco-de-dados.md) · [Coleta TABNET](docs/05-coleta-de-dados.md) · [API](docs/06-api.md) · [Frontend](docs/07-frontend.md) · [Admin](docs/08-area-administrativa.md)
- [Guia de manutenção](docs/09-guia-de-manutencao.md) · [Solução de problemas](docs/10-solucao-de-problemas.md)
- [Problemas conhecidos](docs/11-limitacoes-conhecidas.md) · [Plano de ação](docs/12-plano-de-acao.md)

## Regras fixas

- Município fixo: Parnaíba - PI. A API recusa filtros de outros municípios.
- Somente a seção "Epidemiológicas e Morbidade" do DATASUS.
- O site nunca consulta o DATASUS diretamente e nunca exibe dados estimados.
