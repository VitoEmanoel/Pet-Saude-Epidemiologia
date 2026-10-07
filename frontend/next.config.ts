import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// A API é chamada direto pelo navegador, então a origem dela precisa estar liberada na CSP.
// NEXT_PUBLIC_API_URL é lida no build (no Docker, vem do ARG do Dockerfile).
function apiOrigin() {
  try {
    return new URL(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333").origin;
  } catch {
    return "";
  }
}

// 'unsafe-inline' em scripts: o Next.js injeta scripts inline para hidratar as páginas
// estáticas e o layout tem o script do tema. Nonce exigiria renderizar tudo dinamicamente.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.tile.openstreetmap.org",
  "font-src 'self' data:",
  `connect-src 'self' ${apiOrigin()}${isDev ? " ws: wss:" : ""}`.trim(),
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'"
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // Isola a janela do site de páginas abertas por outros sites e impede que outros sites
  // embutam os arquivos daqui (S18).
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  // Navegadores só respeitam HSTS em HTTPS; sem includeSubDomains para não afetar outros subdomínios.
  { key: "Strict-Transport-Security", value: "max-age=31536000" }
];

// Site fora da raiz do domínio (ex.: "/painel"); vazio = raiz. Ver src/lib/base-path.ts.
const basePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/+$/, "") || undefined;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  basePath,
  output: "standalone",
  poweredByHeader: false,
  // Arboviroses saiu do painel em 07/10/2026 (dengue, zika e chikungunya já ficam separadas):
  // links antigos vão para a visão geral em vez de dar erro.
  async redirects() {
    return [{ source: "/arboviroses", destination: "/", permanent: false }];
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  }
};

export default nextConfig;
