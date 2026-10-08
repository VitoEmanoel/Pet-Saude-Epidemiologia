"use client";

import { Activity, BarChart3, Database } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { getSources } from "@/lib/api";
import { PetLogoMark } from "../ui/PetLogo";
import { MenuButton, SideDrawer } from "./SideDrawer";

type AppShellProps = {
  active:
    | "overview"
    | "tuberculose"
    | "hanseniase"
    | "sifilis"
    | "dengue"
    | "zika"
    | "chikungunya"
    | "sifilis-gestacional";
  children: React.ReactNode;
};

// slug: a fonte da página; some do menu se o administrador a tirar do site (7.5).
const navItems = [
  { href: "/", label: "Visão geral", active: "overview", icon: BarChart3, slug: null },
  { href: "/tuberculose", label: "Tuberculose", active: "tuberculose", icon: Activity, slug: "tuberculose_sinan" },
  { href: "/hanseniase", label: "Hanseníase", active: "hanseniase", icon: Activity, slug: "hanseniase_sinan" },
  { href: "/sifilis", label: "Sífilis congênita", active: "sifilis", icon: Activity, slug: "sifilis_congenita_sinan" },
  { href: "/dengue", label: "Dengue", active: "dengue", icon: Activity, slug: "dengue_sinan" },
  { href: "/zika", label: "Zika", active: "zika", icon: Activity, slug: "zika_sinan" },
  { href: "/chikungunya", label: "Chikungunya", active: "chikungunya", icon: Activity, slug: "chikungunya_sinan" },
  { href: "/sifilis-gestacional", label: "Sífilis gestacional", active: "sifilis-gestacional", icon: Activity, slug: "sifilis_gestacional_sinan" }
] as const;

export function AppShell({ active, children }: AppShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const [publishedSlugs, setPublishedSlugs] = useState<Set<string> | null>(null);

  useEffect(() => {
    let active = true;
    getSources()
      .then((response) => active && setPublishedSlugs(new Set(response.sources.map((source) => source.slug))))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  // Enquanto a lista não chega (ou se a API falhar), o menu mostra todas as páginas.
  const visibleItems = navItems.filter((item) => !item.slug || !publishedSlugs || publishedSlugs.has(item.slug));
  // Cada página tem o próprio <h1> (U4); o nome do painel fica na linha de cima, como no admin.
  const currentPage = navItems.find((item) => item.active === active) ?? navItems[0];

  return (
    <div className="min-h-screen bg-pet-ice">
      <SideDrawer
        open={menuOpen}
        onClose={closeMenu}
        brand={
          <div className="flex items-center gap-3">
            <PetLogoMark size={40} />
            <div>
              <div className="text-sm font-semibold text-white">PET-Saúde</div>
              <div className="text-xs text-white/70">Informação e Saúde Digital</div>
            </div>
          </div>
        }
        items={visibleItems.map(({ slug: _slug, ...item }) => ({ ...item, selected: item.active === active }))}
        footer={
          <div className="flex items-center gap-2 text-xs text-white/70">
            <Database size={14} aria-hidden="true" />
            DATASUS/TABNET
          </div>
        }
      />

      <header className="sticky top-0 z-20 border-b border-pet-dark bg-pet-dark text-white shadow-md">
        <div className="mx-auto flex min-h-20 max-w-7xl items-center gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <MenuButton open={menuOpen} onClick={() => setMenuOpen((current) => !current)} />
          <PetLogoMark size={48} className="hidden sm:inline-flex" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium uppercase tracking-wider text-pet-sky sm:text-sm">
              Painel Epidemiológico · Parnaíba - PI
            </p>
            <h1 className="text-xl font-semibold leading-tight text-white sm:text-2xl">{currentPage.label}</h1>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl min-w-0 px-4 py-5 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
