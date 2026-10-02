# 10. Solução de problemas

Comece sempre por:

```bash
npm run doctor
npm run logs -- backend     # Ctrl+C para sair
```

## 10.1 Ambiente e Docker

| Sintoma | Causa | Solução |
|---|---|---|
| `permission denied` / `Cannot connect to the Docker daemon` | Usuário fora do grupo `docker` | `sudo usermod -aG docker "$USER"` e fazer logout/login |
| `docker info` mostra `/var/snap/docker` | Docker instalado via Snap (não suportado) | `sudo snap remove --purge docker` e instalar o oficial ([02](02-instalacao-e-execucao.md)) |
| `failed to add the host <=> sandbox pair interfaces: operation not supported` | O **kernel foi atualizado e a máquina não foi reiniciada**: os módulos do kernel em uso (ex.: `veth`) não existem mais em `/lib/modules` | **Reinicie a máquina.** Para confirmar: `uname -r` não aparece em `ls /lib/modules` |
| `cannot stop container` / container travado | Daemon Docker em mau estado | `npm run docker:recover` e depois `npm run start` |
| `docker:recover` pede senha / falha com `sudo` | O script reinicia o Docker com `sudo systemctl restart docker` | Rode-o num terminal interativo |
| `EACCES: permission denied` ao sincronizar, gravando em `backend/storage` | Os containers rodam como o usuário `node` (uid 1000), e a pasta montada pertence a outro usuário (ex.: pasta do servidor montada no lugar de `backend/storage`) | Na máquina hospedeira: `sudo chown -R 1000:1000 <pasta montada>`. Volumes nomeados do Docker herdam o dono certo da imagem |
| Build mostra `buildx Docker CLI plugin not found: falling back to the classic builder` | Plugin `buildx` não instalado | Inofensivo para build na mesma arquitetura. Para construir imagens para outra arquitetura (ex.: VPS ARM), instale o `buildx` ([02 §2.7](02-instalacao-e-execucao.md#27-servidor-pequeno-vps-e-imagens-construídas-fora-dele)) |
| Porta em uso (3000, 3333, 5433) | Outro programa usando a porta | Pare o programa ou mude a porta no `.env` |

## 10.2 Configuração

| Sintoma | Causa | Solução |
|---|---|---|
| `start` recusa subir falando de senha/segredo | Placeholders no `.env` | Troque `ADMIN_PASSWORD` e `ADMIN_SESSION_SECRET` |
| `NEXT_PUBLIC_API_URL nao pode apontar para localhost` | URLs de servidor com API em localhost | Use o IP/domínio real em `NEXT_PUBLIC_API_URL` |
| Banco recusa usuário/senha | Volume criado com credenciais antigas | Se puder apagar os dados: `npm run db:reset -- --force` e `npm run start` |
| Backend local (`npm run dev`) não conecta ao banco | `DATABASE_URL` aponta para `postgres` (nome que só existe dentro do Docker) | Crie `backend/.env` com `...@127.0.0.1:5433/...` ([02 §2.4](02-instalacao-e-execucao.md#24-modo-desenvolvimento-sem-docker-para-o-código)) |

## 10.3 Site e dados

| Sintoma | Causa | Solução |
|---|---|---|
| Site abre sem números | Dados nunca sincronizados | `npm run sync:data` |
| "API indisponível: API request failed" no site | Backend fora do ar, ou `NEXT_PUBLIC_API_URL` errado | `curl <API>/health`; confira a URL e refaça o build |
| Erro de CORS no console do navegador | `CORS_ORIGIN` não contém a URL do site | Ajuste `CORS_ORIGIN` e reinicie |
| Com filtro de sexo, o gráfico por faixa etária mostra "todos os sexos" | O DATASUS não fornece faixa etária separada por sexo | Comportamento esperado; o aviso no gráfico explica |
| Ao escolher faixa etária, o filtro de sexo foi limpo | Só um filtro demográfico por vez (não há dados cruzados) | Comportamento esperado |
| Soma do CSV dá 4× o total | O CSV foi exportado com a visão "Todas as visões" (`aggregation=all`) | Exporte uma visão por vez, ou some só as linhas com `aggregation = yearly` ([04 §4.2](04-banco-de-dados.md#42-ponto-essencial-as-4-agregações-convivem-na-mesma-tabela)) |
| Erro 400 "A visao escolhida nao combina com o filtro" | Filtro de uma dimensão (ex.: sexo) com visão de outra | Use a visão da mesma dimensão do filtro, ou "Automática" |
| Número de um ano recente mudou depois de sincronizar | O DATASUS revisa os anos recentes (ex.: dengue 2026 "sujeito a revisão") | Normal: o painel mostra a versão mais recente publicada |
| Ano novo não aparece | Ano não incluído em `periodFiles` | [09 §9.1](09-guia-de-manutencao.md#91-incluir-um-ano-novo-de-dados) |
| Sincronização falhou | TABNET fora do ar ou parâmetros mudaram | [09 §9.3](09-guia-de-manutencao.md#93-uma-fonte-parou-de-sincronizar) |

## 10.4 Área administrativa

| Sintoma | Solução |
|---|---|
| "Muitas tentativas de acesso" (429) | Espere 15 min ou reinicie o backend |
| Login aceito mas o painel volta para o login | Confira `CORS_ORIGIN`. Em HTTP, `ADMIN_COOKIE_SECURE` deve ser `false` |
| 503 `admin_not_configured` | Preencha `ADMIN_USERNAME`, `ADMIN_PASSWORD` e `ADMIN_SESSION_SECRET` |
| 403 "Origem administrativa nao permitida" | A URL do site não está em `CORS_ORIGIN` |
