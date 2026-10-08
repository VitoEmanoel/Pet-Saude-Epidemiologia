export type PrnTable = {
  headers: string[];
  rows: string[][];
};

const HTML_ENTITIES: Record<string, string> = {
  aacute: "\u00e1",
  Aacute: "\u00c1",
  acirc: "\u00e2",
  Acirc: "\u00c2",
  agrave: "\u00e0",
  Agrave: "\u00c0",
  atilde: "\u00e3",
  Atilde: "\u00c3",
  ccedil: "\u00e7",
  Ccedil: "\u00c7",
  eacute: "\u00e9",
  Eacute: "\u00c9",
  ecirc: "\u00ea",
  Ecirc: "\u00ca",
  iacute: "\u00ed",
  Iacute: "\u00cd",
  oacute: "\u00f3",
  Oacute: "\u00d3",
  ocirc: "\u00f4",
  Ocirc: "\u00d4",
  otilde: "\u00f5",
  Otilde: "\u00d5",
  uacute: "\u00fa",
  Uacute: "\u00da",
  nbsp: " "
};

export function decodeHtmlEntities(value: string): string {
  // Hexadecimal com letra maiúscula ou minúscula (&#xE7; e &#xe7; são "ç").
  return value.replace(/&(#[xX][0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (match, entity: string) => {
    if (entity.startsWith("#x") || entity.startsWith("#X")) {
      return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
    }

    if (entity.startsWith("#")) {
      return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
    }

    return HTML_ENTITIES[entity] ?? match;
  });
}

export function extractPreBlock(html: string): string {
  const match = html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);

  if (!match) {
    throw new Error("Resposta TABNET não contém bloco PRE com dados prn.");
  }

  return decodeHtmlEntities(match[1]);
}

export function parsePrnTable(html: string): PrnTable {
  const preBlock = extractPreBlock(html);
  const lines = preBlock
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && line !== "&");

  if (lines.length < 2) {
    throw new Error("Resposta TABNET prn não contém linhas de dados.");
  }

  const [headerLine, ...dataLines] = lines;

  return {
    headers: parseSemicolonCsvLine(headerLine),
    rows: dataLines.map(parseSemicolonCsvLine)
  };
}

function parseSemicolonCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ";" && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

