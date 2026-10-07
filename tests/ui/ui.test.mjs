// Testes de interface, usabilidade e acessibilidade (Playwright).
// Navegador: QA_BROWSER=chromium (padrão) | firefox | webkit.
// WebKit não roda direto no Arch Linux; ver docs/13-testes.md.
import assert from "node:assert/strict";
import { mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { after, before, describe, test } from "node:test";
import pw from "playwright-core";
import { ADMIN_PASSWORD, ADMIN_USERNAME, API, OUTPUT, WEB, assertSystemUp } from "../support/env.mjs";

const BROWSER = process.env.QA_BROWSER ?? "chromium";
// Prefixo do site quando ele não mora na raiz (ex.: QA_WEB_URL=http://localhost:8088/painel).
const BASE = new URL(WEB).pathname.replace(/\/+$/, "");
const SHOTS = `${OUTPUT}screenshots/${BROWSER}/`;
const axeSource = readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");

const DISEASE_PAGES = ["/tuberculose", "/hanseniase", "/sifilis", "/dengue", "/zika", "/chikungunya", "/sifilis-gestacional"];
const PAGES = ["/", ...DISEASE_PAGES, "/admin"];
const PROFILES = {
  desktop: { viewport: { width: 1440, height: 900 } },
  celular: BROWSER === "webkit" ? pw.devices["iPhone 15"] : { viewport: { width: 390, height: 844 } }
};

let browser;

before(async () => {
  await assertSystemUp();
  mkdirSync(SHOTS, { recursive: true });
  // "localhost" resolve primeiro para IPv6 (::1), mas o Docker publica as portas só em IPv4:
  // o Firefox às vezes travava 30 s nessa recuperação. Aqui ele vai direto ao IPv4.
  browser = await pw[BROWSER].launch(
    BROWSER === "firefox" ? { firefoxUserPrefs: { "network.dns.disableIPv6": true } } : {}
  );
});

after(async () => {
  await browser?.close();
});

/** Espera a rede assentar, no máximo 10 s (o mapa depende do OpenStreetMap, externo e às vezes lento). */
const settle = (page) => page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});

async function newPage(profile) {
  const context = await browser.newContext({ ...PROFILES[profile], locale: "pt-BR" });
  // Registra bloqueios da CSP (S2): um recurso bloqueado indica regra apertada demais.
  await context.addInitScript(() => {
    window.__cspViolations = [];
    document.addEventListener("securitypolicyviolation", (event) =>
      window.__cspViolations.push(`${event.effectiveDirective} ${event.blockedURI}`)
    );
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return { context, page, errors };
}

async function openPage(profile, path) {
  // O Firefox automatizado, em rodadas longas, às vezes trava a navegação (o servidor responde em
  // ~2 ms; isolado o mesmo teste passa). Se a página não abrir em 15 s, tenta uma vez numa sessão nova.
  for (let attempt = 1; ; attempt += 1) {
    const opened = await newPage(profile);
    try {
      await opened.page.goto(WEB + path, { waitUntil: "domcontentloaded", timeout: attempt === 1 ? 15_000 : 30_000 });
    } catch (error) {
      await opened.context.close();
      if (attempt === 1 && error?.name === "TimeoutError") {
        continue;
      }
      throw error;
    }
    // O mapa busca imagens no OpenStreetMap (externo, às vezes lento): espera limitada.
    await settle(opened.page);
    await opened.page.waitForTimeout(800);
    return opened;
  }
}

const shotName = (profile, path) => `${SHOTS}${profile}${path === "/" ? "_inicio" : path.replace(/\//g, "_")}.png`;

for (const profile of Object.keys(PROFILES)) {
  describe(`Páginas (${BROWSER}, ${profile})`, () => {
    for (const path of PAGES) {
      test(`${path} carrega sem erro, sem rolagem horizontal, com gráficos`, async () => {
        const { context, page, errors } = await openPage(profile, path);
        try {
          const info = await page.evaluate(() => ({
            overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
            canvases: [...document.querySelectorAll("canvas")].filter((c) => c.width > 0).length,
            tiles: document.querySelectorAll(".leaflet-tile-loaded").length,
            apiError: /API indispon[ií]vel/i.test(document.body.innerText),
            lang: document.documentElement.lang,
            cspViolations: window.__cspViolations
          }));
          await page.screenshot({ path: shotName(profile, path), fullPage: true });
          assert.deepEqual(errors, [], "erros de JavaScript");
          assert.deepEqual(info.cspViolations, [], "bloqueios da CSP");
          assert.equal(info.overflow, false, "rolagem horizontal");
          assert.equal(info.apiError, false, "página mostra API indisponível");
          assert.equal(info.lang, "pt-BR");
          if (DISEASE_PAGES.includes(path)) {
            // 4 gráficos + 1 do painel de indicadores em dengue, zika e chikungunya (A6).
            const arbovirus = ["/dengue", "/zika", "/chikungunya"].includes(path);
            assert.equal(info.canvases, arbovirus ? 5 : 4, "gráficos");
            assert.ok(info.tiles > 0, "mapa carregado");
          }
          if (path === "/") {
            assert.ok(info.canvases >= 1, "gráfico da visão geral");
          }
        } finally {
          await context.close();
        }
      });

      test(`${path}: acessibilidade WCAG 2 A/AA (inclui contraste, U2)`, async () => {
        const { context, page } = await openPage(profile, path);
        try {
          await page.addScriptTag({ content: axeSource });
          const violations = await page.evaluate(async () =>
            (await window.axe.run(document, { runOnly: ["wcag2a", "wcag2aa"] })).violations
              .map((v) => `${v.id} (${v.nodes.length})`)
          );
          assert.deepEqual(violations, []);
        } finally {
          await context.close();
        }
      });
    }
  });

  describe(`Fluxos públicos (${BROWSER}, ${profile})`, () => {
    test("Filtro de ano 2024 mostra os 86 casos de tuberculose; Limpar restaura", async () => {
      const { context, page } = await openPage(profile, "/tuberculose");
      try {
        await page.locator("select").nth(0).selectOption("2024");
        await settle(page);
        await page.waitForTimeout(600);
        assert.match(await page.innerText("main"), /\b86\b/);
        await page.getByRole("button", { name: /limpar/i }).first().click();
        await page.waitForTimeout(400);
        assert.equal(await page.locator("select").nth(0).inputValue(), "");
      } finally {
        await context.close();
      }
    });

    test("D6: cartão Registros acompanha a tabela e muda com os filtros", async () => {
      const { context, page } = await openPage(profile, "/tuberculose");
      // Valor do cartão "Registros" e o total do rodapé da tabela ("N registros").
      const read = () =>
        page.evaluate(() => {
          const label = [...document.querySelectorAll("main p")].find((item) => item.textContent === "Registros");
          const card = label?.parentElement?.querySelector("strong")?.textContent ?? "";
          const footer = document.body.innerText.match(/(\d[\d.]*) registros?\b/)?.[1] ?? "";
          return { card: Number(card.replace(/\./g, "")), footer: Number(footer.replace(/\./g, "")) };
        });
      try {
        await page.getByLabel("Detalhar por").selectOption("sex");
        await settle(page);
        await page.waitForTimeout(600);
        const all = await read();
        assert.ok(all.card > 0, "cartão vazio");
        assert.equal(all.card, all.footer, "cartão diferente da tabela");
        await page.locator("select").nth(0).selectOption("2024");
        await settle(page);
        await page.waitForTimeout(600);
        const filtered = await read();
        assert.equal(filtered.card, filtered.footer);
        assert.ok(filtered.card < all.card, `com filtro de ano deveria cair (${all.card} → ${filtered.card})`);
      } finally {
        await context.close();
      }
    });

    if (profile === "celular") {
      test("U7: no celular a lista de registros é compacta (uma linha por registro)", async () => {
        const { context, page } = await openPage(profile, "/tuberculose");
        try {
          const heights = await page.$$eval("main ul.md\\:hidden > li", (items) => items.map((item) => item.getBoundingClientRect().height));
          assert.ok(heights.length > 0, "lista de registros vazia");
          assert.ok(Math.max(...heights) <= 72, `linha alta demais: ${Math.max(...heights)} px`);
        } finally {
          await context.close();
        }
      });
    }

    test("U6: botões, links e campos têm pelo menos 24 px para o toque", async () => {
      const small = [];
      for (const path of ["/", "/dengue", "/admin"]) {
        const { context, page } = await openPage(profile, path);
        try {
          await page.waitForTimeout(1000);
          small.push(
            ...(await page.$$eval("a, button, select, input, textarea, [role=button]", (items) =>
              items
                .filter((item) => !item.classList.contains("sr-only"))
                .map((item) => ({ item, box: item.getBoundingClientRect() }))
                .filter(({ box }) => box.width > 0 && box.height > 0 && (box.width < 24 || box.height < 24))
                .map(({ item, box }) => `${item.tagName} "${(item.getAttribute("aria-label") ?? item.textContent ?? "").trim().slice(0, 30)}" ${Math.round(box.width)}x${Math.round(box.height)}`)
            )).map((text) => `${path}: ${text}`)
          );
        } finally {
          await context.close();
        }
      }
      assert.deepEqual([...new Set(small)], []);
    });

    test("D3: tabela mostra uma visão por vez; filtro de sexo trava o \"Detalhar por\" em sexo", async () => {
      const { context, page } = await openPage(profile, "/tuberculose");
      try {
        const viewSelect = page.getByLabel("Detalhar por");
        assert.equal(await viewSelect.inputValue(), "yearly");
        assert.match(await page.innerText("main"), /Total do ano/);
        await viewSelect.selectOption("race_color");
        await settle(page);
        await page.waitForTimeout(400);
        assert.match(await page.innerText("main"), /Por raça\/cor/);

        const sexOptions = await page.locator("select").nth(1).locator("option").evaluateAll((o) => o.map((x) => x.value).filter(Boolean));
        await page.locator("select").nth(1).selectOption(sexOptions[0]);
        await settle(page);
        await page.waitForTimeout(400);
        assert.equal(await viewSelect.inputValue(), "sex");
        assert.ok(await viewSelect.isDisabled());
      } finally {
        await context.close();
      }
    });

    test("Todos os filtros têm rótulo acessível", async () => {
      const { context, page } = await openPage(profile, "/tuberculose");
      try {
        const labelled = await page.$$eval("select", (selects) =>
          selects.map((s) => Boolean(s.labels?.length || s.getAttribute("aria-label")))
        );
        assert.ok(labelled.length >= 4 && labelled.every(Boolean));
      } finally {
        await context.close();
      }
    });

    test("Paginação da tabela muda o conteúdo", async () => {
      const { context, page } = await openPage(profile, "/tuberculose");
      try {
        const before = await page.innerText("main");
        await page.locator('[title="Próxima página"]').first().click();
        await settle(page);
        await page.waitForTimeout(500);
        assert.notEqual(await page.innerText("main"), before);
      } finally {
        await context.close();
      }
    });

    test("Menu lateral: escondido, abre pelo ☰, fecha com Esc e navega", async () => {
      const { context, page } = await openPage(profile, "/");
      try {
        const drawer = page.locator("#menu-lateral");
        const isOnScreen = async () => ((await drawer.boundingBox())?.x ?? -1000) >= 0;
        assert.equal(await isOnScreen(), false, "menu deveria começar escondido");

        await page.locator('button[aria-label="Abrir menu"]').first().click();
        await page.waitForTimeout(400);
        assert.equal(await isOnScreen(), true, "menu não abriu");
        await page.keyboard.press("Escape");
        await page.waitForTimeout(400);
        assert.equal(await isOnScreen(), false, "Esc não fechou o menu");

        await page.locator('button[aria-label="Abrir menu"]').first().click();
        await page.waitForTimeout(400);
        await drawer.getByRole("link", { name: /dengue/i }).click();
        // Navegação do Next.js não recarrega a página: esperar só a troca de endereço ("commit").
        await page.waitForURL("**/dengue", { waitUntil: "commit" });
        await page.waitForTimeout(400);
        assert.equal(await isOnScreen(), false, "menu continuou aberto após navegar");
      } finally {
        await context.close();
      }
    });

    test("Tema escuro persiste após recarregar", async () => {
      const { context, page } = await openPage(profile, "/tuberculose");
      try {
        // O botão de tema fica no menu lateral.
        await page.locator('button[aria-label="Abrir menu"]').click();
        await page.waitForTimeout(400);
        await page.locator('#menu-lateral button[aria-label="Ativar tema escuro"]').click();
        await page.reload({ waitUntil: "domcontentloaded" });
        await settle(page);
        assert.ok(await page.evaluate(() => document.documentElement.classList.contains("dark")));
      } finally {
        await context.close();
      }
    });

    test("D2: com filtro de sexo, nenhum gráfico fica vazio e os outros gráficos avisam", async () => {
      const { context, page } = await openPage(profile, "/tuberculose");
      try {
        const sexOptions = await page.locator("select").nth(1).locator("option").evaluateAll((o) => o.map((x) => x.value).filter(Boolean));
        await page.locator("select").nth(1).selectOption(sexOptions[0]);
        await settle(page);
        await page.waitForTimeout(600);
        const text = await page.innerText("main");
        assert.doesNotMatch(text, /Sem dados para os filtros/i);
        assert.match(text, /o DATASUS não separa faixa etária por sexo/);
        assert.match(text, /o DATASUS não separa raça\/cor por sexo/);
      } finally {
        await context.close();
      }
    });

    test("D2: escolher faixa etária limpa o filtro de sexo (um filtro demográfico por vez)", async () => {
      const { context, page } = await openPage(profile, "/tuberculose");
      try {
        const options = async (index) => page.locator("select").nth(index).locator("option").evaluateAll((o) => o.map((x) => x.value).filter(Boolean));
        await page.locator("select").nth(1).selectOption((await options(1))[0]);
        await page.locator("select").nth(2).selectOption((await options(2))[0]);
        await settle(page);
        assert.equal(await page.locator("select").nth(1).inputValue(), "");
        assert.notEqual(await page.locator("select").nth(2).inputValue(), "");
      } finally {
        await context.close();
      }
    });
  });
}

describe(`Identidade visual (${BROWSER})`, () => {
  test("U5: favicon, ícone de celular e logo do PET-Saúde carregam", async () => {
    for (const path of ["/favicon.ico", "/apple-icon.png", "/img/logo-simbolo.png", "/img/logo-texto-embaixo.png"]) {
      const response = await fetch(WEB + path);
      assert.equal(response.status, 200, path);
      assert.match(response.headers.get("content-type") ?? "", /image/, path);
    }
    const { context, page } = await openPage("desktop", "/");
    try {
      const loaded = await page.$$eval(`header img[src="${BASE}/img/logo-simbolo.png"]`, (imgs) => imgs.map((img) => img.naturalWidth > 0));
      assert.ok(loaded.length > 0 && loaded.every(Boolean), "logo do cabeçalho não carregou");
    } finally {
      await context.close();
    }
  });
});

describe(`Títulos por página (${BROWSER})`, () => {
  const LABELS = {
    "/": "Visão geral",
    "/tuberculose": "Tuberculose",
    "/hanseniase": "Hanseníase",
    "/sifilis": "Sífilis congênita",
    "/dengue": "Dengue",
    "/zika": "Zika",
    "/chikungunya": "Chikungunya",
    "/sifilis-gestacional": "Sífilis gestacional"
  };

  test("U4: cada página pública tem título na aba e um único <h1> com o próprio nome", async () => {
    const titles = new Set();
    for (const [path, label] of Object.entries(LABELS)) {
      const { context, page } = await openPage("desktop", path);
      try {
        const title = await page.title();
        assert.ok(title.startsWith(`${label} — `), `${path}: título "${title}"`);
        titles.add(title);
        const headings = await page.$$eval("h1", (items) => items.map((item) => item.textContent?.trim()));
        assert.deepEqual(headings, [label], `${path}: <h1> ${JSON.stringify(headings)}`);
      } finally {
        await context.close();
      }
    }
    assert.equal(titles.size, Object.keys(LABELS).length, "títulos repetidos entre páginas");
  });
});

describe(`Página inicial (${BROWSER})`, () => {
  test("Toda fonte da lista \"Fontes permitidas\" tem link para a sua página", async () => {
    const { context, page } = await openPage("desktop", "/");
    try {
      const text = await page.innerText("main");
      assert.doesNotMatch(text, /Indispon[ií]vel/, "alguma fonte ficou sem página");
      for (const path of ["/zika", "/chikungunya", "/dengue"]) {
        assert.ok(await page.locator(`main a[href="${BASE}${path}"]`).count() > 0, `sem link para ${path}`);
      }
    } finally {
      await context.close();
    }
  });
});

describe(`Textos para o público (${BROWSER})`, () => {
  for (const path of ["/", "/dengue"]) {
    test(`U3: ${path} sem status em inglês nem palavras sem acento`, async () => {
      const { context, page } = await openPage("desktop", path);
      try {
        const text = await page.innerText("body");
        assert.doesNotMatch(text, /\b(SUCCESS|FAILED|synced)\b/, "status técnico em inglês");
        assert.doesNotMatch(text, /\b(Ultimo ano|Periodo|Atualizacao|Evolucao|Faixa etaria|Raca\/cor|validacao|sincronizacao|Abrir pagina|Condicao|Indigena)\b/i);
      } finally {
        await context.close();
      }
    });
  }
});

describe(`Indicadores (${BROWSER})`, () => {
  test("Dengue antes de 2014: % com sinais de alarme mostra aviso destacado em vez de um traço", async () => {
    const { context, page } = await openPage("desktop", "/dengue");
    try {
      await page.locator("main select").first().selectOption("2010");
      await settle(page);
      const panel = page.locator('section[aria-label="Indicadores"]');
      await panel.getByLabel("Indicador").selectOption("pct_sinais_alarme");
      const note = panel.getByRole("note");
      await note.waitFor({ timeout: 5000 });
      assert.match(await note.innerText(), /não existe em 2010[\s\S]*só passaram a existir em 2014/);
      await panel.getByLabel("Indicador").selectOption("incidencia");
      assert.equal(await panel.getByRole("note").count(), 0, "o aviso é só para os indicadores da classificação nova");
    } finally {
      await context.close();
    }
  });

  test("A6: painel de indicadores na dengue troca de indicador e explica anos sem valor", async () => {
    const { context, page } = await openPage("desktop", "/dengue");
    try {
      const panel = page.locator('section[aria-label="Indicadores"]');
      await panel.waitFor();
      await panel.locator("select").selectOption("pct_sinais_alarme");
      await page.waitForTimeout(500);
      const text = await panel.innerText();
      assert.match(text, /% com sinais de alarme/);
      assert.match(text, /não se aplica/, "anos antes de 2014 devem ser explicados");
      assert.match(text, /Cálculo:/);
      assert.equal(await panel.locator("canvas").count(), 1, "gráfico do indicador");
    } finally {
      await context.close();
    }
  });

  test("Arboviroses saiu do painel: sem item no menu e o endereço antigo leva à visão geral", async () => {
    const { context, page } = await openPage("desktop", "/arboviroses");
    try {
      await page.waitForURL((url) => !url.pathname.endsWith("/arboviroses"), { waitUntil: "commit", timeout: 10_000 });
      assert.equal(new URL(page.url()).pathname.replace(/\/+$/, ""), BASE, "deveria ir para a visão geral");
      assert.equal(await page.locator('a[href$="/arboviroses"]').count(), 0, "link para arboviroses");
    } finally {
      await context.close();
    }
  });

  test("A6: tuberculose não tem painel de indicadores (só dengue, zika e chikungunya)", async () => {
    const { context, page } = await openPage("desktop", "/tuberculose");
    try {
      await page.waitForTimeout(800);
      assert.equal(await page.locator('section[aria-label="Indicadores"]').count(), 0);
    } finally {
      await context.close();
    }
  });
});

describe(`Mapa e cabeçalho (${BROWSER})`, () => {
  for (const profile of Object.keys(PROFILES)) {
    test(`${profile}: ao rolar, o mapa passa por baixo do cabeçalho fixo`, async () => {
      const { context, page } = await openPage(profile, "/tuberculose");
      try {
        // As imagens do Leaflet têm pointer-events: none; sem isto o elementFromPoint as atravessaria.
        await page.addStyleTag({ content: "* { pointer-events: auto !important; } [data-drawer] { display: none !important; }" });
        const onTop = await page.evaluate(() => {
          const header = document.querySelector("header");
          const map = document.querySelector(".leaflet-container");
          window.scrollBy(0, map.getBoundingClientRect().top - header.getBoundingClientRect().height / 2);
          const h = header.getBoundingClientRect();
          const m = map.getBoundingClientRect();
          const element = document.elementFromPoint(m.left + m.width / 2, Math.max(m.top, h.top) + 3);
          return element?.closest("header") ? "cabeçalho" : element?.closest(".leaflet-container") ? "mapa" : element?.tagName;
        });
        assert.equal(onTop, "cabeçalho");
      } finally {
        await context.close();
      }
    });
  }
});

describe(`Área administrativa (${BROWSER})`, () => {
  test("Senha errada mostra mensagem; login abre o painel; sessão persiste; downloads; telas; Sair no menu", async () => {
    const { context, page } = await openPage("desktop", "/admin");
    const openMenuAndGo = async (label) => {
      await page.locator('button[aria-label="Abrir menu"]').click();
      await page.waitForTimeout(400);
      await page.locator("#menu-lateral").getByRole("link", { name: label, exact: true }).click();
      await settle(page);
      await page.waitForTimeout(1000);
    };
    try {
      await page.locator('input[name="username"]').fill(ADMIN_USERNAME);
      await page.locator('input[type="password"]').fill("senha-errada-teste-ui");
      await page.getByRole("button", { name: /entrar/i }).click();
      await page.waitForTimeout(800);
      assert.match(await page.innerText("main"), /Credencial administrativa inválida/i);

      await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
      await page.getByRole("button", { name: /entrar/i }).click();
      await settle(page);
      await page.waitForTimeout(1200);
      assert.match(await page.innerText("body"), /Dashboard da fonte/i);
      assert.doesNotMatch(await page.innerText("main"), /Auditoria administrativa|Histórico de sincronizações/i, "painel inicial deve ficar enxuto");
      await page.screenshot({ path: `${SHOTS}desktop_admin_logado.png`, fullPage: true });

      await page.reload({ waitUntil: "domcontentloaded" });
        await settle(page);
      await page.waitForTimeout(800);
      assert.match(await page.innerText("body"), /Dashboard da fonte/i, "sessão persiste");

      const csv = page.waitForEvent("download", { timeout: 8000 });
      await page.getByRole("button", { name: /baixar csv/i }).click();
      assert.match((await csv).suggestedFilename(), /\.csv$/);
      const html = page.waitForEvent("download", { timeout: 8000 });
      await page.getByRole("button", { name: /baixar dashboard/i }).click();
      assert.match((await html).suggestedFilename(), /\.html$/);

      await openMenuAndGo("Fontes");
      assert.match(await page.innerText("main"), /Sincronizar todas/i);
      await openMenuAndGo("População");
      assert.match(await page.innerText("main"), /Enviar planilha de população/i);
      await openMenuAndGo("Sincronizações");
      assert.match(await page.innerText("main"), /Histórico de sincronizações/i);
      await openMenuAndGo("Auditoria");
      const audit = await page.innerText("main");
      assert.match(audit, /Data e hora/i);
      assert.match(audit, /Não identificado/, "login errado deveria aparecer sem usuário identificado");
      assert.match(audit, new RegExp(ADMIN_USERNAME), "login certo deveria mostrar o usuário");

      await page.locator('button[aria-label="Abrir menu"]').click();
      await page.waitForTimeout(400);
      await page.locator("#menu-lateral").getByRole("button", { name: /sair/i }).click();
      await page.waitForTimeout(800);
      assert.ok((await page.locator('input[type="password"]').count()) > 0);
    } finally {
      await context.close();
    }
  });

  for (const colorScheme of ["light", "dark"]) {
    test(`Login: contraste (WCAG AA) no tema ${colorScheme === "dark" ? "escuro" : "claro"} e botão de mostrar senha`, async () => {
      const context = await browser.newContext({ ...PROFILES.desktop, locale: "pt-BR", colorScheme });
      const page = await context.newPage();
      try {
        await page.goto(WEB + "/admin", { waitUntil: "domcontentloaded" });
        await page.locator('input[name="password"]').waitFor();
        assert.deepEqual(await page.$$eval("h1", (items) => items.map((item) => item.textContent?.trim())), ["Acesso administrativo"]);
        await page.addScriptTag({ content: axeSource });
        const violations = await page.evaluate(async () =>
          (await window.axe.run(document, { runOnly: ["color-contrast"] })).violations.flatMap((v) => v.nodes.map((n) => n.html.slice(0, 80)))
        );
        assert.deepEqual(violations, []);

        const password = page.locator('input[name="password"]');
        await password.fill("abc");
        await page.getByRole("button", { name: "Mostrar senha" }).click();
        assert.equal(await password.getAttribute("type"), "text");
        await page.getByRole("button", { name: "Ocultar senha" }).click();
        assert.equal(await password.getAttribute("type"), "password");
      } finally {
        await context.close();
      }
    });
  }

  test("População: modelo na tela, download do modelo e avisos na pré-visualização (sem gravar)", async () => {
    const { context, page } = await openPage("desktop", "/admin/populacao");
    try {
      await page.locator('input[name="username"]').fill(ADMIN_USERNAME);
      await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
      await page.getByRole("button", { name: /entrar/i }).click();
      await page.getByRole("table", { name: "Exemplo do formato da planilha" }).waitFor({ timeout: 10_000 });

      const download = page.waitForEvent("download", { timeout: 8000 });
      await page.getByRole("button", { name: "Baixar modelo" }).click();
      assert.equal((await download).suggestedFilename(), "modelo-populacao-parnaiba.csv");

      await page.locator('input[type="file"]').setInputFiles({
        name: "populacao.csv",
        mimeType: "text/csv",
        buffer: Buffer.from("Ano;População;Fonte\n2022;162.159;IBGE\n")
      });
      const main = page.locator("main");
      await main.getByText("Colunas reconhecidas").waitFor({ timeout: 5000 });
      const text = await main.innerText();
      assert.match(text, /ano = “Ano”, população = “População”, 60 anos ou mais = não encontrada/);
      assert.match(text, /A coluna "Fonte" não foi reconhecida/);
      await page.getByRole("button", { name: "Cancelar" }).click();
    } finally {
      await context.close();
    }
  });

  test("U1: Enter no campo de senha envia o login", async () => {
    const { context, page } = await openPage("desktop", "/admin");
    try {
      await page.locator("input").nth(0).fill(ADMIN_USERNAME);
      await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
      const sent = page.waitForRequest((r) => r.url().includes("/auth/login"), { timeout: 3000 });
      await page.locator('input[type="password"]').press("Enter");
      await sent;
    } finally {
      await context.close();
    }
  });
});

describe(`Resiliência e acessibilidade (${BROWSER})`, () => {
  test("Com a API fora do ar, a página mostra aviso em vez de quebrar", async () => {
    const context = await browser.newContext();
    try {
      await context.route((url) => url.href.startsWith(`${API}/api/`), (route) => route.abort());
      const page = await context.newPage();
      await page.goto(WEB + "/tuberculose", { waitUntil: "domcontentloaded" });
      await settle(page);
      await page.waitForTimeout(800);
      assert.match(await page.innerText("body"), /indispon/i);
    } finally {
      await context.close();
    }
  });

  test("U2: contraste de cores (WCAG AA) no tema escuro e com o botão Limpar habilitado", async () => {
    const context = await browser.newContext({ ...PROFILES.desktop, locale: "pt-BR", colorScheme: "dark" });
    const page = await context.newPage();
    try {
      await page.goto(WEB + "/dengue", { waitUntil: "domcontentloaded" });
      await settle(page);
      await page.locator("main select").first().selectOption({ index: 2 });
      await page.waitForTimeout(800);
      await page.addScriptTag({ content: axeSource });
      const violations = await page.evaluate(async () =>
        (await window.axe.run(document, { runOnly: ["color-contrast"] })).violations.flatMap((v) => v.nodes.map((n) => n.html.slice(0, 80)))
      );
      assert.deepEqual(violations, []);
    } finally {
      await context.close();
    }
  });
});
