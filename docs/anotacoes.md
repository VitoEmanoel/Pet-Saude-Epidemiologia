# Anotacoes do projeto

Atualizado em: 2026-06-15

Este arquivo serve como controle do que precisa ser feito para o sistema funcionar de ponta a ponta. Marcar com `[x]` apenas quando a etapa estiver implementada e validada.

Roadmap priorizado: [`docs/roadmap.md`](./roadmap.md).

## Casos obrigatorios

- [x] Tuberculose
- [x] Hanseníase
- [ ] Dengue
- [ ] Arboviroses em geral
- [x] Sífilis Congênita
- [ ] Sífilis Gestacional

## Escopo atual

- [x] Fontes ativas em producao: `tuberculose_sinan`, `hanseniase_sinan`, `sifilis_congenita_sinan`.
- [x] Painel limitado a Parnaiba - PI.
- [x] Coleta, dashboard e area administrativa validados para o escopo atual.

## Escopo futuro

- [ ] Expansao para novas fontes DATASUS/TABNET.
- [ ] Melhorias de transparencia visual no painel.
- [ ] Preparacao para deploy em producao.

## Fase 1 - Fundacao tecnica

- [x] Criar estrutura do projeto em monorepo.
- [x] Criar `package.json` raiz com workspaces.
- [x] Criar `.gitignore`.
- [x] Criar estrutura do backend.
- [x] Criar estrutura do frontend.
- [x] Criar estrutura de documentacao em `docs/`.
- [x] Configurar backend com Node.js, Express e TypeScript.
- [x] Configurar frontend com Next.js, React, TypeScript e Tailwind CSS.
- [x] Definir cidade fixa do sistema: Parnaiba - PI.
- [x] Definir codigo IBGE fixo: `2207702`.
- [x] Definir categoria DATASUS fixa: `epidemiologicas_morbidade`.
- [x] Criar lista fixa das fontes permitidas.
- [x] Criar rota `GET /health`.
- [x] Criar rota `GET /api/sources`.
- [x] Criar rota `GET /api/sources/:slug`.
- [x] Criar rota `GET /api/sources/:slug/availability`.
- [x] Criar rota `GET /api/dashboard/overview`.
- [x] Criar rota `GET /api/records`.
- [x] Criar rotas iniciais de graficos.
- [x] Criar rotas administrativas iniciais.
- [x] Proteger rotas administrativas com `ADMIN_TOKEN`.
- [x] Bloquear filtros publicos por outro municipio.
- [x] Criar schema Prisma inicial.
- [x] Criar tabelas de fontes, disponibilidade, sincronizacoes, importacoes brutas e registros normalizados.
- [x] Criar seed Prisma das fontes permitidas.
- [x] Criar Docker Compose com PostgreSQL e Redis.
- [x] Ajustar PostgreSQL local para porta `5433`.
- [x] Criar migration inicial do banco.
- [x] Rodar seed e confirmar fontes ativas no banco.
- [x] Criar tela inicial do frontend.
- [x] Exibir fontes permitidas no frontend.
- [x] Exibir status municipal pendente no frontend.
- [x] Validar build do backend.
- [x] Validar build do frontend.
- [x] Testar `GET /health`.
- [x] Testar `GET /api/sources`.
- [x] Testar bloqueio de municipio em `GET /api/records`.
- [x] Documentar como rodar o projeto no `README.md`.
- [x] Criar plano de fases em `docs/fases.md`.

## Preparacao local

- [x] Criar arquivo `.env` local a partir de `.env.example`.
- [x] Definir `ADMIN_PASSWORD` e `ADMIN_SESSION_SECRET` reais no `.env`.
- [x] Confirmar que `NEXT_PUBLIC_API_URL` aponta para `http://localhost:3333`.
- [x] Confirmar que `DATABASE_URL` aponta para o servico `postgres` dentro do Docker.
- [x] Confirmar que PostgreSQL, Redis, backend e frontend sobem com `npm run start`.
- [x] Criar comandos oficiais `doctor`, `start`, `stop`, `restart`, `sync:data`, `db:reset` e `docker:recover`.
- [x] Confirmar que `npm run dev` fica separado para desenvolvimento fora do fluxo Docker principal.

## Fase 2 - Validacao tecnica do DATASUS/TABNET

- [x] Escolher fonte piloto.
- [x] Usar `tuberculose_sinan` como fonte piloto.
- [x] Reduzir escopo atual do painel para tuberculose, hanseniase e sifilis congenita.
- [x] Localizar a URL real da fonte de Tuberculose no DATASUS/TABNET.
- [x] Identificar se a fonte pertence realmente a Epidemiologicas e Morbidade.
- [x] Mapear parametros de consulta do TABNET para Tuberculose.
- [x] Confirmar filtro por UF Piaui.
- [x] Confirmar filtro por municipio de Parnaiba.
- [x] Confirmar uso do codigo IBGE `2207702`, quando disponivel.
- [x] Identificar se o filtro correto deve ser municipio de residencia, notificacao, atendimento ou ocorrencia.
- [x] Identificar periodo historico disponivel.
- [x] Identificar dimensoes disponiveis: ano, sexo, faixa etaria, raca/cor e agravo.
- [x] Identificar formato de retorno disponivel: HTML, CSV, DBF ou outro.
- [x] Fazer primeira consulta manual controlada.
- [x] Salvar exemplo bruto da resposta para analise.
- [x] Registrar parametros usados na consulta.
- [x] Registrar se a fonte possui dados municipais para Parnaiba.
- [x] Atualizar status da fonte no banco.
- [x] Atualizar status da fonte no frontend.

## Fase 3 - Coletor da fonte piloto

- [x] Criar modulo `datasus` no backend.
- [x] Criar contrato comum para coletores.
- [x] Criar coletor especifico para `tuberculose_sinan`.
- [x] Generalizar coletor SINAN/TABNET para fontes com consulta municipal por residencia.
- [x] Criar coletor para `hanseniase_sinan`.
- [x] Criar coletor para `sifilis_congenita_sinan`.
- [x] Enviar parametros corretos ao TABNET pelo backend.
- [x] Baixar resposta bruta da fonte.
- [x] Calcular hash da resposta bruta.
- [x] Registrar importacao bruta em `raw_imports`.
- [x] Transformar resposta bruta em JSON.
- [x] Normalizar campos principais.
- [x] Normalizar ano.
- [x] Normalizar sexo.
- [x] Normalizar faixa etaria.
- [x] Normalizar raca/cor.
- [x] Normalizar municipio como Parnaiba - PI.
- [x] Validar que nenhum registro de outro municipio foi salvo.
- [x] Gerar `record_key` estavel para evitar duplicidade.
- [x] Salvar registros normalizados em `epidemiological_records`.
- [x] Registrar job de sincronizacao em `sync_jobs`.
- [x] Tratar erro de coleta.
- [x] Tratar fonte sem dados.
- [x] Tratar fonte sem filtro municipal.
- [x] Permitir reprocessar as fontes ativas do painel.
- [x] Criar `npm run sync:data` para sincronizar todas as fontes ativas.
- [x] Criar comandos individuais de sincronizacao por fonte.

## Fase 4 - API com dados reais

- [x] Conectar rotas publicas ao PostgreSQL.
- [x] Fazer `GET /api/dashboard/overview` retornar dados reais.
- [x] Fazer `GET /api/records` retornar registros reais paginados.
- [x] Fazer `GET /api/charts/yearly-evolution` retornar serie anual real.
- [x] Fazer `GET /api/charts/by-sex` retornar dados reais por sexo.
- [x] Fazer `GET /api/charts/by-age-group` retornar dados reais por faixa etaria.
- [x] Criar endpoint de filtros disponiveis por fonte.
- [x] Criar endpoint de resumo por fonte.
- [x] Criar endpoint de exportacao CSV.
- [x] Garantir que nenhum endpoint aceite troca de municipio.
- [x] Criar testes para bloqueio de municipio.
- [x] Criar testes para fonte nao permitida.
- [x] Criar testes para respostas principais da API.

## Fase 5 - Frontend com dados reais

- [x] Criar layout final com header e menu lateral.
- [x] Criar pagina de visao geral.
- [x] Criar pagina da fonte piloto.
- [x] Criar paginas para hanseniase e sifilis.
- [x] Criar paginas de validacao para dengue, arboviroses em geral e sifilis gestacional.
- [x] Criar cards de indicadores reais.
- [x] Criar grafico de evolucao anual.
- [x] Criar grafico por sexo.
- [x] Criar grafico por faixa etaria.
- [x] Criar grafico por raca/cor, quando disponivel.
- [x] Criar tabela detalhada paginada.
- [x] Criar filtros por fonte.
- [x] Criar exportacao CSV na area administrativa.
- [x] Exibir ultima atualizacao.
- [x] Exibir status da coleta.
- [x] Exibir aviso quando dados municipais estiverem indisponiveis.
- [x] Exibir aviso quando a ultima sincronizacao falhar.
- [x] Criar mapa destacando Parnaiba - PI.
- [x] Validar responsividade em desktop.
- [x] Validar responsividade em mobile.

## Fase 6 - Area administrativa

- [x] Criar tela administrativa.
- [x] Criar acesso administrativo via `ADMIN_TOKEN`.
- [x] Criar login administrativo com sessao HTTP-only.
- [x] Criar auditoria administrativa para login, logout, exportacao e sincronizacao.
- [x] Listar todas as fontes ativas.
- [x] Mostrar status de disponibilidade municipal por fonte.
- [x] Mostrar ultima sincronizacao por fonte.
- [x] Mostrar historico de sincronizacoes.
- [x] Mostrar erros de coleta.
- [x] Permitir sincronizar uma fonte especifica.
- [x] Permitir sincronizar todas as fontes pela API administrativa.
- [x] Mover exportacao CSV para a area administrativa.
- [x] Remover exportacao CSV do site publico.
- [x] Separar layout administrativo da navegacao publica.
- [ ] Permitir ativar ou desativar fonte.
- [ ] Impedir sincronizacao de fonte fora da lista permitida.
- [ ] Registrar usuario ou origem da solicitacao administrativa.
- [x] Remover uso de token administrativo salvo no navegador.
- [x] Melhorar auditoria administrativa por usuario.

## Fase 7 - Atualizacao automatica

- [x] Criar job automatico de sincronizacao.
- [x] Definir frequencia mensal inicial.
- [x] Evitar execucoes simultaneas da mesma fonte.
- [x] Registrar inicio e fim de cada job.
- [x] Registrar falhas sem apagar dados antigos validos.
- [x] Manter ultima coleta bem-sucedida disponivel.
- [ ] Criar politica de retry para falhas temporarias.
- [ ] Criar logs estruturados.

## Fase 8 - Expansao futura de fontes

- [x] Validar `hanseniase_sinan`.
- [x] Validar `sifilis_congenita_sinan`.
- [x] Remover do painel as fontes sem coletor implementado no escopo atual.
- [ ] Avaliar futuramente se sifilis adquirida e sifilis gestacional devem virar fontes separadas.
- [ ] Concluir a validacao tecnica de dengue.
- [ ] Concluir a validacao tecnica de arboviroses em geral.
- [ ] Concluir a validacao tecnica de sifilis gestacional.
- [ ] Criar coletor para cada nova fonte validada.
- [ ] Marcar fonte como indisponivel quando nao houver filtro municipal.
- [ ] Documentar parametros e limitacoes de cada fonte.

## Qualidade e seguranca

- [ ] Revisar vulnerabilidades do `npm audit`.
- [ ] Configurar lint do backend.
- [ ] Configurar lint do frontend.
- [ ] Configurar formatacao padrao.
- [ ] Criar testes unitarios do backend.
- [ ] Criar testes de integracao da API.
- [ ] Criar testes basicos do frontend.
- [ ] Criar validacao de variaveis de ambiente.
- [ ] Criar tratamento centralizado de erros.
- [ ] Criar rate limit para rotas administrativas.
- [ ] Criar logs sem expor token administrativo.
- [ ] Garantir que dados estimados nunca sejam exibidos como oficiais.
- [ ] Garantir mensagens de transparencia no frontend.

## Implantacao futura

- [ ] Definir ambiente de producao.
- [ ] Definir banco PostgreSQL de producao.
- [ ] Definir Redis de producao.
- [ ] Definir estrategia de backup do banco.
- [ ] Definir estrategia de deploy do backend.
- [ ] Definir estrategia de deploy do frontend.
- [ ] Configurar variaveis de ambiente em producao.
- [ ] Configurar HTTPS.
- [ ] Configurar monitoramento.
- [ ] Configurar alerta de falha nas sincronizacoes.
- [ ] Criar rotina de backup.
- [ ] Criar rotina de restauracao.
