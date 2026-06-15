# Roadmap Do Projeto

Atualizado em: 2026-06-15

Este arquivo define a ordem recomendada para evoluir o sistema a partir do estado atual.

## Ja Feito

- [x] Estrutura em monorepo com backend e frontend.
- [x] Banco PostgreSQL local com Prisma.
- [x] Docker Compose com PostgreSQL e Redis.
- [x] Setup unico com `npm run setup`.
- [x] Execucao local com `npm run dev`.
- [x] Painel limitado a Parnaiba - PI.
- [x] Bloqueio de filtros publicos para outros municipios.
- [x] Coleta real do DATASUS/TABNET para tuberculose.
- [x] Coleta real do DATASUS/TABNET para hanseniase.
- [x] Coleta real do DATASUS/TABNET para sifilis congenita.
- [x] Paginas de tuberculose, hanseniase e sifilis.
- [x] Graficos, indicadores, filtros, tabela paginada e CSV.
- [x] README reorganizado para instalacao em computador novo.

## Ordem Recomendada

## 1. Atualizacao Automatica

- [x] Criar rotina automatica de sincronizacao.
- [x] Definir frequencia inicial: mensal.
- [x] Evitar duas sincronizacoes simultaneas da mesma fonte.
- [x] Manter dados antigos quando uma coleta falhar.
- [x] Registrar inicio, fim, status e erro de cada execucao.
- [x] Permitir reprocessar manualmente mesmo com agendamento ativo.

## 2. Tela Administrativa

- [x] Criar pagina administrativa com `ADMIN_TOKEN`.
- [x] Mostrar fontes ativas.
- [x] Mostrar ultima sincronizacao por fonte.
- [x] Mostrar status da ultima sincronizacao.
- [x] Mostrar quantidade de registros importados.
- [x] Mostrar erros de coleta.
- [x] Mostrar historico de sincronizacoes.
- [x] Criar botao para atualizar uma fonte.
- [x] Criar botao para atualizar todas as fontes.
- [ ] Criar login administrativo mais robusto para producao.

## 3. Transparencia No Painel

- [ ] Exibir ultima atualizacao com mais destaque.
- [ ] Exibir periodo de dados disponivel por fonte.
- [ ] Exibir fonte oficial DATASUS/TABNET de cada pagina.
- [ ] Avisar quando os dados estiverem desatualizados.
- [ ] Avisar quando a ultima tentativa de sincronizacao falhou.
- [ ] Diferenciar dado atualizado, dado antigo e fonte indisponivel.

## 4. Novas Fontes

- [ ] Validar fonte oficial para casos de dengue.
- [ ] Validar fonte oficial para arboviroses em geral.
- [ ] Validar fonte oficial para sifilis gestacional.
- [ ] Confirmar se cada fonte permite filtro por municipio de residencia.
- [ ] Mapear parametros TABNET de cada fonte.
- [ ] Criar coletor para dengue.
- [ ] Criar coletor para arboviroses em geral.
- [ ] Criar coletor para sifilis gestacional.
- [ ] Criar paginas e graficos para cada nova fonte.
- [ ] Documentar limitacoes de cada fonte.

## 5. Preparacao Para Deploy

- [ ] Definir ambiente de producao.
- [ ] Definir banco PostgreSQL de producao.
- [ ] Definir estrategia de deploy do backend.
- [ ] Definir estrategia de deploy do frontend.
- [ ] Configurar variaveis de ambiente de producao.
- [ ] Configurar HTTPS.
- [ ] Configurar dominio.
- [ ] Criar rotina de backup do banco.
- [ ] Criar rotina de restauracao.
- [ ] Configurar monitoramento e alerta de falha nas sincronizacoes.

## Prioridade Imediata

O proximo bloco recomendado e:

```txt
1. Transparencia No Painel
2. Novas Fontes
```

Esses dois blocos deixam o sistema mais controlavel antes de adicionar dengue, arboviroses e sifilis gestacional.
