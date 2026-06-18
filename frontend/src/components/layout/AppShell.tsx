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
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 bg-white lg:block">
        <div className="flex h-16 items-center gap-3 border-b border-slate-200 px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded bg-health-700 text-white">
            <MapPinned size={18} aria-hidden="true" />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-950">Painel Epidemiologico</div>
            <div className="text-xs text-slate-500">Parnaiba - PI</div>
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
                    ? "bg-health-50 text-health-700"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                }`}
              >
                <Icon size={17} aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 border-t border-slate-200 p-4">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Database size={14} aria-hidden="true" />
            DATASUS/TABNET
          </div>
        </div>
      </aside>

      <div className="min-w-0 lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="mx-auto flex min-h-16 max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:py-0 lg:px-8">
            <div>
              <p className="text-xs font-medium uppercase text-health-700">Parnaiba - PI</p>
              <h1 className="text-lg font-semibold text-slate-950 sm:text-xl">
                Painel Epidemiologico
              </h1>
            </div>
            <div className="flex w-full items-center justify-between gap-3 lg:w-auto lg:justify-end">
              <ThemeToggle />
              <button
                type="button"
                aria-label={mobileMenuOpen ? "Fechar menu" : "Abrir menu"}
                aria-expanded={mobileMenuOpen}
                onClick={() => setMobileMenuOpen((current) => !current)}
                className="inline-flex h-10 w-10 items-center justify-center rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 lg:hidden"
              >
                {mobileMenuOpen ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
              </button>
            </div>
          </div>
          {mobileMenuOpen ? (
            <div className="border-t border-slate-200 px-4 py-3 sm:px-6 lg:hidden">
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
                          ? "border-health-600 bg-health-50 text-health-700"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
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
