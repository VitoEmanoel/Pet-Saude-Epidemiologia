import { createHash } from "node:crypto";

export type TabnetResponse = {
  requestUrl: string;
  requestBody: string;
  responseFormat: "html_prn";
  contentHash: string;
  html: string;
};

/** Erro que vale tentar de novo: rede, tempo esgotado ou HTTP 5xx (o TABNET oscila). */
export class TabnetTemporaryError extends Error {}

// Esperas entre as tentativas (O5). TABNET_RETRY_DELAYS_MS="0,0" deixa os testes rápidos.
function retryDelays(): number[] {
  const configured = process.env.TABNET_RETRY_DELAYS_MS?.split(",").map((value) => Number(value.trim()));
  return configured && configured.every((value) => Number.isFinite(value) && value >= 0) ? configured : [3_000, 10_000];
}

/** Executa `request` com novas tentativas para falhas temporárias; outros erros sobem na hora. */
export async function withTabnetRetry<T>(description: string, request: () => Promise<T>): Promise<T> {
  const delays = retryDelays();

  for (let attempt = 0; ; attempt += 1) {
    try {
      return await request();
    } catch (error) {
      const temporary = error instanceof TabnetTemporaryError || error instanceof TypeError || (error as Error)?.name === "AbortError";

      if (!temporary || attempt >= delays.length) {
        throw error;
      }

      console.warn(`${description}: falha temporária (${(error as Error).message}); nova tentativa ${attempt + 2} de ${delays.length + 1}.`);
      await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
    }
  }
}

export function postTabnetPrn(requestUrl: string, encodedFormBody: string): Promise<TabnetResponse> {
  return withTabnetRetry("TABNET", () => postTabnetPrnOnce(requestUrl, encodedFormBody));
}

async function postTabnetPrnOnce(
  requestUrl: string,
  encodedFormBody: string
): Promise<TabnetResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);

  try {
    const response = await fetch(requestUrl, {
      method: "POST",
      headers: {
        "accept": "text/html",
        "content-type": "application/x-www-form-urlencoded",
        "user-agent": "painel-epidemiologico-parnaiba/0.1"
      },
      body: Buffer.from(encodedFormBody, "ascii"),
      signal: controller.signal
    });

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const html = buffer.toString("latin1");

    if (!response.ok) {
      const message = `TABNET retornou HTTP ${response.status}.`;
      throw response.status >= 500 ? new TabnetTemporaryError(message) : new Error(message);
    }

    return {
      requestUrl,
      requestBody: encodedFormBody,
      responseFormat: "html_prn",
      contentHash: createHash("sha256").update(buffer).digest("hex"),
      html
    };
  } finally {
    clearTimeout(timeout);
  }
}


/** Baixa o formulário de um .def (deftohtm.exe), usado para descobrir os arquivos de ano disponíveis. */
export function fetchTabnetForm(formUrl: string): Promise<string> {
  return withTabnetRetry("Formulário TABNET", () => fetchTabnetFormOnce(formUrl));
}

async function fetchTabnetFormOnce(formUrl: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch(formUrl, {
      headers: { "accept": "text/html", "user-agent": "painel-epidemiologico-parnaiba/0.1" },
      signal: controller.signal
    });

    if (!response.ok) {
      const message = `Formulário TABNET retornou HTTP ${response.status}.`;
      throw response.status >= 500 ? new TabnetTemporaryError(message) : new Error(message);
    }

    return Buffer.from(await response.arrayBuffer()).toString("latin1");
  } finally {
    clearTimeout(timeout);
  }
}
