# Painel Epidemiologico de Parnaiba - PI

Sistema para visualizacao de dados publicos do DATASUS/TABNET restritos ao municipio de Parnaiba - PI, na categoria de dados epidemiologicos e morbidade.

## Visao geral

O projeto esta organizado como um monorepo com:

- `backend/`: API em Express com TypeScript, Prisma e PostgreSQL.
- `frontend/`: interface em Next.js.
- `docker-compose.yml`: servicos locais de apoio com PostgreSQL e Redis.

O sistema foi desenhado para aceitar somente:

- Municipio: Parnaiba
- UF: PI
- Codigo IBGE: 2207702
- Categoria DATASUS: `epidemiologicas_morbidade`

### Regras fixas do projeto

- O frontend nao deve permitir selecionar outro municipio.
- A API publica tambem bloqueia consultas para outros municipios.
- A area administrativa exige `ADMIN_TOKEN`.

## O que precisa instalar

Para rodar o sistema em qualquer computador, voce precisa ter instalado:

1. **Node.js 20 ou superior**
2. **npm**
3. **Docker**
4. **Docker Compose**
5. Um editor de codigo, como **VS Code**

O Node.js instala o `npm` junto na maioria dos casos. O Docker e o Docker Compose sao usados para subir o banco de dados PostgreSQL e o Redis.

## Guia de instalacao

### Linux

Se voce usa Linux, o caminho mais simples e instalar via terminal.

#### Ubuntu e Debian

Atualize o sistema:

```bash
sudo apt update
sudo apt upgrade -y
```

Instale ferramentas basicas:

```bash
sudo apt install -y curl ca-certificates gnupg
```

Instale o Node.js 20:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

Confirme a instalacao:

```bash
node -v
npm -v
```

Instale o Docker:

```bash
curl -fsSL https://get.docker.com | sudo sh
```

Adicione seu usuario ao grupo do Docker:

```bash
sudo usermod -aG docker $USER
```

Depois disso, faca logout e login novamente, ou reinicie o computador.

Confirme o Docker e o Compose:

```bash
docker --version
docker compose version
```

#### Outras distribuicoes Linux

Se voce usa Fedora, Arch, Manjaro, openSUSE ou outra distribuicao, instale:

- Node.js 20 ou superior pelo gerenciador de pacotes da distro ou pelo site oficial do Node.js.
- Docker pelo repositório oficial da propria distribuicao ou pelo site do Docker.
- Docker Compose como plugin do Docker ou pelo pacote oficial da distro.

Depois confirme:

```bash
node -v
npm -v
docker --version
docker compose version
```

### Windows

No Windows, a forma mais simples e usar o **PowerShell como administrador**.

#### Instalar com `winget`

Se voce tiver o `winget`, rode:

```powershell
winget install OpenJS.NodeJS.LTS
winget install Docker.DockerDesktop
```

Depois feche e abra o terminal de novo.

Confirme a instalacao:

```powershell
node -v
npm -v
docker --version
docker compose version
```

#### Instalar manualmente

Se preferir, faca o download oficial:

- Node.js: https://nodejs.org/
- Docker Desktop: https://www.docker.com/products/docker-desktop/

Depois da instalacao:

1. Abra o Docker Desktop e espere ele iniciar.
2. Verifique se o Docker esta ativo no tray do Windows.
3. Abra o PowerShell ou o Prompt de Comando e confira:

```powershell
node -v
npm -v
docker --version
docker compose version
```

### Observacoes importantes

- O projeto usa o `docker compose` para subir PostgreSQL e Redis.
- Sem Docker, voce teria que instalar e configurar esses dois servicos manualmente.
- Se o comando `docker` nao funcionar no Linux, normalmente e necessario abrir uma nova sessao depois de adicionar o usuario ao grupo do Docker.

## Estrutura do projeto

```txt
backend/
  prisma/
  src/
frontend/
  src/
docker-compose.yml
.env.example
README.md
```

## Configuracao passo a passo

### 1. Obter o codigo

Abra a pasta do projeto no seu computador.

### 2. Instalar as dependencias

Na raiz do projeto, execute:

```bash
npm install
```

Esse comando instala as dependencias do backend e do frontend usando os workspaces do monorepo.

### 3. Criar o arquivo de ambiente

Crie o arquivo `.env` na raiz do projeto a partir do modelo:

```bash
cp .env.example .env
```

Depois revise os valores principais:

```env
PORT=3001
CORS_ORIGIN=http://localhost:3000
ADMIN_TOKEN=troque-este-token

DATABASE_URL=postgresql://painel:painel_dev@localhost:5433/painel_parnaiba?schema=public
REDIS_URL=redis://localhost:6379

NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 4. Ajustar o token administrativo

Troque `ADMIN_TOKEN` por um valor forte e pessoal.

Esse token sera usado nas rotas administrativas com o header:

```txt
Authorization: Bearer <ADMIN_TOKEN>
```

### 5. Subir PostgreSQL e Redis

Inicie os servicos de apoio:

```bash
docker compose up -d
```

Isso sobe:

- PostgreSQL em `localhost:5433`
- Redis em `localhost:6379`

### 6. Preparar o banco de dados

Gere o Prisma Client:

```bash
npm run prisma:generate
```

Aplique a migracao inicial:

```bash
npm run prisma:migrate
```

Carregue os dados iniciais das fontes permitidas:

```bash
npm run prisma:seed
```

### 7. Iniciar o backend

Abra outro terminal e execute:

```bash
npm run dev:backend
```

O backend sobe, por padrao, em:

```txt
http://localhost:3001
```

### 8. Iniciar o frontend

Em outro terminal, execute:

```bash
npm run dev:frontend
```

O frontend sobe, por padrao, em:

```txt
http://localhost:3000
```

## Como validar se esta funcionando

Depois de subir tudo, confirme estes pontos:

1. O PostgreSQL esta no ar no `localhost:5433`.
2. O backend responde em `http://localhost:3001/health`.
3. O frontend abre em `http://localhost:3000`.
4. A pagina da fonte piloto abre em `http://localhost:3000/tuberculose`.

## URLs locais

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:3001`
- Health check: `http://localhost:3001/health`
- PostgreSQL: `localhost:5433`
- Redis: `localhost:6379`

## Rotas iniciais da API

```txt
GET  /health
GET  /api/sources
GET  /api/sources/:slug
GET  /api/sources/:slug/availability
GET  /api/sources/:slug/summary
GET  /api/sources/:slug/filters
GET  /api/dashboard/overview
GET  /api/records
GET  /api/records/export.csv
GET  /api/charts/yearly-evolution?source=tuberculose_sinan
GET  /api/charts/by-sex?source=tuberculose_sinan
GET  /api/charts/by-age-group?source=tuberculose_sinan
GET  /api/charts/by-race-color?source=tuberculose_sinan
POST /api/admin/sync/:sourceSlug
POST /api/admin/sync-all
GET  /api/admin/sync-history
```

As rotas administrativas exigem:

```txt
Authorization: Bearer <ADMIN_TOKEN>
```

## Comandos uteis

### Desenvolvimento

```bash
npm run dev:backend
npm run dev:frontend
```

### Prisma

```bash
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

### Build

```bash
npm run build:backend
npm run build:frontend
```

### Testes do backend

```bash
npm run test:backend
```

### Banco no modo visual

```bash
npm run prisma:studio
```

## Fase atual do projeto

O projeto esta na fase de fundacao tecnica. Nesta etapa ja existem:

- backend Express com TypeScript;
- lista fixa de fontes permitidas;
- rotas iniciais de fontes, dashboard, registros, graficos e administracao;
- bloqueio de parametros de municipio em `GET /api/records`;
- area administrativa protegida por `ADMIN_TOKEN`;
- schema Prisma para PostgreSQL;
- seed Prisma das fontes permitidas;
- Docker Compose com PostgreSQL e Redis;
- frontend Next.js inicial.

A coleta real do DATASUS/TABNET ainda nao foi implementada. Ela comeca na fase seguinte, com validacao tecnica fonte por fonte.

## Fonte piloto

A fonte piloto definida no projeto e:

```txt
tuberculose_sinan
```

Ela serve como base para a evolucao do frontend com dados reais, graficos, tabela paginada, filtros e exportacao CSV.

## Solucao de problemas

### Banco nao conecta

Confirme se o Docker esta ativo e rode novamente:

```bash
docker compose up -d
```

### Prisma reclama de `DATABASE_URL`

Verifique se o arquivo `.env` existe na raiz do projeto e se a URL aponta para:

```txt
postgresql://painel:painel_dev@localhost:5433/painel_parnaiba?schema=public
```

### Frontend nao encontra a API

Confirme se o backend esta rodando em `http://localhost:3001` e se `NEXT_PUBLIC_API_URL` esta apontando para essa URL no `.env`.

### Rotas administrativas retornam `401`

Confira se o valor enviado no header `Authorization` e igual ao `ADMIN_TOKEN` definido no `.env`.

## Observacao tecnica

O backend carrega variaveis de ambiente primeiro de `../.env` e depois de `.env` dentro do proprio pacote. Na pratica, o arquivo correto para esse projeto e o `.env` na raiz do repositorio.
