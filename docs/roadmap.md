# Roadmap Do Projeto

Atualizado em: 2026-06-17

Este arquivo define a ordem recomendada para evoluir o sistema a partir do estado atual.

## Casos Obrigatorios

O produto deve cobrir estes casos:

- tuberculose
- hanseniase
- dengue
- arboviroses em geral
- sifilis congenita
- sifilis gestacional

## Estado Atual

O sistema opera hoje com escopo reduzido para:

- tuberculose_sinan
- hanseniase_sinan
- sifilis_congenita_sinan
- dengue_sinan
- arboviroses_sinan
- sifilis_gestacional_sinan

Observacoes do estado atual:

- `dengue_sinan` ja tem coletor validado no DATASUS/TABNET.
- `arboviroses_sinan` esta operacional como visao agregada baseada em dengue e zika.
- `sifilis_gestacional_sinan` ja tem coletor validado no DATASUS/TABNET.

O restante do roadmap abaixo trata de transparencia, ampliacao das fontes e deploy futuro.

## Ja Feito

- [x] Estrutura em monorepo com backend e frontend.
- [x] Banco PostgreSQL local com Prisma.
- [x] Docker Compose com PostgreSQL e Redis.
- [x] Fluxo unico com `npm run doctor` e `npm run start`.
- [x] Execucao local com `npm run dev`.
- [x] Painel limitado a Parnaiba - PI.
- [x] Bloqueio de filtros publicos para outros municipios.
- [x] Coleta real do DATASUS/TABNET para tuberculose.
- [x] Coleta real do DATASUS/TABNET para hanseniase.
- [x] Coleta real do DATASUS/TABNET para sifilis congenita.
- [x] Coleta real do DATASUS/TABNET para dengue.
- [x] Coleta real do DATASUS/TABNET para sifilis gestacional.
- [x] Paginas de tuberculose, hanseniase e sifilis.
- [x] Catalogo com 6 casos, todos operacionais ou derivados no escopo atual.
- [x] Visao operacional de arboviroses em geral agregando dengue e zika.
- [x] Graficos, indicadores, filtros e tabela paginada no site publico.
- [x] Exportacao CSV movida para a area administrativa.
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

- [x] Criar pagina administrativa inicial com `ADMIN_TOKEN`.
- [x] Mostrar fontes ativas.
- [x] Mostrar ultima sincronizacao por fonte.
- [x] Mostrar status da ultima sincronizacao.
- [x] Mostrar quantidade de registros importados.
- [x] Mostrar erros de coleta.
- [x] Mostrar historico de sincronizacoes.
- [x] Criar botao para atualizar uma fonte.
- [x] Criar botao para atualizar todas as fontes.
- [x] Separar layout administrativo da navegacao publica.
- [x] Criar login administrativo com sessao HTTP-only.
- [x] Melhorar auditoria administrativa por usuario.

## 3. Transparencia No Painel

- [ ] Exibir ultima atualizacao com mais destaque.
- [ ] Exibir periodo de dados disponivel por fonte.
- [ ] Exibir fonte oficial DATASUS/TABNET de cada pagina.
- [ ] Avisar quando os dados estiverem desatualizados.
- [ ] Avisar quando a ultima tentativa de sincronizacao falhou.
- [ ] Diferenciar dado atualizado, dado antigo e fonte indisponivel.

## 4. Novas Fontes

- [x] Validar fonte oficial para casos de dengue.
- [x] Validar fonte oficial base para arboviroses em geral no recorte atual do produto.
- [x] Validar fonte oficial para sifilis gestacional.
- [x] Confirmar se cada fonte permite filtro por municipio de residencia.
- [x] Mapear parametros TABNET para dengue.
- [x] Mapear parametros oficiais restantes para chikungunya e sifilis gestacional.
- [x] Criar coletor para dengue.
- [x] Criar visao derivada para arboviroses em geral.
- [x] Criar coletor para sifilis gestacional.
- [ ] Criar integracao de chikungunya para completar arboviroses em geral.
- [x] Criar paginas e graficos para cada nova fonte ja operacional.
- [x] Documentar limitacoes de cada fonte.

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

Esses dois blocos deixam o sistema mais controlavel antes de concluir chikungunya dentro de arboviroses.
