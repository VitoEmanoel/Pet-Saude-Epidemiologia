# 16. Implantação na VPS (produção)

Passo a passo para publicar o painel em `https://victorsilva0001.cloud.deploy.uespi.br` (itens 6.7 e 6.8 do [plano](12-plano-de-acao.md)). As imagens são construídas **no seu computador** e só enviadas para a VPS, que não compila nada ([02 §2.7](02-instalacao-e-execucao.md#27-servidor-pequeno-vps-e-imagens-construídas-fora-dele)).

## 16.1 Como fica no servidor

```
visitante ──HTTPS──> proxy da UESPI (170.245.33.222, certificado *.cloud.deploy.uespi.br)
                          │ HTTP, rede interna
                          ▼
            VPS 10.10.10.212, porta PUBLIC_PORT (80)
            └─ Caddy ─┬─ /api/* e /health ─> backend (3333)
                      └─ o resto ──────────> frontend (3000)
                         backend ─> postgres (sem porta exposta)
                         backup  ─> postgres (cópia diária em ./backups)
```

- **HTTPS**: feito pelo proxy da UESPI. O Caddy da VPS só divide site e API no mesmo domínio.
- **Só uma porta aberta** na VPS (`PUBLIC_PORT`, padrão 80). Banco, backend e frontend ficam na rede interna do Docker.
- **IP real do visitante**: o proxy da UESPI manda o `X-Forwarded-For`; o Caddy só aceita esse cabeçalho de redes internas (`trusted_proxies private_ranges`) e o backend confia em `TRUST_PROXY="loopback, uniquelocal"`. Visitantes não conseguem forjar o IP.
- **Volumes**: `postgres_data` (banco), `backend_storage` (arquivos brutos das coletas, O2) e `caddy_data`.

Arquivos (pasta [`deploy/`](../deploy)):

| Arquivo | Para quê |
|---|---|
| `docker-compose.prod.yml` | Serviços de produção, com imagens prontas (sem build) |
| `Caddyfile` | Divisão site/API e IP real |
| `backup.sh` | Backup diário do banco (container `backup`) |
| `install.sh` | Roda **na VPS**: confere o `.env`, carrega as imagens, aplica migrations e seed, sobe tudo e testa |
| `.env.producao.example` | Modelo do `.env` de produção |

E no seu computador: [`scripts/deploy-build.sh`](../scripts/deploy-build.sh) (gera as imagens) e [`scripts/deploy-vps.sh`](../scripts/deploy-vps.sh) (envia e instala).

## 16.2 Pré-requisitos

**Na VPS** (uma vez):

1. Acesso SSH. A VPS fica na rede interna da UESPI (`10.10.10.212`): de fora, ligue a **VPN do laboratório** (WireGuard; o perfil sai do painel em https://cloud.deploy.uespi.br): `sudo wg-quick up uespi`. O SSH da VPS **não tem SFTP**: use `scp -O` (o `deploy-vps.sh` já usa).
2. Chave SSH liberada (os scripts não digitam senha): no seu computador, `ssh-copy-id aluno@10.10.10.212`.
3. Docker e Docker Compose instalados ([02 §2.1](02-instalacao-e-execucao.md#21-pré-requisitos)); o usuário `aluno` no grupo `docker` (`sudo usermod -aG docker aluno` e entrar de novo).
4. Pasta de implantação: `sudo mkdir -p /opt/painel && sudo chown aluno: /opt/painel`.
5. 2 GB de swap se a VPS tiver 2 GB de RAM ([02 §2.7](02-instalacao-e-execucao.md#27-servidor-pequeno-vps-e-imagens-construídas-fora-dele)).
6. Arquitetura: `uname -m` deve dar `x86_64` (igual ao computador que constrói). Se der `aarch64`, ver [02 §2.7](02-instalacao-e-execucao.md#27-servidor-pequeno-vps-e-imagens-construídas-fora-dele).
7. **Descobrir a porta** em que o proxy da UESPI entrega o tráfego (veja o serviço que roda hoje: `sudo ss -ltnp`). Ponha em `PUBLIC_PORT`.
8. **Tirar o serviço antigo** dessa porta (parar e desativar; ver 16.6).

**No seu computador**: Docker, o repositório e `deploy/.env.producao` (abaixo).

## 16.3 O `.env` de produção

Crie a partir do modelo e preencha os segredos (nunca versione o arquivo preenchido):

```bash
cp deploy/.env.producao.example deploy/.env.producao
openssl rand -base64 24   # ADMIN_PASSWORD e POSTGRES_PASSWORD (um para cada)
# ADMIN_PASSWORD é só a senha da PRIMEIRA conta de administrador (criada no 1º login, item 7.4);
# depois as senhas ficam no banco e as contas são gerenciadas na tela Usuários.
openssl rand -base64 48   # ADMIN_SESSION_SECRET
```

O mesmo arquivo vai para a VPS como `/opt/painel/.env` (copie por `scp` uma vez). O `install.sh` **recusa** subir com senha fraca, cookie inseguro em HTTPS ou `TRUST_PROXY=true`.

`NEXT_PUBLIC_API_URL` é embutida no build do frontend: se mudar o domínio, gere as imagens de novo.

## 16.4 Publicar (primeira vez e atualizações)

```bash
# no seu computador, na pasta do projeto (com a VPN ligada)
./scripts/deploy-build.sh                                   # gera deploy/out/painel-imagens-<commit>.tar.gz (~250 MB)
DEPLOY_HOST=aluno@10.10.10.212 ./scripts/deploy-vps.sh deploy/out/painel-imagens-<commit>.tar.gz
```

O `deploy-vps.sh` envia os arquivos de `deploy/` e as imagens para `/opt/painel` e roda o `install.sh` lá. Na primeira vez, se faltar o `.env` da VPS, ele para e diz como criar.

Depois da **primeira** publicação:

1. Com o banco vazio, o agendador começa a sincronizar sozinho `SYNC_SCHEDULE_STARTUP_DELAY_SECONDS` (60 s) depois que o backend sobe; confira em **Sincronizações** no admin. Para rodar à mão: `docker compose -f docker-compose.prod.yml --env-file .env exec -T backend node backend/dist/scripts/sync-data.js`. Desde o O3 + O4 (08/10/2026) é seguro rodar junto com o agendador: a fonte que já estiver sincronizando é pulada ("já está sincronizando em outro processo"). Na primeira publicação (03/10/2026), sem essa trava, os dois se atropelaram e a tuberculose ficou com 11 de 500 registros.
2. Abrir `https://victorsilva0001.cloud.deploy.uespi.br` e `/admin`; entrar.
3. **Conferir o IP na auditoria** do admin: tem que aparecer o **seu** IP, não `10.x`/`172.x`. Se aparecer o IP do proxy da UESPI, o `TRUST_PROXY` precisa incluir o IP dele.
4. Enviar a planilha de população (tela População), quando o GT1 mandar.

**Voltar versão**: as imagens antigas ficam na VPS com o nome do commit. `IMAGE_TAG=<commit> docker compose -f docker-compose.prod.yml --env-file .env up -d backend frontend`.

## 16.5 Backup e restauração (6.4)

- O container `backup` grava `/opt/painel/backups/pet_saude_AAAA-MM-DD_HHMM.dump` **todo dia** e apaga os de mais de `BACKUP_KEEP_DAYS` (14) dias. Log: `docker logs painel-backup-1`.
- **Os backups ficam no mesmo disco da VPS.** Copie para outro lugar de vez em quando: `scp 'aluno@10.10.10.212:/opt/painel/backups/*.dump' ~/backups-painel/`.
- **Restaurar** (substitui o banco atual; pare o backend antes):

```bash
cd /opt/painel
C="docker compose -f docker-compose.prod.yml --env-file .env"
$C stop backend
$C exec -T postgres pg_restore -U postgres -d pet_saude --clean --if-exists --no-owner < backups/pet_saude_AAAA-MM-DD_HHMM.dump
$C start backend
```

Testado em 03/10/2026: backup restaurado num banco temporário trouxe os 500 registros de tuberculose, a auditoria e as 8 fontes.

## 16.6 Tirar o serviço antigo da VPS

Antes de subir o painel, a porta do proxy precisa estar livre. Primeiro **descubra** o que roda (não apaga nada):

```bash
sudo ss -ltnp                 # quem escuta em cada porta
docker ps -a                  # containers
systemctl list-units --type=service --state=running | grep -vE 'systemd|dbus|ssh|cron|network'
```

Depois pare e desative só o serviço antigo (exemplos, conforme o que aparecer): `docker compose down` na pasta dele, ou `sudo systemctl disable --now <serviço>`. Guarde uma cópia dos dados dele antes, se forem importantes.

## 16.7 Comandos do dia a dia na VPS

```bash
cd /opt/painel
C="docker compose -f docker-compose.prod.yml --env-file .env"
$C ps                         # situação dos containers
$C logs -f backend            # log da API (também: caddy, frontend, backup)
$C restart backend            # reiniciar (ex.: liberar o bloqueio de login)
$C exec -T backend node backend/dist/scripts/sync-data.js dengue_sinan   # sincronizar uma fonte
df -h /                       # espaço em disco
```

## 16.8 Validação desta configuração

Simulada em 03/10/2026 numa pasta local fazendo papel da VPS (porta 8088), com as imagens geradas pelo `deploy-build.sh`: `install.sh` completo (migrations, seed, subida e teste); site, `/dengue`, `/admin`, `/health` e `/api/*` pelo Caddy; CSP apontando para o domínio; gzip; cookie do admin com `Secure`; IP repassado pelo proxy registrado na auditoria; sincronização da tuberculose (500 registros) com os arquivos brutos mantidos ao recriar o backend (O2); backup a cada 20 s e restauração conferida.

## 16.9 Dividir o domínio com outro sistema (painel em `/painel`)

O laboratório entrega **um domínio e só a porta 80** por VPS. Na VPS do Victor já roda o **TSCQuestões** (Next.js direto no systemd, sem Docker). Para os dois ficarem no ar, o Caddy do painel fica na porta 80 e divide pelo caminho:

```
https://victorsilva0001.cloud.deploy.uespi.br/          → TSCQuestões (porta 3100 da VPS)
https://victorsilva0001.cloud.deploy.uespi.br/painel    → Painel PET-Saúde
https://victorsilva0001.cloud.deploy.uespi.br/painel/api → backend do painel
```

**No `.env` de produção** (já é o padrão do modelo):

| Variável | Valor | Para quê |
|---|---|---|
| `NEXT_PUBLIC_BASE_PATH` | `/painel` | Prefixo do site (embutido no build do frontend) |
| `PUBLIC_BASE_PATH` | `/painel` | Caminho do cookie do admin no backend (`/painel/api/admin`) |
| `NEXT_PUBLIC_API_URL`, `BACKEND_URL` | `https://…/painel` | Endereço da API visto pelo navegador |
| `FRONTEND_URL`, `CORS_ORIGIN` | `https://…` (**sem** `/painel`) | Origem do site (o navegador não manda caminho na origem) |
| `CADDYFILE` | `Caddyfile.subcaminho` | Caddy no modo dividido |
| `OUTRO_SITE` | `host.docker.internal:3100` | Para onde vai o resto do domínio |

Mudar o prefixo exige gerar as imagens de novo (`deploy-build.sh`). Para o painel ocupar o domínio inteiro (ex.: se o laboratório der um segundo subdomínio), deixe `NEXT_PUBLIC_BASE_PATH`, `PUBLIC_BASE_PATH` e `CADDYFILE` vazios, tire o `/painel` das URLs e gere as imagens de novo.

**Mudar o TSCQuestões para a porta 3100** (uma vez; sem alterar os arquivos dele):

```bash
# porta nova, por "drop-in" do systemd (o arquivo original do serviço fica intacto)
sudo mkdir -p /etc/systemd/system/tscquestoes.service.d
printf '[Service]\nEnvironment=PORT=3100\n' | sudo tee /etc/systemd/system/tscquestoes.service.d/porta-3100.conf

# firewall: a 3100 só aceita a própria VPS e os containers (o Caddy)
sudo tee /etc/painel-firewall.nft <<'NFT'
table inet painel {
  chain entrada {
    type filter hook input priority filter; policy accept;
    tcp dport 3100 ip saddr { 127.0.0.1, 172.16.0.0/12 } accept
    tcp dport 3100 drop
  }
}
NFT
printf '[Unit]\nDescription=Firewall da porta 3100 (TSCQuestoes atras do Caddy do painel)\nAfter=network-online.target\n[Service]\nType=oneshot\nRemainAfterExit=yes\nExecStart=/usr/sbin/nft -f /etc/painel-firewall.nft\nExecStop=/usr/sbin/nft delete table inet painel\n[Install]\nWantedBy=multi-user.target\n' | sudo tee /etc/systemd/system/painel-firewall.service
sudo systemctl daemon-reload && sudo systemctl enable --now painel-firewall
```

**Ordem da troca** (o TSCQuestões fica fora do ar só entre os passos 2 e 3, cerca de 1 minuto):

1. Enviar as imagens e preparar tudo **sem o Caddy** (a porta 80 ainda é do TSCQuestões).
2. `sudo systemctl restart tscquestoes`: ele passa para a 3100 e libera a 80.
3. Subir o Caddy (`up -d caddy`) e conferir `/` (TSCQuestões) e `/painel`.

**Voltar ao estado anterior:** `docker compose -f docker-compose.prod.yml --env-file .env stop caddy`, `sudo rm /etc/systemd/system/tscquestoes.service.d/porta-3100.conf`, `sudo systemctl daemon-reload && sudo systemctl restart tscquestoes` (volta para a porta 80). Ou o ponto salvo do painel do laboratório.

**Publicado assim em 03/10/2026** (troca com 5 s do TSCQuestões fora do ar). **Validado antes** em simulação local com o painel em `/painel` e um "TSCQuestões falso" na raiz: rotas conferidas (`/` e qualquer outro caminho vão para o outro sistema; `/painel`, `/painel/api` e `/painel/health` para o painel), sincronização das 7 fontes, **suíte de interface completa pelo endereço `/painel`** (login do admin, downloads, telas). Na VPS real: container alcançando um serviço da própria VPS pelo `host.docker.internal` (200). A suíte de interface aceita o prefixo: `QA_WEB_URL=http://host/painel QA_API_URL=http://host/painel`.
