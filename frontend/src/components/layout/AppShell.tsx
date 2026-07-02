"use client";

import Link from "next/link";
import { Activity, BarChart3, Database, MapPinned, Menu, X } from "lucide-react";
import { useState } from "react";
import { ThemeToggle } from "../ui/ThemeToggle";

type AppShellProps = {
  active:
    | "overview"
    | "tuberculose"
    | "hanseniase"
    | "sifilis"
    | "dengue"
    | "arboviroses"
    | "sifilis-gestacional";
  children: React.ReactNode;
};

const navItems = [
  {
    href: "/",
    label: "Visao geral",
    active: "overview",
    icon: BarChart3
  },
  {
    href: "/tuberculose",
    label: "Tuberculose",
    active: "tuberculose",
    icon: Activity
  },
  {
    href: "/hanseniase",
    label: "Hanseniase",
    active: "hanseniase",
    icon: Activity
  },
  {
    href: "/sifilis",
    label: "Sifilis congenita",
    active: "sifilis",
    icon: Activity
  },
  {
    href: "/dengue",
    label: "Dengue",
    active: "dengue",
    icon: Activity
  },
  {
    href: "/arboviroses",
    label: "Arboviroses",
    active: "arboviroses",
    icon: Activity
  },
  {
    href: "/sifilis-gestacional",
    label: "Sifilis gestacional",
    active: "sifilis-gestacional",
    icon: Activity
  }
] as const;

export function AppShell({ active, children }: AppShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-pet-ice">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-pet-light/40 bg-pet-dark text-white lg:block">
        <div className="flex h-20 items-center gap-3 border-b border-white/15 px-5">
          <div className="flex h-10 w-10 items-center justify-center rounded bg-pet-mid text-white ring-1 ring-white/20">
            <MapPinned size={18} aria-hidden="true" />
          </div>
          <div>
            <div className="text-sm font-semibold text-white">PET-Saúde</div>
            <div className="text-xs text-white/70">Informação e Saúde Digital</div>
          </div>
        </div>
        <nav className="space-y-1 px-3 py-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const selected = active === item.active;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded px-3 py-2 text-sm font-medium ${
                  selected
                    ? "border-l-4 border-pet-orange bg-pet-mid text-white"
                    : "border-l-4 border-transparent text-white/75 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon size={17} aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 border-t border-white/15 p-4">
          <div className="flex items-center gap-2 text-xs text-white/70">
            <Database size={14} aria-hidden="true" />
            DATASUS/TABNET
          </div>
        </div>
      </aside>

      <div className="min-w-0 lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-pet-dark bg-pet-dark text-white shadow-sm">
          <div className="mx-auto flex min-h-16 max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:py-0 lg:px-8">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-pet-light">Parnaíba - PI</p>
              <h1 className="text-lg font-semibold text-white sm:text-xl">
                Painel Epidemiológico PET-Saúde
              </h1>
            </div>
            <div className="flex w-full items-center justify-between gap-3 lg:w-auto lg:justify-end">
              <ThemeToggle />
              <button
                type="button"
                aria-label={mobileMenuOpen ? "Fechar menu" : "Abrir menu"}
                aria-expanded={mobileMenuOpen}
                onClick={() => setMobileMenuOpen((current) => !current)}
                className="inline-flex h-10 w-10 items-center justify-center rounded border border-white/30 bg-white/10 text-white hover:bg-pet-mid lg:hidden"
              >
                {mobileMenuOpen ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
              </button>
            </div>
          </div>
          {mobileMenuOpen ? (
            <div className="border-t border-white/20 bg-pet-dark px-4 py-3 sm:px-6 lg:hidden">
              <nav className="grid gap-2">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const selected = active === item.active;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 rounded border px-3 py-3 text-sm font-medium ${
                        selected
                          ? "border-pet-orange bg-pet-mid text-white"
                          : "border-white/20 bg-white/10 text-white hover:bg-pet-mid"
                      }`}
                    >
                      <Icon size={18} aria-hidden="true" />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>
          ) : null}
        </header>
        <main className="mx-auto max-w-7xl min-w-0 px-4 py-5 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
