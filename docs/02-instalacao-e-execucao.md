# 2. Instalação e execução

Este guia leva uma máquina "zerada" até o sistema funcionando com dados. Siga na ordem.

## 2.1 Pré-requisitos

O fluxo oficial foi feito para **Linux**. No Windows, use **WSL2 com Ubuntu** e siga tudo dentro do Ubuntu (os scripts são `bash` e o `doctor` usa o comando `ss`).

| Programa | Versão | Como conferir |
|---|---|---|
| git | qualquer | `git --version` |
| Node.js | **20 ou superior** | `node -v` |
| npm | o que vem com o Node | `npm -v` |
| Docker Engine (oficial, **não** Snap) | recente | `docker --version` |
| Docker Compose (plugin) | v2+ | `docker compose version` |

### Instalação no Ubuntu/Debian

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl ca-certificates gnupg git

# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Docker oficial
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"   # depois faça logout/login (ou reinicie)
```

Confira se o Docker é o oficial:

```bash
docker info --format '{{.DockerRootDir}}'
# esperado: /var/lib/docker
# se aparecer /var/snap/docker → é Docker via Snap; remova e instale o oficial:
#   sudo snap remove --purge docker && curl -fsSL https://get.docker.com | sudo sh
```

### Windows

1. Instale o WSL2 e o Ubuntu.
2. Instale o Docker Desktop com a integração WSL ativada.
3. Clone e rode o projeto **dentro do Ubuntu**, seguindo este guia como se fosse Linux.

## 2.2 Primeira execução (modo oficial, com Docker)

```bash
git clone <URL_DO_REPOSITORIO>
cd Pet-Saude-Epidemiologia

npm install                 # dependências da raiz, backend e frontend
cp .env.example .env        # cria a configuração local
```

Edite o `.env` e **troque obrigatoriamente**:

```env
ADMIN_PASSWORD=<uma senha forte>
ADMIN_SESSION_SECRET=<texto longo e aleatório>
```

Dica para gerar valores:

```bash
openssl rand -base64 18   # senha
openssl rand -hex 32      # segredo de sessão
```

O `npm run start` se recusa a subir se os textos `troque-esta-senha` / `troque-este-segredo-de-sessao` continuarem no arquivo.

Depois:

```bash
npm run doctor      # diagnóstico: Docker, .env, portas livres
npm run start       # sobe tudo (veja abaixo o que ele faz)
npm run sync:data   # baixa os dados do DATASUS (~1 minuto)
```

O `npm run start` executa, nesta ordem:

1. valida Docker, variáveis obrigatórias e portas;
2. sobe PostgreSQL e Redis;
3. espera o PostgreSQL aceitar conexões;
4. faz o build das imagens do backend e do frontend;
5. aplica as migrations (`prisma migrate deploy`);
6. roda o seed (cadastra as fontes permitidas);
7. sobe backend e frontend;
8. se `RUN_INITIAL_SYNC=true`, já sincroniza os dados.

### Conferir se funcionou

| O quê | Endereço |
|---|---|
| Site | http://localhost:3000 |
| Área administrativa | http://localhost:3000/admin (usuário `ADMIN_USERNAME`, padrão `admin`) |
| API | http://localhost:3333 |
| Saúde da API | http://localhost:3333/health |

```bash
curl http://localhost:3333/health
curl http://localhost:3333/api/dashboard/overview
```

Se o site abrir **sem números**, falta rodar `npm run sync:data`.

## 2.3 Comandos do dia a dia

| Comando | O que faz |
|---|---|
| `npm run doctor` | Diagnóstico do ambiente (não altera nada) |
| `npm run start` | Sobe/rebuilda tudo pelo fluxo oficial |
| `npm run stop` | Para os containers (mantém os dados) |
| `npm run restart` | `stop` + `start` |
| `npm run logs` | Mostra os logs de todos os containers (`npm run logs -- backend` para um só) |
| `npm run sync:data` | Sincroniza todas as fontes (precisa do backend rodando no Docker) |
| `npm run sync:data -- <slug>` | Sincroniza uma fonte só (ex.: `npm run sync:data -- dengue_sinan`) |
| `npm run db:reset -- --force` | **Apaga** os volumes do PostgreSQL e Redis |
| `npm run docker:recover` | Tenta destravar o Docker sem apagar dados (`-- --reset-db` também apaga o banco) |

## 2.4 Modo desenvolvimento (sem Docker para o código)

Use quando for **programar**: o backend e o frontend recarregam sozinhos ao salvar arquivos.

1. Suba só o banco:

   ```bash
   docker compose --env-file .env up -d postgres
   ```

2. Crie `backend/.env` (ele **sobrescreve** o `.env` da raiz e já está no `.gitignore`), apontando o banco para `localhost`, porque fora do Docker o nome `postgres` não existe:

   ```env
   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5433/pet_saude?schema=public
   SYNC_SCHEDULE_ENABLED=false
   ```

3. Prepare o banco e rode:

   ```bash
   npm run prisma:generate
   npm run prisma:deploy
   npm run prisma:seed
   npm run dev                 # backend :3333 + frontend :3000
   npm run sync:data:backend   # sincroniza usando o backend local (não o Docker)
   ```

| Comando de desenvolvimento | O que faz |
|---|---|
| `npm run dev` | Backend (`tsx watch`) e frontend (`next dev`) juntos |
| `npm run test:backend` | Testes da API (veja o aviso em [11-limitacoes-conhecidas.md](11-limitacoes-conhecidas.md)) |
| `npm run build:backend` / `build:frontend` | Compila para produção |
| `npm run prisma:migrate` | Cria uma migration nova a partir do `schema.prisma` |
| `npm run sync:tuberculose` (e `sync:hanseniase`, `sync:sifilis`) | Sincroniza uma fonte |
| `npm --workspace backend run sync:data -- <slug>` | Sincroniza uma fonte pelo slug usando o backend local |
| `npm --workspace backend run prisma:studio` | Interface web para olhar o banco |

## 2.5 Variáveis de ambiente (`.env`)

| Variável | Padrão | Para que serve |
|---|---|---|
| `NODE_ENV` | `development` | Modo de execução |
| `HOST` | `0.0.0.0` | Interface em que o backend escuta |
| `APP_BIND_HOST` | `0.0.0.0` | Onde o Docker expõe frontend/backend (`0.0.0.0` = acessível na rede) |
| `SERVICE_BIND_HOST` | `127.0.0.1` | Onde o Docker expõe PostgreSQL/Redis (só na máquina local) |
| `FRONTEND_PORT` / `BACKEND_PORT` / `PORT` | `3000` / `3333` / `3333` | Portas |
| `FRONTEND_URL` / `BACKEND_URL` | `http://localhost:3000` / `:3333` | Endereços públicos (usados pelos scripts) |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3333` | URL que o **navegador** usa para chamar a API. É gravada no build do frontend: mudou → rebuild (`npm run start`) |
| `CORS_ORIGIN` | `http://localhost:3000` | Origens autorizadas a chamar a API (separadas por vírgula). Também é a lista de origens aceitas no admin |
| `ADMIN_USERNAME` | `admin` | Usuário do admin |
| `ADMIN_PASSWORD` | — | Senha do admin (**obrigatório trocar**) |
| `ADMIN_SESSION_SECRET` | — | Segredo que assina o cookie de sessão. Trocar = derruba todas as sessões |
| `ADMIN_COOKIE_SECURE` | `false` | Use `true` quando o site estiver em HTTPS |
| `ADMIN_ALLOW_BEARER_TOKEN` / `ADMIN_TOKEN` | desativado | Acesso por `Authorization: Bearer <token>` para scripts. Só funciona com `ADMIN_ALLOW_BEARER_TOKEN=true` |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | `postgres` / `postgres` / `pet_saude` | Credenciais do banco. Mudar depois de criado o volume exige `db:reset` |
| `POSTGRES_PORT` | `5433` | Porta do banco **no host** (5433 para não colidir com um PostgreSQL local) |
| `DATABASE_URL` | `...@postgres:5432/...` | Conexão do backend. Dentro do Docker o host é `postgres` |
| `REDIS_URL` / `REDIS_PORT` | — | Redis (não utilizado pelo código hoje) |
| `SYNC_SCHEDULE_ENABLED` | `true` | Liga o agendador automático |
| `SYNC_SCHEDULE_INTERVAL_DAYS` | `30` | Idade máxima da última coleta bem-sucedida antes de recoletar |
| `SYNC_SCHEDULE_CHECK_INTERVAL_MINUTES` | `1440` | De quanto em quanto tempo o agendador verifica (1440 = 1 dia) |
| `SYNC_SCHEDULE_STARTUP_DELAY_SECONDS` | `30` | Espera após o backend subir antes da 1ª verificação |
| `RUN_INITIAL_SYNC` | `false` | Se `true`, o `npm run start` já sincroniza ao final. Defina **no `.env`**: o `start` recarrega o `.env` e ignora o valor passado no terminal |
| `VITE_API_URL` | — | Sobra antiga; não é usada |

## 2.6 Executar em servidor

O fluxo é o mesmo; muda o `.env`:

```env
FRONTEND_URL=http://SEU_IP_OU_DOMINIO:3000
BACKEND_URL=http://SEU_IP_OU_DOMINIO:3333
NEXT_PUBLIC_API_URL=http://SEU_IP_OU_DOMINIO:3333
CORS_ORIGIN=http://SEU_IP_OU_DOMINIO:3000
APP_BIND_HOST=0.0.0.0
```

- Exponha apenas as portas **3000** e **3333**. PostgreSQL e Redis ficam em `127.0.0.1` por padrão.
- O `start` bloqueia se `NEXT_PUBLIC_API_URL` apontar para `localhost` com URLs de servidor.
- Em HTTPS (recomendado), use `ADMIN_COOKIE_SECURE=true`.
- Atrás de proxy reverso (nginx etc.), leia o item sobre `trust proxy` em [11-limitacoes-conhecidas.md](11-limitacoes-conhecidas.md).
