> **Especificação original do projeto.** Registro dos requisitos definidos no início. O escopo implementado é menor (6 doenças em vez de 13 fontes) e alguns detalhes mudaram: o sistema como funciona hoje está descrito nos documentos 01 a 12 ([índice](README.md)).

# Projeto: Painel Epidemiológico de Parnaíba - PI

## 1. Objetivo do sistema

Criar um site próprio para visualização de dados epidemiológicos e de morbidade relacionados **somente ao município de Parnaíba, no estado do Piauí**.

O sistema deve ser inspirado visualmente em painéis epidemiológicos como o EpiRio, porém **não deve usar Power BI** e **não deve depender de exportação manual de tabelas**.

A plataforma deve coletar os dados públicos disponíveis no DATASUS/TABNET, salvar esses dados em um banco de dados próprio e exibir as informações em um site moderno, organizado e interativo.

---

## 2. Regra principal do projeto

O sistema deve coletar, armazenar e exibir **somente dados de Parnaíba - PI**.

Não coletar dados de outros municípios.

Não coletar dados de outros estados.

Não coletar dados nacionais, estaduais ou regionais, exceto quando forem necessários apenas como referência interna para localizar Parnaíba.

Filtro obrigatório:

```txt
Estado: Piauí
UF: PI
Município: Parnaíba
Código IBGE do município: 2207702
```

Sempre que o DATASUS/TABNET oferecer filtros como município de residência, município de notificação, município de atendimento ou município de ocorrência, o sistema deve priorizar a coleta relacionada a **Parnaíba - PI**.

Caso uma fonte não permita filtro por município, o sistema deve marcar essa fonte como:

```txt
Dados municipais indisponíveis para Parnaíba nesta fonte
```

O sistema nunca deve inventar, estimar ou aproximar dados.

---

## 3. Fontes permitidas

Usar exclusivamente a seção **Epidemiológicas e Morbidade** do DATASUS/TABNET.

Não usar dados de outras seções, como:

* Assistência à Saúde;
* Rede Assistencial;
* Estatísticas Vitais;
* Demográficas e Socioeconômicas;
* Inquéritos e Pesquisas;
* Saúde Suplementar;
* Informações Financeiras.

As únicas fontes permitidas são:

1. Morbidade Hospitalar do SUS — SIH/SUS
2. Casos de Aids — Desde 1980 — SINAN
3. Casos de Hanseníase — Desde 2001 — SINAN
4. Casos de Tuberculose — Desde 2001 — SINAN
5. Doenças e Agravos de Notificação — 2007 em diante — SINAN
6. Doenças e Agravos de Notificação — 2001 a 2006 — SINAN
7. Notificações de casos suspeitos de SCZ — Desde 2015
8. Programa de Controle da Esquistossomose — PCE
9. Estado Nutricional — SISVAN
10. Hipertensão e Diabetes — HIPERDIA
11. Câncer de colo de útero e mama — SISCOLO/SISMAMA
12. Sistema de Informação do Câncer — SISCAN
13. Tempo até o início do tratamento oncológico — Painel Oncologia

### 3.1 Casos obrigatorios do projeto

O sistema deve entregar estes casos:

1. Tuberculose
2. Hanseníase
3. Dengue
4. Arboviroses em geral
5. Sífilis Congênita
6. Sífilis Gestacional

### 3.2 Escopo atual do projeto

As fontes realmente ativas no sistema hoje são:

1. Casos de Tuberculose — Desde 2001 — SINAN
2. Casos de Hanseníase — Desde 2001 — SINAN
3. Notificações de casos suspeitos de Sífilis Congênita — SINAN
4. Casos de Dengue — SINAN
5. Arboviroses em geral — visão agregada do painel baseada em Dengue e Zika
6. Casos de Sífilis Gestacional — SINAN

Essas são as fontes integradas ao produto atual.

No estado atual do sistema:

- Tuberculose, Hanseníase, Sífilis Congênita, Dengue e Sífilis Gestacional possuem coleta automatica validada no DATASUS/TABNET.
- Arboviroses em geral ja aparece operacionalmente no painel, mas como composicao derivada de fontes integradas, e nao como uma tabela unica independente do DATASUS/TABNET.
- Zika ja e usada internamente para compor a visao de arboviroses, mas nao aparece como caso publico obrigatorio do menu.

### 3.3 Escopo futuro

Os casos abaixo ainda precisam ser validados e implementados para Parnaíba - PI:

1. Inclusão de Chikungunya na visão de Arboviroses em geral

Observacao importante:

- Dengue ja foi validada e implementada.
- Sífilis Gestacional ja foi validada e implementada.
- Arboviroses em geral ja existe no produto, mas ainda precisa ser ampliada para cobrir mais do que Dengue e Zika.

---

## 4. Ideia geral do funcionamento

O site deve funcionar da seguinte forma:

```txt
DATASUS/TABNET
      ↓
Coletor de dados do backend
      ↓
Filtro obrigatório: Parnaíba - PI
      ↓
Tratamento e normalização dos dados
      ↓
Banco de dados PostgreSQL
      ↓
API própria do sistema
      ↓
Frontend com dashboards, gráficos, mapas e tabelas
```

O frontend não deve acessar o DATASUS diretamente.

Toda coleta deve ser feita pelo backend.

O backend deve consultar o DATASUS/TABNET, filtrar somente Parnaíba - PI, tratar os dados e salvar no banco.

O site deve consumir apenas a API própria do sistema.

---

## 5. Tecnologias recomendadas

### Frontend

Usar:

* Next.js
* React
* TypeScript
* Tailwind CSS
* ECharts, ApexCharts ou Chart.js
* Leaflet para mapa
* Axios ou Fetch API para consumir a API

### Backend

Usar:

* Node.js
* NestJS ou Express
* TypeScript
* Prisma ORM
* PostgreSQL
* Redis para cache
* Cron Jobs para atualização automática dos dados

### Banco de dados

Usar:

* PostgreSQL

---

## 6. Funcionalidades principais do site

O sistema deve ter:

* Página inicial com visão geral de Parnaíba - PI;
* Menu lateral com as fontes epidemiológicas permitidas;
* Página individual para cada fonte;
* Cards com indicadores principais;
* Gráficos de evolução anual;
* Gráficos por sexo, faixa etária, raça/cor e agravo, quando disponível;
* Tabela filtrável;
* Histórico de atualização;
* Página administrativa para sincronizar os dados;
* Atualização automática por agendamento;
* Exportação dos dados tratados em CSV ou Excel;
* Aviso claro quando determinada fonte não tiver dados municipais disponíveis para Parnaíba.

---

## 7. Layout desejado

O site deve ter uma aparência moderna, limpa e institucional.

### Cores sugeridas

* Verde saúde;
* Azul institucional;
* Branco;
* Cinza claro;
* Detalhes em laranja ou azul escuro.

### Estrutura da página inicial

```txt
[Header]
Painel Epidemiológico de Parnaíba - PI
Dados públicos do DATASUS — Epidemiológicas e Morbidade

[Cards principais]
- Total de registros coletados
- Última atualização
- Fontes disponíveis
- Fontes com dados municipais
- Fontes sem dados municipais

[Gráfico geral]
Evolução anual dos principais indicadores

[Mapa]
Mapa destacando Parnaíba - PI

[Menu lateral]
- Visão geral
- Morbidade Hospitalar
- Aids
- Hanseníase
- Tuberculose
- Agravos de Notificação
- SCZ
- Esquistossomose
- SISVAN
- HIPERDIA
- SISCOLO/SISMAMA
- SISCAN
- Oncologia
```

---

## 8. Página individual de cada fonte

Cada fonte deve ter sua própria página.

Exemplo:

```txt
/tuberculose
/hanseniase
/aids
/morbidade-hospitalar
/sisvan
/hiperdia
/oncologia
```

Cada página deve conter:

```txt
Título da fonte
Descrição curta
Última atualização
Status da coleta
Filtros disponíveis
Cards de resumo
Gráficos
Tabela detalhada
Botão de exportação
```

Exemplo para Tuberculose:

```txt
Título: Casos de Tuberculose em Parnaíba - PI

Cards:
- Total de casos
- Ano com maior número de registros
- Último ano disponível
- Variação em relação ao ano anterior

Gráficos:
- Casos por ano
- Casos por sexo
- Casos por faixa etária
- Casos por raça/cor

Tabela:
- Ano
- Município
- Agravo
- Sexo
- Faixa etária
- Raça/cor
- Quantidade
- Fonte
- Data de importação
```

---

## 9. Estrutura inicial do banco de dados

Criar tabelas para armazenar fontes, sincronizações e registros epidemiológicos.

```sql
CREATE TABLE data_sources (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    system VARCHAR(100),
    category VARCHAR(100) NOT NULL DEFAULT 'epidemiologicas_morbidade',
    source_url TEXT,
    municipality_filter_available BOOLEAN DEFAULT FALSE,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE sync_jobs (
    id SERIAL PRIMARY KEY,
    source_id INTEGER REFERENCES data_sources(id),
    status VARCHAR(50),
    started_at TIMESTAMP,
    finished_at TIMESTAMP,
    records_imported INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE epidemiological_records (
    id SERIAL PRIMARY KEY,
    source_id INTEGER REFERENCES data_sources(id),

    state VARCHAR(100) NOT NULL DEFAULT 'Piauí',
    state_code VARCHAR(2) NOT NULL DEFAULT 'PI',
    city VARCHAR(100) NOT NULL DEFAULT 'Parnaíba',
    city_ibge_code VARCHAR(20) NOT NULL DEFAULT '2207702',

    year INTEGER,
    month INTEGER,

    disease_or_condition VARCHAR(255),
    metric VARCHAR(100),
    value NUMERIC,

    sex VARCHAR(50),
    age_group VARCHAR(100),
    race_color VARCHAR(100),

    source_table VARCHAR(255),
    imported_at TIMESTAMP DEFAULT NOW(),

    UNIQUE (
        source_id,
        city_ibge_code,
        year,
        month,
        disease_or_condition,
        metric,
        sex,
        age_group,
        race_color
    )
);
```

---

## 10. Regras do coletor de dados

O coletor deve obedecer às seguintes regras:

1. Coletar somente dados da seção Epidemiológicas e Morbidade.
2. Coletar somente dados de Parnaíba - PI.
3. Usar o código IBGE 2207702 quando disponível.
4. Não coletar dados de outros municípios.
5. Não coletar dados de outras categorias do DATASUS.
6. Não misturar fontes diferentes.
7. Registrar de qual fonte cada dado veio.
8. Registrar a data e hora da coleta.
9. Evitar duplicidade de registros.
10. Normalizar nomes de colunas.
11. Normalizar valores como sexo, faixa etária, raça/cor, ano e município.
12. Armazenar logs de erro.
13. Permitir reprocessar uma fonte específica.
14. Caso a fonte não permita filtro municipal, marcar como indisponível.
15. Nunca exibir dados estimados como se fossem dados oficiais.

---

## 11. Lista fixa de fontes permitidas no backend

Criar uma lista fixa no backend para impedir coleta indevida.

```ts
const ALLOWED_CITY = {
  name: "Parnaíba",
  state: "Piauí",
  uf: "PI",
  ibgeCode: "2207702"
};

const ALLOWED_DATASUS_CATEGORY = "epidemiologicas_morbidade";

const allowedSources = [
  {
    slug: "morbidade_hospitalar_sih_sus",
    name: "Morbidade Hospitalar do SUS",
    system: "SIH/SUS"
  },
  {
    slug: "aids_sinan",
    name: "Casos de Aids",
    system: "SINAN"
  },
  {
    slug: "hanseniase_sinan",
    name: "Casos de Hanseníase",
    system: "SINAN"
  },
  {
    slug: "tuberculose_sinan",
    name: "Casos de Tuberculose",
    system: "SINAN"
  },
  {
    slug: "agravos_notificacao_2007",
    name: "Doenças e Agravos de Notificação — 2007 em diante",
    system: "SINAN"
  },
  {
    slug: "agravos_notificacao_2001_2006",
    name: "Doenças e Agravos de Notificação — 2001 a 2006",
    system: "SINAN"
  },
  {
    slug: "scz_2015",
    name: "Notificações de casos suspeitos de SCZ",
    system: "SCZ"
  },
  {
    slug: "pce_esquistossomose",
    name: "Programa de Controle da Esquistossomose",
    system: "PCE"
  },
  {
    slug: "sisvan_estado_nutricional",
    name: "Estado Nutricional",
    system: "SISVAN"
  },
  {
    slug: "hiperdia",
    name: "Hipertensão e Diabetes",
    system: "HIPERDIA"
  },
  {
    slug: "siscolo_sismama",
    name: "Câncer de colo de útero e mama",
    system: "SISCOLO/SISMAMA"
  },
  {
    slug: "siscan",
    name: "Sistema de Informação do Câncer",
    system: "SISCAN"
  },
  {
    slug: "painel_oncologia",
    name: "Tempo até o início do tratamento oncológico",
    system: "Painel Oncologia"
  }
];
```

---

## 12. Rotas da API

Criar as seguintes rotas:

```txt
GET /api/sources
```

Retorna as fontes disponíveis.

```txt
GET /api/sources/:slug
```

Retorna informações de uma fonte específica.

```txt
GET /api/dashboard/overview
```

Retorna a visão geral de Parnaíba - PI.

```txt
GET /api/records
```

Retorna registros filtrados.

Parâmetros permitidos:

```txt
source
year
month
sex
ageGroup
raceColor
condition
```

Não permitir filtro por outro município.

O município deve ser sempre Parnaíba - PI.

```txt
GET /api/charts/yearly-evolution?source=tuberculose_sinan
```

Retorna evolução anual.

```txt
GET /api/charts/by-sex?source=tuberculose_sinan
```

Retorna gráfico por sexo.

```txt
GET /api/charts/by-age-group?source=tuberculose_sinan
```

Retorna gráfico por faixa etária.

```txt
POST /api/admin/sync/:sourceSlug
```

Executa sincronização manual de uma fonte específica.

```txt
POST /api/admin/sync-all
```

Executa sincronização de todas as fontes permitidas.

```txt
GET /api/admin/sync-history
```

Retorna histórico de sincronizações.

---

## 13. Exemplo de resposta da API

```json
{
  "city": {
    "name": "Parnaíba",
    "state": "Piauí",
    "uf": "PI",
    "ibgeCode": "2207702"
  },
  "source": {
    "slug": "tuberculose_sinan",
    "name": "Casos de Tuberculose",
    "system": "SINAN"
  },
  "summary": {
    "totalRecords": 1250,
    "lastAvailableYear": 2024,
    "lastUpdate": "2026-06-13",
    "municipalityDataAvailable": true
  },
  "charts": {
    "yearlyEvolution": [
      {
        "year": 2020,
        "value": 230
      },
      {
        "year": 2021,
        "value": 250
      },
      {
        "year": 2022,
        "value": 270
      }
    ]
  }
}
```

---

## 14. Estrutura de pastas sugerida

```txt
painel-epidemiologico-parnaiba/
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   ├── services/
│   │   ├── hooks/
│   │   ├── types/
│   │   └── utils/
│   └── package.json
│
├── backend/
│   ├── src/
│   │   ├── modules/
│   │   │   ├── datasus/
│   │   │   ├── sources/
│   │   │   ├── records/
│   │   │   ├── dashboard/
│   │   │   └── admin/
│   │   ├── database/
│   │   ├── jobs/
│   │   ├── utils/
│   │   └── main.ts
│   │
│   ├── prisma/
│   │   └── schema.prisma
│   │
│   └── package.json
│
├── docker-compose.yml
├── README.md
└── .env.example
```

---

## 15. Página administrativa

Criar uma área administrativa simples para controlar a coleta dos dados.

Funcionalidades:

* Ver todas as fontes permitidas;
* Ver status de cada fonte;
* Ver última sincronização;
* Rodar sincronização manual;
* Ver erros de coleta;
* Ver quantos registros foram importados;
* Ativar ou desativar fonte;
* Ver se a fonte possui dados municipais para Parnaíba.

---

## 16. Atualização automática

Criar agendamento para atualizar os dados periodicamente.

Sugestão:

```txt
Atualização automática mensal
Dia 5 de cada mês
Horário: 02:00
```

Também permitir atualização manual pela área administrativa.

---

## 17. Cuidados importantes

O DATASUS/TABNET pode não funcionar como uma API REST moderna.

Por isso, o sistema deve ter um módulo de coleta capaz de:

* Acessar as páginas do TABNET;
* Enviar parâmetros de consulta;
* Baixar os dados retornados;
* Ler HTML, CSV, DBF ou outros formatos disponíveis;
* Transformar os dados em JSON;
* Salvar no PostgreSQL;
* Registrar erros de coleta.

O sistema deve ser preparado para lidar com mudanças na estrutura das páginas do DATASUS.

---

## 18. Mensagens de transparência no site

O site deve exibir mensagens claras para o usuário.

Exemplo:

```txt
Os dados apresentados neste painel são públicos e foram coletados do DATASUS/TABNET, considerando exclusivamente registros disponíveis para Parnaíba - PI.
```

Quando uma fonte não tiver dados municipais:

```txt
Esta fonte não disponibiliza consulta municipal para Parnaíba - PI no formato acessado pelo sistema.
```

Quando houver erro na sincronização:

```txt
Não foi possível atualizar esta fonte no momento. Os dados exibidos correspondem à última coleta realizada com sucesso.
```

---

## 19. O que não deve ser feito

Não usar Power BI.

Não exportar tabela manualmente.

Não coletar dados de outros municípios.

Não coletar dados de outros estados.

Não coletar dados de outras seções do DATASUS.

Não misturar dados de fontes diferentes sem identificação.

Não inventar dados ausentes.

Não mostrar dados estaduais como se fossem municipais.

Não permitir que o usuário altere o município para outra cidade.

Não deixar o frontend consultar o DATASUS diretamente.

---

## 20. Resultado esperado

Ao final, o sistema deve entregar um site completo chamado **Painel Epidemiológico de Parnaíba - PI**, com dados públicos coletados do DATASUS/TABNET, armazenados em banco de dados próprio e apresentados em dashboards modernos.

O sistema deve permitir visualizar apenas informações relacionadas a Parnaíba - PI, com filtros, gráficos, tabelas, histórico de atualização e controle administrativo de sincronização.

O projeto deve ser construído com foco em clareza, confiabilidade, organização dos dados e transparência sobre a origem das informações.
