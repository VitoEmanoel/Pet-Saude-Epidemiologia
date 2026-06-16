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
scripts/              Scripts oficiais de operacao
docker-compose.yml    Servicos Docker do sistema
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

Se `docker compose up -d` retornar `permission denied`, o usuario ainda nao esta com permissao no Docker. Reinicie a sessao antes de continuar.

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

## Rodar O Sistema

Use um unico fluxo para localhost, servidor Linux ou Oracle Cloud. O que muda entre os ambientes e somente o `.env`.

### Regras

- Use os comandos `npm run ...`; nao opere este projeto com `docker compose` manual no dia a dia.
- Nao misture `docker ...` com `sudo docker ...`. O Docker deve funcionar para seu usuario sem `sudo`.
- Use `npm run docker:recover` somente quando o daemon Docker travar e se recusar a parar containers.
- Nao altere `POSTGRES_USER`, `POSTGRES_PASSWORD` ou `POSTGRES_DB` depois do banco criado sem resetar os volumes do projeto.
- PostgreSQL e Redis ficam presos em `127.0.0.1` por padrao; apenas frontend e backend ficam expostos.

### Configurar

```bash
cp .env.example .env
```

Para rodar na sua maquina:

```env
APP_BIND_HOST=0.0.0.0
SERVICE_BIND_HOST=127.0.0.1
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:3333
NEXT_PUBLIC_API_URL=http://localhost:3333
CORS_ORIGIN=http://localhost:3000
ADMIN_PASSWORD=sua-senha
ADMIN_SESSION_SECRET=seu-segredo-longo
POSTGRES_PORT=5433
```

Para servidor, troque `localhost` pelo IP ou dominio publico:

```env
FRONTEND_URL=http://SEU_IP_OU_DOMINIO:3000
BACKEND_URL=http://SEU_IP_OU_DOMINIO:3333
NEXT_PUBLIC_API_URL=http://SEU_IP_OU_DOMINIO:3333
CORS_ORIGIN=http://SEU_IP_OU_DOMINIO:3000
```

Em servidor ou Oracle Cloud, libere externamente apenas as portas `3000` e `3333`.

### Iniciar

Rode sempre nesta ordem:

```bash
npm run doctor
npm run start
```

Enderecos padrao:

```txt
Frontend: http://localhost:3000
Backend:  http://localhost:3333
Admin:    http://localhost:3000/admin
Health:   http://localhost:3333/health
```

### Buscar Dados Datasus/Tabnet

Com o sistema rodando:

```bash
npm run sync:data
```

Fontes sincronizadas atualmente:

```txt
tuberculose_sinan
hanseniase_sinan
sifilis_congenita_sinan
```

O backend tambem pode sincronizar automaticamente conforme as variaveis `SYNC_SCHEDULE_*` do `.env`.

### Parar E Ver Logs

```bash
npm run stop
npm run logs
```

Para reiniciar:

```bash
npm run restart
```

### Recuperar Docker Travado

Se aparecer `cannot stop container`, `permission denied` ou o container se recusar a fechar:

```bash
npm run docker:recover
npm run doctor
npm run start
```

Se o problema tambem exigir recriar o banco local deste projeto:

```bash
npm run docker:recover -- --reset-db
npm run start
```

Use `--reset-db` apenas quando puder apagar e recriar os dados locais do PostgreSQL e Redis deste projeto.

### Resetar Banco Local

Quando `start` ou `doctor` indicarem credenciais antigas no volume do PostgreSQL:

```bash
npm run db:reset -- --force
npm run start
```

Esse comando remove os volumes Docker do banco e do Redis deste projeto.

### Validar

```bash
curl http://localhost:3333/health
curl http://localhost:3333/api/sources
```

O painel le dados do banco local. Se o DATASUS/TABNET estiver fora do ar, a navegacao continua usando a ultima coleta salva.

## Comandos Oficiais

```bash
npm run doctor
npm run start
npm run sync:data
npm run stop
npm run restart
npm run logs
npm run db:reset -- --force
npm run docker:recover
```

## Desenvolvimento

Use somente para programar fora do fluxo Docker principal:

```bash
npm install
npm run dev
npm run test:backend
```

## API

Rotas principais:

```txt
GET  /health
GET  /api/sources
GET  /api/dashboard/overview
GET  /api/records
GET  /api/charts/yearly-evolution?source=tuberculose_sinan
POST /api/admin/sync/:sourceSlug
POST /api/admin/sync-all
GET  /api/admin/records/export.csv
GET  /api/admin/sync-history
```

Rotas administrativas exigem login em `/admin` com `ADMIN_PASSWORD`.

## Regras Fixas

- O municipio e fixo: Parnaiba - PI.
- O codigo IBGE e fixo: `2207702`.
- A API publica bloqueia filtros para outro municipio.
- O frontend nao permite trocar municipio.
