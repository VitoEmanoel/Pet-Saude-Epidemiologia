import { prisma } from "../../database/prisma";

// Fontes tiradas do site pelo administrador (7.5): data_sources.active = false. Os dados ficam
// no banco e a fonte volta quando for religada. A lista fica em memória para as rotas públicas
// (que conferem a fonte de forma síncrona) e é relida ao iniciar, a cada mudança e a cada minuto.

let hiddenSlugs = new Set<string>();

export function isSourceHidden(slug: string) {
  return hiddenSlugs.has(slug);
}

export async function refreshHiddenSources() {
  const rows = await prisma.dataSource.findMany({ where: { active: false }, select: { slug: true } });
  hiddenSlugs = new Set(rows.map((row) => row.slug));
  return hiddenSlugs;
}

/** Para o agendador e a sincronização em lote: lê do banco na hora (vale entre processos). */
export async function getHiddenSourceSlugs() {
  return refreshHiddenSources();
}

export function startHiddenSourcesRefresh(intervalMs = 60_000) {
  void refreshHiddenSources().catch((error: unknown) => console.error("Falha ao ler as fontes fora do site.", error));
  const timer = setInterval(() => {
    void refreshHiddenSources().catch((error: unknown) => console.error("Falha ao ler as fontes fora do site.", error));
  }, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
