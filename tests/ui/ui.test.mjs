// Testes de interface, usabilidade e acessibilidade (Playwright).
// Navegador: QA_BROWSER=chromium (padrão) | firefox | webkit.
// WebKit não roda direto no Arch Linux; ver docs/13-testes.md.
import assert from "node:assert/strict";
import { mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { after, before, describe, test } from "node:test";
import pw from "playwright-core";
import { ADMIN_PASSWORD, ADMIN_USERNAME, OUTPUT, WEB, assertSystemUp } from "../support/env.mjs";

const BROWSER = process.env.QA_BROWSER ?? "chromium";
const SHOTS = `${OUTPUT}screenshots/${BROWSER}/`;
const axeSource = readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");

const DISEASE_PAGES = ["/tuberculose", "/hanseniase", "/sifilis", "/dengue", "/zika", "/chikungunya", "/arboviroses", "/sifilis-gestacional"];
const PAGES = ["/", ...DISEASE_PAGES, "/admin"];
const PROFILES = {
  desktop: { viewport: { width: 1440, height: 900 } },
  celular: BROWSER === "webkit" ? pw.devices["iPhone 15"] : { viewport: { width: 390, height: 844 } }
};

let browser;

before(async () => {
  await assertSystemUp();
  mkdirSync(SHOTS, { recursive: true });
  browser = await pw[BROWSER].launch();
});

after(async () => {
  await browser?.close();
});

async function openPage(profile, path) {
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
  await page.goto(WEB + path, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  return { context, page, errors };
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
            apiError: /API indisponivel/i.test(document.body.innerText),
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
            // 4 gráficos + 1 do painel de indicadores nas arboviroses (A6).
            const arbovirus = ["/dengue", "/zika", "/chikungunya", "/arboviroses"].includes(path);
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

      test(`${path}: acessibilidade WCAG 2 A/AA (exceto contraste, ver U2)`, async () => {
        const { context, page } = await openPage(profile, path);
        try {
          await page.addScriptTag({ content: axeSource });
          const violations = await page.evaluate(async () =>
            (await window.axe.run(document, { runOnly: ["wcag2a", "wcag2aa"] })).violations
              .filter((v) => v.id !== "color-contrast")
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
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(600);
        assert.match(await page.innerText("main"), /\b86\b/);
        await page.getByRole("button", { name: /limpar/i }).first().click();
        await page.waitForTimeout(400);
        assert.equal(await page.locator("select").nth(0).inputValue(), "");
      } finally {
        await context.close();
      }
    });

    test("D3: tabela mostra uma visão por vez; filtro de sexo trava o \"Detalhar por\" em sexo", async () => {
      const { context, page } = await openPage(profile, "/tuberculose");
      try {
        const viewSelect = page.getByLabel("Detalhar por");
        assert.equal(await viewSelect.inputValue(), "yearly");
        assert.match(await page.innerText("main"), /Total do ano/);
        await viewSelect.selectOption("race_color");
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(400);
        assert.match(await page.innerText("main"), /Por raça\/cor/);

        const sexOptions = await page.locator("select").nth(1).locator("option").evaluateAll((o) => o.map((x) => x.value).filter(Boolean));
        await page.locator("select").nth(1).selectOption(sexOptions[0]);
        await page.waitForLoadState("networkidle");
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
        await page.locator('[title="Proxima pagina"]').first().click();
        await page.waitForLoadState("networkidle");
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
        await page.waitForURL("**/dengue");
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
        await page.reload({ waitUntil: "networkidle" });
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
        await page.waitForLoadState("networkidle");
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
        await page.waitForLoadState("networkidle");
        assert.equal(await page.locator("select").nth(1).inputValue(), "");
        assert.notEqual(await page.locator("select").nth(2).inputValue(), "");
      } finally {
        await context.close();
      }
    });
  });
}

describe(`Página inicial (${BROWSER})`, () => {
  test("Toda fonte da lista \"Fontes permitidas\" tem link para a sua página", async () => {
    const { context, page } = await openPage("desktop", "/");
    try {
      const text = await page.innerText("main");
      assert.doesNotMatch(text, /Indispon[ií]vel/, "alguma fonte ficou sem página");
      for (const path of ["/zika", "/chikungunya", "/dengue"]) {
        assert.ok(await page.locator(`main a[href="${path}"]`).count() > 0, `sem link para ${path}`);
      }
    } finally {
      await context.close();
    }
  });
});

describe(`Indicadores (${BROWSER})`, () => {
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

  test("A6: tuberculose não tem painel de indicadores (só arboviroses)", async () => {
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
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1000);
    };
    try {
      await page.locator('input[name="username"]').fill(ADMIN_USERNAME);
      await page.locator('input[type="password"]').fill("senha-errada-teste-ui");
      await page.getByRole("button", { name: /entrar/i }).click();
      await page.waitForTimeout(800);
      assert.match(await page.innerText("main"), /Credencial administrativa invalida/i);

      await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
      await page.getByRole("button", { name: /entrar/i }).click();
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1200);
      assert.match(await page.innerText("body"), /Dashboard da fonte/i);
      assert.doesNotMatch(await page.innerText("main"), /Auditoria administrativa|Histórico de sincronizações/i, "painel inicial deve ficar enxuto");
      await page.screenshot({ path: `${SHOTS}desktop_admin_logado.png`, fullPage: true });

      await page.reload({ waitUntil: "networkidle" });
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
      await context.route(/:3333\//, (route) => route.abort());
      const page = await context.newPage();
      await page.goto(WEB + "/tuberculose", { waitUntil: "networkidle" });
      await page.waitForTimeout(800);
      assert.match(await page.innerText("body"), /indispon/i);
    } finally {
      await context.close();
    }
  });

  test("U2: contraste de cores (WCAG AA)", { todo: "U2 — Fase 4" }, async () => {
    const { context, page } = await openPage("desktop", "/tuberculose");
    try {
      await page.addScriptTag({ content: axeSource });
      const violations = await page.evaluate(async () =>
        (await window.axe.run(document, { runOnly: ["color-contrast"] })).violations.length
      );
      assert.equal(violations, 0);
    } finally {
      await context.close();
    }
  });
});
