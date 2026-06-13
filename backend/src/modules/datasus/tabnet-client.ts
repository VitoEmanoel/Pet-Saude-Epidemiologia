import { createHash } from "node:crypto";

export type TabnetResponse = {
  requestUrl: string;
  requestBody: string;
  responseFormat: "html_prn";
  contentHash: string;
  html: string;
};

export async function postTabnetPrn(
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
      throw new Error(`TABNET retornou HTTP ${response.status}.`);
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

