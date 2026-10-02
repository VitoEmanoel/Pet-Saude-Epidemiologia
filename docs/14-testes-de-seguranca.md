# 14. Testes de segurança

Campanha de 02/10/2026, feita **antes de publicar** o sistema e depois de concluída a Fase 2 do [plano](12-plano-de-acao.md). Alvo: o sistema rodando no Docker desta máquina (site `localhost:3000`, API `localhost:3333`, banco `localhost:5433`), com dados reais. Nada foi testado contra servidores de terceiros.

## 14.1 Abordagens

| Tipo de teste | Como funciona? | Objetivo prático |
|---|---|---|
| **Caixa preta** (*black box*) | O testador só conhece o endereço do site, como um atacante na internet. Envia requisições malformadas, maliciosas ou fora de ordem e observa as respostas. | Descobrir o que qualquer pessoa consegue explorar **sem senha e sem ler o código**: injeção, rotas sem proteção, arquivos expostos, erros que vazam informação. |
| **Caixa cinza** (*gray box*) | O testador tem parte do conhecimento: a senha do admin, o formato do cookie de sessão e a lista de rotas. Testa o que acontece **depois do login** e nas regras do sistema. | Verificar sessão (logout, expiração, cookie roubado), CSRF, XSS armazenado no painel, condições de corrida e regras de negócio que só aparecem com acesso. |
| **Caixa branca** (*white box*) | O testador lê o código-fonte, o `Dockerfile` e a configuração, e roda análise estática e varredura de dependências. | Achar o que não aparece de fora: SQL montado com texto, comparação de senha insegura, dependências e imagens vulneráveis, segredos no git, configuração frágil. |
| **Varredura automatizada (DAST)** | Ferramentas de mercado atacam o sistema rodando com milhares de testes prontos. | Cobrir em larga escala o que testes manuais deixariam passar e comparar com padrões do mercado. |
| **Análise estática e de composição (SAST/SCA)** | Ferramentas leem o código e a lista de pacotes procurando padrões inseguros e falhas conhecidas (CVEs). | Garantir que o código não usa construções perigosas e que nenhuma biblioteca ou imagem tem vulnerabilidade conhecida. |

## 14.2 Ferramentas

| Ferramenta | Tipo | O que fez aqui |
|---|---|---|
| Suíte própria `tests/security/owasp.test.mjs` | Preta, cinza e branca | 43 testes por categoria OWASP (ver §14.3) |
| **OWASP ZAP** 2.17 | DAST | Varredura ativa da API pelas 16 rotas descritas em `tests/security/openapi.json`, inclusive as do admin **com sessão válida**; varredura completa do site com navegador (AJAX spider) |
| **sqlmap** 1.10 | DAST (injeção SQL) | Todos os parâmetros públicos e cabeçalhos (`User-Agent`, `Referer`, `Host`), nível 5, risco 3, todas as técnicas (booleana, erro, UNION, empilhada, tempo, inline) |
| **Nuclei** | DAST (vulnerabilidades conhecidas) | Milhares de modelos de CVEs, painéis expostos e más configurações contra o site e a API |
| **nmap** | Rede | Portas abertas e serviços na máquina |
| **Trivy** | SCA + configuração + segredos | `package-lock.json`, `Dockerfile`, segredos no repositório e as 3 imagens Docker (sistema operacional e Node.js) |
| **Semgrep** | SAST | Regras de JavaScript, TypeScript, Node.js, Express, React, segredos e Dockerfile |
| Playwright (navegador real) | Cinza | XSS armazenado: payload gravado na auditoria e aberto no painel do admin |

Como repetir: `npm run test:security` (suíte, segundos) e `npm run test:security:scan` (ferramentas, ~25 min; ver [13](13-testes.md)).

## 14.3 O que foi testado e resultado

### A03 Injeção

| Teste | Abordagem | Resultado |
|---|---|---|
| SQL injection clássica, UNION, empilhada e por tempo (`pg_sleep`) em todos os filtros | Preta + sqlmap nível 5 | **Protegido**. Respostas em 3–5 ms, nenhum parâmetro injetável |
| SQL injection no caminho (`/api/sources/<slug>`) | Preta | **Protegido** (404) |
| Operadores NoSQL (`source[$ne]=`, `{"$ne": null}` no login) | Preta | **Protegido**: objetos são ignorados ou recusados |
| Poluição de protótipo (`__proto__`) no login | Preta | **Protegido** |
| Injeção de comando e de template (`$(id)`, `{{7*7}}`) | Preta | **Protegido**: nada é executado |
| Injeção de cabeçalho (CRLF) | Preta | **Protegido** |
| XSS refletido na exportação HTML (5 filtros) | Cinza + Semgrep | **Protegido**: tudo é escapado, o arquivo vai como anexo e a CSP da API bloqueia scripts. Os 3 alertas do Semgrep são falsos positivos |
| XSS armazenado (usuário e navegador gravados na auditoria) | Cinza + navegador | **Protegido**: o painel mostra o payload como texto; nada executa |
| Código: SQL montado com texto, `eval`, execução de comandos | Branca | **Nenhum uso**. Todas as consultas passam pelo Prisma com parâmetros; o login nem consulta o banco |

### A01 Controle de acesso

| Teste | Abordagem | Resultado |
|---|---|---|
| Todas as rotas do admin (5 GET, 3 POST) sem sessão | Preta | **Protegido** (401) |
| Contornar a autenticação com variações do caminho (`/API/ADMIN`, `//api`, `%61`, `;`, `%00`, `../`) | Preta | **Protegido** (401/404) |
| Métodos não previstos (PUT, DELETE, PATCH, TRACE) | Preta | **Protegido** |
| Cookie forjado, vazio, sem assinatura, expirado ou adulterado | Preta + cinza | **Protegido** |
| Filtrar outro município com outras grafias (`City`, `CIDADE`, `uf`...) | Preta | **Protegido** (400) |
| Exportação pública de dados | Preta | **Protegido**: só existe no admin |
| CORS de origem estranha | Cinza | **Protegido** |
| CSRF: POST do admin vindo de outro site, com sessão válida | Cinza | **Protegido** (403 + cookie `SameSite=Strict`) |
| Ações do admin por GET (mudança de estado por link) | Cinza | **Protegido** (404) |
| Código: alguma rota do admin antes da checagem de sessão | Branca | Só o login, como esperado |
| Fonte interna (zika) pelas rotas públicas | Preta | **Achado S12**: bloqueada em 3 rotas, mas visível em `/api/records?source=zika_sinan` |

### A07 Autenticação e sessão

| Teste | Abordagem | Resultado |
|---|---|---|
| Descobrir se um usuário existe pela mensagem de erro | Preta | **Protegido**: mensagem igual |
| Login por formulário ou `text/plain` (CSRF simples) | Preta | **Protegido** |
| Força bruta (5 erros → bloqueio de 15 min por IP real) | Preta | **Protegido** (ver S4/S5) |
| Atributos do cookie (`HttpOnly`, `SameSite=Strict`, `Path=/api/admin`, 8 h, `Secure` em HTTPS) | Cinza | **Correto** |
| Cookie novo a cada login | Cinza | **Correto** |
| Cookie copiado antes do logout continua valendo | Cinza | **Achado S11**, corrigido: sessão guardada no servidor e revogada no logout |
| Comparação de senha e token | Branca | **Achado S16** (tamanho revelado por tempo; token Bearer com `===`) |

### A05 Configuração e A04 lógica de negócio

| Teste | Abordagem | Resultado |
|---|---|---|
| Arquivos internos (`.env`, `.git`, `package.json`, `Dockerfile`) | Preta | **Protegido** |
| Source maps do frontend | Preta | **Não publicados** |
| Paginação abusiva (`pageSize=1000000`, página negativa) | Preta | **Protegido** (teto de 500) |
| Parâmetro repetido (`year=2020&year=2021`) | Preta | Usa o primeiro; sem erro |
| Valores inválidos (`year=abc`) | Preta | **Achado S14**: ignorados em silêncio |
| 3 sincronizações simultâneas da mesma fonte | Cinza | **Protegido**: 1 roda, 2 recebem 409, nada duplica |
| `.env` e chaves fora do git; segredos no histórico | Branca + Trivy | **Correto** (só exemplos da documentação no histórico) |
| Containers sem root; banco só em `127.0.0.1` | Branca | **Correto** |
| Imagens Docker | Trivy | **Achado S13**: Node 20 sem suporte; 22 falhas altas/críticas nas imagens |
| Senhas da configuração | Branca | Admin e segredo de sessão fortes; banco com a senha padrão `postgres` (**achado S15**, corrigido: em servidor o `start` recusa e o backend avisa) |
| Limite de requisições na API pública | Preta | **Achado S17**, corrigido: 600/min por IP real (configurável) |

### Varreduras automatizadas

| Ferramenta | Resultado |
|---|---|
| ZAP na API | 117 regras: **0 falhas**. Avisos: IP privado na auditoria (esperado: é o IP do admin, só ele vê) e tipo de conteúdo em `export.csv/` |
| ZAP no site | 138 regras: **0 falhas**. Avisos: `unsafe-inline` na CSP (concessão documentada em [07 §7.5](07-frontend.md#75-cabeçalhos-de-segurança)), site em HTTP (local; HTTPS no [checklist](02-instalacao-e-execucao.md#28-checklist-de-publicação)), cabeçalhos COOP/CORP/COEP ausentes (**S18**) e avisos sobre as imagens do OpenStreetMap (servidor de terceiros, fora do nosso controle) |
| sqlmap | **Nenhum parâmetro injetável** |
| Nuclei | **Nenhuma vulnerabilidade**; só avisos informativos (os mesmos cabeçalhos do ZAP) |
| nmap | Sistema expõe 3000 e 3333 (rede) e 5433 (só local). As outras portas da máquina são de outros programas |
| Trivy (código) | **0 vulnerabilidades** em dependências; **0 segredos**; `Dockerfile` 26/27 (falta `HEALTHCHECK`, **S18**) |
| Trivy (imagens) | Ver S13. **Após a correção:** backend e frontend sem falhas médias, altas ou críticas; `postgres:16-alpine` só com falhas no `gosu` (risco aceito, ver plano) |
| Semgrep | 7 alertas, **todos falsos positivos** ou informativos (XSS nas exportações já escapadas; senhas fictícias do arquivo de teste) |

## 14.4 Achados

| Código | Achado | Gravidade | Abordagem que achou |
|---|---|---|---|
| **S13** | Imagens com **Node.js 20, sem suporte desde 30/04/2026**. O Trivy encontrou 1 falha crítica e 21 altas no `npm` da imagem e 4 altas no OpenSSL do Alpine. Não vêm do nosso código, mas ficam no servidor | **Alta** | Branca (Trivy) |
| **S11** | Logout não invalida a sessão: um cookie copiado antes do logout continua valendo até 8 h | **Média** | Cinza |
| **S17** | API pública sem limite de requisições; numa VPS de 1 CPU, um único script pode deixar o painel lento | **Média** | Preta |
| **S15** | Senha padrão `postgres` no banco é aceita também em servidor (hoje o banco só escuta em `127.0.0.1`) | **Média** (em produção) | Branca |
| **S12** | Fonte interna `zika_sinan` aparece em `/api/records` (as outras rotas públicas a bloqueiam). Os dados são públicos no DATASUS, mas foge da regra do sistema | Baixa | Preta |
| **S14** | Valores inválidos de filtro (`year=abc`) são ignorados em silêncio em vez de devolver 400 | Baixa | Preta |
| **S16** | `safeEqual` sai antes quando os tamanhos diferem (revela o tamanho do usuário/senha por tempo); token Bearer comparado com `===` (desligado por padrão) | Baixa | Branca |
| **S18** | Site sem `Cross-Origin-Opener-Policy`/`Cross-Origin-Resource-Policy`; `Dockerfile` sem `HEALTHCHECK` | Baixa | ZAP, Nuclei, Trivy |

**Observações sem defeito:**
- **Força bruta distribuída:** o bloqueio é por IP. Muitos IPs diferentes poderiam tentar 5 senhas cada, mas a senha do admin é aleatória e longa, o que torna isso inviável.
- **Senha com espaço:** o frontend remove espaços do começo e do fim da senha digitada, então não use senhas que comecem ou terminem com espaço.

As correções estão no [plano](12-plano-de-acao.md), Fase 2B, e os problemas abertos em [11](11-limitacoes-conhecidas.md). Cada achado tem um teste `todo` em `tests/security/owasp.test.mjs` que passa a ser obrigatório quando for corrigido.
