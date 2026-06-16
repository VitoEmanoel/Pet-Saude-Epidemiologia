# Plano De Separacao Entre Site Publico E Area Administrativa

Atualizado em: 2026-06-15

Este documento define o plano para separar o site publico da area administrativa, mantendo um backend unico e movendo as operacoes sensiveis para uma interface privada.

## Objetivo

- Manter o site publico apenas para consulta e visualizacao.
- Criar uma area administrativa privada para operacoes internas.
- Remover o download CSV do site publico.
- Deixar exportacao de dados, sincronizacao e historico apenas no admin.
- Preservar uma API central unica para atender as duas interfaces.

## Estado Atual

- O frontend publico mostra graficos, filtros e tabela de consulta.
- O backend deve expor a exportacao CSV apenas na area administrativa.
- O admin tem layout proprio separado da navegacao publica.
- A protecao administrativa usa login com cookie HTTP-only.
- O backend ainda aceita `Authorization: Bearer <ADMIN_TOKEN>` temporariamente para chamadas manuais.

## Arquitetura Alvo

### Camada 1: Site Publico

- Area aberta para qualquer usuario.
- Foco em leitura de dados.
- Sem acoes administrativas.
- Sem download CSV.
- Sem campos de autenticacao administrativa.

### Camada 2: Area Administrativa

- Area privada separada da navegacao publica.
- Acesso com autenticacao propria.
- Permite:
  - ver historico de sincronizacoes
  - disparar sincronizacao manual
  - exportar CSV
  - acompanhar falhas e status

### Camada 3: Backend/API

- Um unico backend para as duas interfaces.
- Rotas publicas permanecem livres.
- Rotas administrativas ficam protegidas no servidor.
- O backend decide o acesso, nao o frontend.

## Regra De Negocio

- O site publico nao deve oferecer download de CSV.
- O CSV filtrado passa a ser um recurso do admin.
- Qualquer exportacao sensivel deve exigir autenticao administrativa.
- O publico continua podendo consultar e visualizar os dados agregados e detalhados dentro da interface permitida.

## Estrutura Recomendada

### Opcao simples e organizada

```txt
apps/
  public-web/
  admin-web/
  api/
packages/
  shared/
```

### Responsabilidade De Cada Parte

- `apps/public-web`
  - home publica
  - paginas de indicadores
  - graficos
  - filtros
  - tabela de consulta

- `apps/admin-web`
  - login admin
  - painel administrativo
  - exportacao CSV
  - sincronizacao manual
  - historico de jobs

- `apps/api`
  - rotas publicas
  - rotas administrativas
  - autenticacao
  - acesso ao banco

- `packages/shared`
  - tipos
  - utilitarios
  - componentes reutilizaveis, se fizer sentido

## Fluxo De Uso

### Usuario Publico

1. Entra no site publico.
2. Visualiza dados, graficos e tabelas.
3. Filtra informacoes permitidas.
4. Nao ve botao de exportacao CSV.
5. Nao acessa rotas administrativas.

### Usuario Admin

1. Entra na area privada.
2. Faz login.
3. Acessa painel administrativo.
4. Pode exportar CSV.
5. Pode sincronizar fontes.
6. Pode consultar historico.

## Plano De Implementacao

### Fase 1: Remocao Do Download Do Publico

- [x] Remover o botao CSV do frontend publico.
- [x] Remover qualquer link visivel para exportacao na area publica.
- [x] Revisar textos da interface para nao sugerir download publico.
- [x] Ajustar a documentacao publica para refletir que o CSV e administrativo.

### Fase 2: Protecao Da Exportacao

- [x] Mover a exportacao CSV para uma rota administrativa.
- [x] Proteger a rota com autenticacao admin.
- [x] Garantir que a exportacao nao funcione sem permissao.
- [ ] Registrar no historico quem solicitou a exportacao, se possivel.

### Fase 3: Separacao Da Interface

- [x] Criar layout proprio para a area admin.
- [x] Tirar o admin da navegacao publica.
- [x] Manter o publico apenas com elementos de leitura.
- [ ] Definir URL separada para o admin, se desejado.

### Fase 4: Autenticacao Mais Segura

- [x] Substituir o uso de `ADMIN_TOKEN` salvo no navegador por login administrativo real.
- [x] Usar sessao segura no backend.
- [x] Definir expiracao e logout.
- [x] Melhorar a auditoria de acesso.

### Fase 5: Organizacao Final Do Projeto

- [ ] Separar apps no monorepo.
- [ ] Compartilhar apenas o que for reutilizavel.
- [ ] Revisar rotas publicas e privadas.
- [ ] Atualizar README e demais documentos.

## Decisoes Ja Tomadas

- O download CSV nao fica mais no site publico.
- O admin continua necessario para exportacao.
- O backend segue unico.
- A separacao sera feita por interface e permissao, nao por duplicacao de banco.

## Prioridade Recomendada

```txt
1. Remover download do site publico
2. Proteger exportacao no backend
3. Separar interface admin
4. Trocar autenticacao simples por login real
5. Refinar organizacao do monorepo
```

## Criterio Para Considerar Concluido

- O site publico nao exibe exportacao CSV.
- A exportacao funciona apenas na area admin.
- As rotas administrativas ficam protegidas no servidor.
- O publico nao tem acesso a operacoes sensiveis.
- A documentacao do projeto descreve a nova divisao com clareza.
