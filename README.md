# Painel Epidemiologico de Parnaiba - PI

Sistema web para consulta, visualizacao e exportacao de dados publicos do DATASUS/TABNET, filtrados para o municipio de Parnaiba - PI.

O projeto funciona assim:

1. O backend coleta os dados publicos nas fontes oficiais.
2. Os dados sao gravados em um banco PostgreSQL local.
3. O frontend consome esse banco local para exibir indicadores, tabelas e graficos.

Isso significa que abrir o painel sem sincronizar os dados antes pode mostrar o sistema vazio.

## Objetivo Deste README

Este guia foi reestruturado para ajudar colaboradores a:

1. Preparar a maquina corretamente.
2. Configurar o projeto sem pular etapas.
3. Subir o sistema pela primeira vez.
4. Validar se tudo realmente funcionou.
5. Resolver os erros mais comuns.

Se a pessoa seguir a ordem abaixo, a chance de erro cai bastante.

## O Que O Sistema Faz

- Coleta dados publicos do DATASUS/TABNET.
- Filtra os dados para Parnaiba - PI.
- Armazena importacoes brutas para auditoria.
- Normaliza registros em PostgreSQL.
- Exibe dashboards, graficos, filtros e tabela paginada.
- Permite exportacao de registros em CSV.

### Fontes publicas ativas hoje

Essas fontes aparecem para consulta no sistema:

```txt
tuberculose_sinan
hanseniase_sinan
sifilis_congenita_sinan
dengue_sinan
arboviroses_sinan
```

### Fontes sincronizadas hoje pelo backend

Essas fontes sao efetivamente coletadas quando voce roda `npm run sync:data`:

```txt
tuberculose_sinan
hanseniase_sinan
sifilis_congenita_sinan
dengue_sinan
zika_sinan
```

Observacao:

- `arboviroses_sinan` e uma fonte derivada, composta por `dengue_sinan` e `zika_sinan`.
- `sifilis_gestacional_sinan` existe no codigo, mas hoje esta inativa e nao entra na sincronizacao.

## Stack Do Projeto

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
- Docker com Docker Compose

## Estrutura Do Repositorio

```txt
backend/              API Express, Prisma e coletores DATASUS/TABNET
frontend/             Interface Next.js
docs/                 Documentacao complementar
scripts/              Scripts oficiais de operacao
docker-compose.yml    Definicao dos servicos
.env.example          Modelo de configuracao local
```

## Antes De Comecar

### Ambiente recomendado

O fluxo oficial deste projeto foi pensado para Linux.

Se voce estiver em Windows, o recomendado e usar uma destas opcoes:

1. WSL2 com Ubuntu.
2. Uma maquina Linux.

Motivo:

- Os comandos principais do projeto usam scripts `bash`.
- O script `npm run doctor` depende do comando `ss`.
- O uso via Windows nativo pode falhar mesmo com Node e Docker instalados.

Se o colaborador usa Windows e quer evitar problemas, a melhor decisao e rodar tudo no WSL2.

### Programas obrigatorios

Instale antes de clonar o projeto:

1. `git`
2. `node` na versao 20 ou superior
3. `npm`
4. `docker`
5. `docker compose`

### Conferencia rapida

Depois da instalacao, confirme:

```bash
git --version
node -v
npm -v
docker --version
docker compose version
```

## Instalacao Do Ambiente

### Linux Ubuntu ou Debian

#### 1. Atualizar o sistema

```bash
sudo apt update
sudo apt upgrade -y
```

#### 2. Instalar utilitarios basicos

```bash
sudo apt install -y curl ca-certificates gnupg git
```

#### 3. Instalar Node.js 20 LTS

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

Validar:

```bash
node -v
npm -v
```

#### 4. Instalar Docker

Use Docker Engine oficial. Nao use Docker instalado via Snap para este projeto.

```bash
curl -fsSL https://get.docker.com | sudo sh
```

#### 5. Permitir uso do Docker sem `sudo`

```bash
sudo usermod -aG docker "$USER"
```

Agora faca logout e login novamente, ou reinicie a maquina.

Validar:

```bash
docker info
docker compose version
```

Se `docker info` falhar com `permission denied`, o usuario ainda nao recebeu a permissao corretamente.

Conferencia importante:

```bash
docker info --format '{{.DockerRootDir}}'
```

O resultado esperado com Docker oficial e:

```txt
/var/lib/docker
```

Se aparecer algo dentro de `/var/snap/docker`, a maquina esta usando Docker via Snap. Remova o Snap e instale o Docker oficial:

```bash
sudo snap remove --purge docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"
```

Depois faca logout/login ou reinicie a maquina.

### Windows

Para Windows, use WSL2 com Ubuntu e execute o projeto dentro do ambiente Linux.

Resumo do caminho recomendado:

1. Instalar WSL2.
2. Instalar Ubuntu no WSL.
3. Instalar Docker Desktop com integracao ao WSL habilitada.
4. Abrir o projeto dentro do Ubuntu.
5. Seguir o restante deste README como se estivesse em Linux.

## Clonar O Projeto

```bash
git clone <URL_DO_REPOSITORIO>
cd Pet_Saude
```

## Passo A Passo Para Rodar Pela Primeira Vez

Esta e a sequencia correta para um colaborador novo.

### 1. Instalar as dependencias do monorepo

Na raiz do projeto:

```bash
npm install
```

Esse comando instala as dependencias do projeto raiz, do backend e do frontend.

### 2. Criar o arquivo de ambiente

```bash
cp .env.example .env
```

### 3. Editar o `.env`

Os campos minimos que precisam de atencao sao:

```env
APP_BIND_HOST=0.0.0.0
SERVICE_BIND_HOST=127.0.0.1

FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:3333
NEXT_PUBLIC_API_URL=http://localhost:3333
CORS_ORIGIN=http://localhost:3000

ADMIN_PASSWORD=sua-senha-aqui
ADMIN_SESSION_SECRET=um-segredo-longo-e-dificil

POSTGRES_PORT=5433
```

### 4. Entender o que cada grupo de variaveis faz

#### URLs da aplicacao

- `FRONTEND_URL`: endereco em que o frontend sera acessado.
- `BACKEND_URL`: endereco da API.
- `NEXT_PUBLIC_API_URL`: URL que o frontend usa para chamar o backend.
- `CORS_ORIGIN`: origem autorizada a acessar a API.

Para testes locais, mantenha:

```env
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:3333
NEXT_PUBLIC_API_URL=http://localhost:3333
CORS_ORIGIN=http://localhost:3000
```

#### Credenciais administrativas

- `ADMIN_PASSWORD`: senha de acesso da area administrativa.
- `ADMIN_SESSION_SECRET`: segredo da sessao do admin.

Nao deixe os placeholders abaixo:

```env
ADMIN_PASSWORD=troque-esta-senha
ADMIN_SESSION_SECRET=troque-este-segredo-de-sessao
```

O script `npm run start` bloqueia a inicializacao se esses placeholders continuarem no arquivo.

#### Portas

Padrao recomendado para maquina local:

```env
FRONTEND_PORT=3000
BACKEND_PORT=3333
POSTGRES_PORT=5433
REDIS_PORT=6379
```

O PostgreSQL usa `5433` no host para evitar conflito com instalacoes locais que ja usam `5432`.

#### Credenciais do banco

Os valores padrao sao:

```env
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=pet_saude
```

Importante:

- Se voce mudar `POSTGRES_USER`, `POSTGRES_PASSWORD` ou `POSTGRES_DB` depois que o volume do banco ja foi criado, pode quebrar a subida do projeto.
- Se isso acontecer, normalmente o conserto e resetar os volumes com `npm run db:reset -- --force`.

### 5. Executar o diagnostico antes de subir

```bash
npm run doctor
```

Esse comando verifica:

- se Docker e Docker Compose estao acessiveis;
- se o `.env` existe;
- se as variaveis obrigatorias foram preenchidas;
- se as portas necessarias estao livres;
- se o banco e o Redis respondem corretamente quando ja existem containers rodando.

Se o `doctor` acusar erro, corrija antes de seguir.

### 6. Subir o sistema

```bash
npm run start
```

Esse comando faz o fluxo oficial completo:

1. sobe PostgreSQL e Redis;
2. valida a conexao com o banco;
3. builda backend e frontend;
4. aplica as migrations do Prisma;
5. executa o seed inicial;
6. sobe backend e frontend.

Nao e necessario rodar `docker compose up` manualmente no dia a dia.

### 7. Conferir se a aplicacao abriu

Acesse:

```txt
Frontend: http://localhost:3000
Admin:    http://localhost:3000/admin
Backend:  http://localhost:3333
Health:   http://localhost:3333/health
```

### 8. Sincronizar os dados

Depois que backend e frontend estiverem rodando:

```bash
npm run sync:data
```

Sem esse passo, o painel pode abrir sem dados.

Na pratica, a sincronizacao atual percorre estas fontes:

```txt
tuberculose_sinan
hanseniase_sinan
sifilis_congenita_sinan
dengue_sinan
zika_sinan
```

### 9. Validar a sincronizacao

Use pelo menos estes testes:

```bash
curl http://localhost:3333/health
curl http://localhost:3333/api/sources
```

Se essas rotas responderem e o painel carregar no navegador, o ambiente esta funcional para testes.

## Fluxo Diario Para Colaboradores

Depois da primeira configuracao, o uso mais comum passa a ser:

### Subir o sistema

```bash
npm run start
```

### Ver logs

```bash
npm run logs
```

### Parar tudo

```bash
npm run stop
```

### Reiniciar

```bash
npm run restart
```

### Sincronizar dados novamente

```bash
npm run sync:data
```

## Comandos Oficiais Do Projeto

Sempre prefira estes scripts:

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

Se o objetivo for desenvolvimento local de codigo, existem estes comandos:

```bash
npm run dev
npm run test:backend
```

Observacao:

- `npm run start` e o fluxo principal para ambiente de teste e demonstracao.
- `npm run dev` e um fluxo separado para programacao.

## Solucao De Problemas

### Erro 1: Docker sem permissao para o usuario

Sintomas comuns:

- `permission denied`
- `Cannot connect to the Docker daemon`
- `docker info` falha

Correcao:

```bash
sudo usermod -aG docker "$USER"
```

Depois encerre a sessao e entre novamente.

### Erro 2: Placeholders ainda no `.env`

Se o `start` recusar subir, confira se ainda existem estas linhas:

```env
ADMIN_PASSWORD=troque-esta-senha
ADMIN_SESSION_SECRET=troque-este-segredo-de-sessao
```

Troque por valores reais.

### Erro 3: Porta ja esta em uso

Se `doctor` ou `start` informarem conflito de porta, verifique principalmente:

- `3000` para frontend
- `3333` para backend
- `5433` para PostgreSQL
- `6379` para Redis

Ajuste o `.env` se necessario.

### Erro 4: Banco nao aceita usuario ou senha configurados

Isso normalmente acontece quando o volume do PostgreSQL foi criado com credenciais antigas.

Se puder apagar os dados locais do projeto:

```bash
npm run db:reset -- --force
npm run start
```

Esse reset remove os volumes Docker do PostgreSQL e do Redis deste projeto.

### Erro 5: Docker travou e nao para containers

Se aparecer algo como:

- `cannot stop container`
- `permission denied`
- container preso sem encerrar

Primeiro confirme se a maquina esta usando Docker oficial:

```bash
docker info --format '{{.DockerRootDir}}'
```

Se retornar `/var/snap/docker/...`, o problema provavelmente vem do Docker via Snap. Migre para Docker oficial seguindo a secao de instalacao acima.

Se retornar `/var/lib/docker`, use:

```bash
npm run docker:recover
npm run doctor
npm run start
```

Se tambem precisar recriar banco e Redis:

```bash
npm run docker:recover -- --reset-db
npm run start
```

Use `--reset-db` somente quando puder apagar os dados locais.

### Erro 6: Painel abre, mas sem informacoes

Nesse caso, normalmente o sistema subiu, mas ainda nao houve sincronizacao.

Rode:

```bash
npm run sync:data
```

## Executar Em Servidor

O mesmo fluxo funciona em servidor Linux. O que muda e o `.env`.

Troque `localhost` pelo IP ou dominio real:

```env
FRONTEND_URL=http://SEU_IP_OU_DOMINIO:3000
BACKEND_URL=http://SEU_IP_OU_DOMINIO:3333
NEXT_PUBLIC_API_URL=http://SEU_IP_OU_DOMINIO:3333
CORS_ORIGIN=http://SEU_IP_OU_DOMINIO:3000
APP_BIND_HOST=0.0.0.0
```

Em servidor, exponha apenas:

- porta `3000`
- porta `3333`

PostgreSQL e Redis devem continuar restritos ao host local, o que ja e o comportamento padrao do projeto.

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

As rotas administrativas exigem autenticacao em `/admin` com a senha definida em `ADMIN_PASSWORD`.

## Regras Fixas Do Projeto

- O municipio alvo e fixo: Parnaiba - PI.
- O codigo IBGE e fixo: `2207702`.
- A API publica bloqueia filtros para outro municipio.
- O frontend nao permite troca de municipio.
