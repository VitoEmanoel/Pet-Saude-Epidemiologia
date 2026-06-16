# Painel Epidemiologico de Parnaiba - PI

Sistema web para consultar, visualizar e exportar dados publicos do DATASUS/TABNET filtrados para o municipio de Parnaiba - PI.

O sistema usa um banco local para guardar os dados coletados. Isso evita depender do DATASUS/TABNET toda vez que alguem abre a pagina. O fluxo correto e: sincronizar os dados para o banco local e depois navegar pelo painel.

## O Que O Sistema Faz

- Coleta dados publicos do DATASUS/TABNET.
- Filtra os dados para Parnaiba - PI.
- Salva importacoes brutas para auditoria.
- Normaliza registros em PostgreSQL.
- Exibe graficos, indicadores, filtros e tabela paginada.
- Permite exportar registros em CSV.

Fontes ativas atualmente:

```txt
tuberculose_sinan
hanseniase_sinan
sifilis_congenita_sinan
```

Fontes planejadas para expansao futura:

```txt
dengue
arboviroses em geral
sifilis gestacional
```

## Tecnologias

- Node.js 20 ou superior
- npm
- TypeScript
- Express
- Prisma
- PostgreSQL
- Redis
- Next.js
- React
- Tailwind CSS
- Docker e Docker Compose

As bibliotecas do backend e do frontend sao instaladas automaticamente com `npm install`.

## Estrutura Do Projeto

```txt
backend/              API Express, Prisma e coletores DATASUS/TABNET
frontend/             Interface Next.js
docs/                 Documentacao e anotacoes do projeto
scripts/              Scripts locais de desenvolvimento e setup
docker-compose.yml    PostgreSQL e Redis locais
.env.example          Modelo de configuracao local
```

## Instalar Em Um Computador Novo

Siga a ordem abaixo. Em caso de computador novo, instale primeiro Node.js, npm, Docker e Docker Compose.

## Linux Ubuntu/Debian

### 1. Atualizar o sistema

```bash
sudo apt update
sudo apt upgrade -y
```

### 2. Instalar ferramentas basicas

```bash
sudo apt install -y curl ca-certificates gnupg git
```

### 3. Instalar Node.js e npm

Instale Node.js 20 LTS:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

Confirme:

```bash
node -v
npm -v
```

O Node precisa ser versao 20 ou superior.

### 4. Instalar Docker e Docker Compose

```bash
curl -fsSL https://get.docker.com | sudo sh
```

Adicione seu usuario ao grupo Docker:

```bash
sudo usermod -aG docker $USER
```

Depois faca logout/login ou reinicie o computador.

Confirme:

```bash
docker --version
docker compose version
```

Se `docker compose up -d` retornar `permission denied`, o usuario ainda nao esta com permissao no Docker. Reinicie a sessao ou rode temporariamente:

```bash
sudo docker compose up -d
```

## Windows

### 1. Instalar Git, Node.js, npm e Docker Desktop

Abra o PowerShell como administrador e rode:

```powershell
winget install Git.Git
winget install OpenJS.NodeJS.LTS
winget install Docker.DockerDesktop
```

Depois:

1. Abra o Docker Desktop.
2. Aguarde o Docker ficar ativo.
3. Feche e abra o terminal novamente.

Confirme:

```powershell
node -v
npm -v
docker --version
docker compose version
```

Se preferir instalar manualmente:

- Node.js: https://nodejs.org/
- Docker Desktop: https://www.docker.com/products/docker-desktop/
- Git: https://git-scm.com/

## Outras Distribuicoes Linux

Instale pelos pacotes oficiais da sua distribuicao:

- Node.js 20 ou superior
- npm
- Docker
- Docker Compose
- git

Depois confirme:

```bash
node -v
npm -v
docker --version
docker compose version
```

## Rodar O Projeto

Resumo dos dois comandos principais:

```txt
npm run setup = prepara o banco e baixa os dados reais
npm run dev   = abre o backend e o frontend para usar o sistema
```

Na primeira instalacao, rode primeiro `npm run setup` e depois `npm run dev`.

### 1. Abrir a pasta do projeto

Entre na pasta raiz do repositorio:

```bash
cd Pet-Saude-Epidemiologia
```

### 2. Instalar dependencias do projeto

```bash
npm install
```

Esse comando instala as dependencias do backend e do frontend.

### 3. Criar o arquivo `.env`

Na raiz do projeto:

```bash
cp .env.example .env
```

No Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Abra o arquivo `.env` e confira:

```env
PORT=3001
CORS_ORIGIN=http://localhost:3000
ADMIN_TOKEN=troque-este-token

DATABASE_URL=postgresql://painel:painel_dev@localhost:5433/painel_parnaiba?schema=public
REDIS_URL=redis://localhost:6379

NEXT_PUBLIC_API_URL=http://localhost:3001

SYNC_SCHEDULE_ENABLED=true
SYNC_SCHEDULE_INTERVAL_DAYS=30
SYNC_SCHEDULE_CHECK_INTERVAL_MINUTES=1440
SYNC_SCHEDULE_STARTUP_DELAY_SECONDS=30
```

Troque `ADMIN_TOKEN` por um valor pessoal. Esse token e usado nas rotas administrativas.

As variaveis `SYNC_SCHEDULE_*` controlam a atualizacao automatica. Com os valores acima, o backend checa uma vez por dia e sincroniza fontes que estejam ha 30 dias ou mais sem uma coleta bem-sucedida.

### 4. Preparar banco e baixar os dados

Rode:

```bash
npm run setup
```

Esse comando executa, em sequencia:

```txt
docker compose up -d
prisma generate
prisma migrate deploy
prisma db seed
sync das fontes DATASUS/TABNET
```

Ao final, o banco local fica com os dados das fontes ativas.

Resultado esperado:

```txt
Setup concluido. Rode npm run dev para abrir o sistema.
```

### 5. Abrir backend e frontend

```bash
npm run dev
```

Esse comando sobe:

```txt
Backend:  http://localhost:3001
Frontend: http://localhost:3000
```

Abra no navegador:

```txt
http://localhost:3000
http://localhost:3000/tuberculose
http://localhost:3000/hanseniase
http://localhost:3000/sifilis
http://localhost:3000/admin
```

## Validar Se Funcionou

Com o `npm run dev` rodando, teste:

```bash
curl http://localhost:3001/health
curl http://localhost:3001/api/sources
```

No navegador:

```txt
http://localhost:3000
```

A API de fontes deve retornar `total: 3`.

## Comandos Uteis

### Setup completo

```bash
npm run setup
```

Use na primeira instalacao ou quando quiser preparar banco e sincronizar dados.

### Desenvolvimento

```bash
npm run dev
```

Subir backend e frontend juntos.

```bash
npm run dev:backend
npm run dev:frontend
```

Subir cada parte separadamente.

### Producao local em segundo plano

```bash
npm run prod:start
```

Faz build do backend e do frontend, depois sobe os dois em segundo plano.

```bash
npm run prod:status
npm run prod:restart
npm run prod:stop
```

Os PIDs ficam em `.runtime/pids/` e os logs ficam em `.runtime/logs/`.

### Sincronizar dados

```bash
npm run sync:data
```

Sincroniza todas as fontes ativas.

```bash
npm run sync:tuberculose
npm run sync:hanseniase
npm run sync:sifilis
```

Sincroniza uma fonte especifica.

O backend tambem possui sincronizacao automatica mensal. Para desativar:

```env
SYNC_SCHEDULE_ENABLED=false
```

### Prisma

```bash
npm run prisma:generate
npm run prisma:migrate
npm run prisma:deploy
npm run prisma:seed
```

### Build

```bash
npm run build:backend
npm run build:frontend
```

### Testes

```bash
npm run test:backend
```

### Prisma Studio

```bash
npm --workspace backend run prisma:studio
```

## URLs Locais

```txt
Frontend:     http://localhost:3000
Backend:      http://localhost:3001
Health check: http://localhost:3001/health
PostgreSQL:   localhost:5433
Redis:        localhost:6379
Admin:        http://localhost:3000/admin
```

## Rotas Principais Da API

```txt
GET  /health
GET  /api/sources
GET  /api/sources/:slug
GET  /api/sources/:slug/summary
GET  /api/sources/:slug/filters
GET  /api/dashboard/overview
GET  /api/records
GET  /api/charts/yearly-evolution?source=tuberculose_sinan
GET  /api/charts/by-sex?source=tuberculose_sinan
GET  /api/charts/by-age-group?source=tuberculose_sinan
GET  /api/charts/by-race-color?source=tuberculose_sinan
POST /api/admin/sync/:sourceSlug
POST /api/admin/sync-all
GET  /api/admin/records/export.csv
GET  /api/admin/sync-history
```

Rotas administrativas exigem:

```txt
Authorization: Bearer <ADMIN_TOKEN>
```

A pagina `http://localhost:3000/admin` usa o mesmo `ADMIN_TOKEN` para carregar historico, disparar sincronizacoes e exportar CSV.

## Regras Fixas

- O municipio e fixo: Parnaiba - PI.
- O codigo IBGE e fixo: `2207702`.
- A API publica bloqueia filtros para outro municipio.
- O frontend nao permite trocar municipio.
- O painel le dados do banco local, nao consulta DATASUS/TABNET a cada acesso.

## Solucao De Problemas

### Docker retorna `permission denied`

No Linux, adicione o usuario ao grupo Docker:

```bash
sudo usermod -aG docker $USER
```

Depois faca logout/login ou reinicie o computador.

Para testar imediatamente:

```bash
sudo docker compose up -d
```

Depois rode:

```bash
npm run setup
```

### Banco nao conecta

Confirme se os containers estao ativos:

```bash
docker compose ps
```

Se nao estiverem:

```bash
docker compose up -d
```

Confira se a URL do banco no `.env` esta assim:

```txt
postgresql://painel:painel_dev@localhost:5433/painel_parnaiba?schema=public
```

### Prisma reclama de `DATABASE_URL`

Confirme se o arquivo `.env` existe na raiz do projeto:

```bash
ls -la .env
```

Se nao existir:

```bash
cp .env.example .env
```

### Frontend nao encontra a API

Confirme se o backend responde:

```bash
curl http://localhost:3001/health
```

Confirme no `.env`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

Depois reinicie:

```bash
npm run dev
```

### Dados nao aparecem

Rode a sincronizacao:

```bash
npm run sync:data
```

Depois atualize a pagina no navegador.

### Rotas administrativas retornam `401`

Confira se o header enviado e igual ao `ADMIN_TOKEN` do `.env`:

```txt
Authorization: Bearer <ADMIN_TOKEN>
```

## Observacao Sobre DATASUS/TABNET

O DATASUS/TABNET e usado como fonte de atualizacao. O painel nao depende dele durante a navegacao normal.

Se o DATASUS estiver fora do ar, o sistema continua exibindo a ultima coleta salva no banco local. A sincronizacao pode ser tentada novamente depois.
