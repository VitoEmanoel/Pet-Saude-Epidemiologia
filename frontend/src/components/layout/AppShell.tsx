"use client";

import { Activity, BarChart3, Database } from "lucide-react";
import { useCallback, useState } from "react";
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
    | "arboviroses"
    | "sifilis-gestacional";
  children: React.ReactNode;
};

const navItems = [
  { href: "/", label: "Visão geral", active: "overview", icon: BarChart3 },
  { href: "/tuberculose", label: "Tuberculose", active: "tuberculose", icon: Activity },
  { href: "/hanseniase", label: "Hanseníase", active: "hanseniase", icon: Activity },
  { href: "/sifilis", label: "Sífilis congênita", active: "sifilis", icon: Activity },
  { href: "/dengue", label: "Dengue", active: "dengue", icon: Activity },
  { href: "/zika", label: "Zika", active: "zika", icon: Activity },
  { href: "/chikungunya", label: "Chikungunya", active: "chikungunya", icon: Activity },
  { href: "/arboviroses", label: "Arboviroses", active: "arboviroses", icon: Activity },
  { href: "/sifilis-gestacional", label: "Sífilis gestacional", active: "sifilis-gestacional", icon: Activity }
] as const;

export function AppShell({ active, children }: AppShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

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
        items={navItems.map((item) => ({ ...item, selected: item.active === active }))}
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
            <p className="text-xs font-medium uppercase tracking-wider text-pet-sky sm:text-sm">Parnaíba - PI</p>
            <h1 className="text-lg font-semibold leading-tight text-white sm:text-2xl">Painel Epidemiológico PET-Saúde</h1>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl min-w-0 px-4 py-5 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
