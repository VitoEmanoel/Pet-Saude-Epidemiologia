"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { ThemeToggle } from "../ui/ThemeToggle";

export type DrawerNavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; "aria-hidden"?: boolean }>;
  selected?: boolean;
};

/** Botão ☰ do cabeçalho que abre o menu lateral. */
export function MenuButton({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={open ? "Fechar menu" : "Abrir menu"}
      aria-expanded={open}
      aria-controls="menu-lateral"
      onClick={onClick}
      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded border border-white/30 bg-white/10 text-white hover:bg-pet-mid"
    >
      {open ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
    </button>
  );
}

/**
 * Menu lateral em gaveta: fica escondido e abre por cima do conteúdo pelo botão ☰.
 * Fecha ao escolher um item, ao clicar fora ou com Esc.
 */
export function SideDrawer({
  open,
  onClose,
  brand,
  items,
  footer
}: {
  open: boolean;
  onClose: () => void;
  brand: React.ReactNode;
  items: DrawerNavItem[];
  footer?: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    const previousOverflow = document.body.style.overflow;

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    panelRef.current?.querySelector<HTMLElement>("a, button")?.focus();

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  return (
    <div data-drawer className={`fixed inset-0 z-40 ${open ? "" : "pointer-events-none"}`} aria-hidden={!open}>
      <div
        className={`absolute inset-0 bg-slate-950/50 transition-opacity ${open ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
      />
      <div
        id="menu-lateral"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        inert={!open}
        className={`absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-pet-light/40 bg-pet-dark text-white shadow-xl transition-transform duration-200 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4">
          {brand}
          <button
            type="button"
            aria-label="Fechar menu"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded text-white/80 hover:bg-white/10 hover:text-white"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {items.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                aria-current={item.selected ? "page" : undefined}
                className={`flex items-center gap-3 rounded border-l-4 px-3 py-2.5 text-sm font-medium ${
                  item.selected
                    ? "border-pet-orange bg-pet-mid text-white"
                    : "border-transparent text-white/80 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon size={17} aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="shrink-0 space-y-4 border-t border-white/10 p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium uppercase tracking-wider text-white/70">Tema</span>
            <ThemeToggle />
          </div>
          {footer}
        </div>
      </div>
    </div>
  );
}
