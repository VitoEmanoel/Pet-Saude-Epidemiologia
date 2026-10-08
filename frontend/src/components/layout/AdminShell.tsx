"use client";

import { Database, History, Home, KeyRound, LayoutDashboard, LogOut, ScrollText, UserCog, UserRound, Users } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCallback, useState } from "react";
import { AdminSessionProvider, useAdminSession } from "../admin/AdminSession";
import { PetLogoMark } from "../ui/PetLogo";
import { MenuButton, SideDrawer } from "./SideDrawer";

// access: quem vê o item (7.4): todos, quem tem a permissão ou só administradores.
export const ADMIN_PAGES = [
  { href: "/admin", label: "Painel", icon: LayoutDashboard, access: "all" },
  { href: "/admin/fontes", label: "Fontes", icon: Database, access: "all" },
  { href: "/admin/populacao", label: "População", icon: Users, access: "populacao" },
  { href: "/admin/sincronizacoes", label: "Sincronizações", icon: History, access: "all" },
  { href: "/admin/auditoria", label: "Auditoria", icon: ScrollText, access: "auditoria" },
  { href: "/admin/usuarios", label: "Usuários", icon: UserCog, access: "admin" },
  { href: "/admin/conta", label: "Minha conta", icon: KeyRound, access: "all" }
] as const;

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <AdminSessionProvider>
      <AdminFrame>{children}</AdminFrame>
    </AdminSessionProvider>
  );
}

/** Cabeçalho e menu do admin; só aparece com sessão (sem sessão o provider mostra o login). */
function AdminFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, isAdmin, can, logout } = useAdminSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const currentPage = ADMIN_PAGES.find((page) => page.href === pathname) ?? ADMIN_PAGES[0];

  async function handleLogout() {
    setLeaving(true);

    try {
      await logout();
    } finally {
      setLeaving(false);
      setMenuOpen(false);
    }
  }

  return (
    <div className="min-h-screen bg-pet-ice">
      <SideDrawer
        open={menuOpen}
        onClose={closeMenu}
        brand={
          <div className="flex items-center gap-3">
            <PetLogoMark size={40} />
            <div>
              <div className="text-sm font-semibold">PET-Saúde</div>
              <div className="text-xs text-white/70">Área administrativa</div>
            </div>
          </div>
        }
        items={[
          ...ADMIN_PAGES.filter((page) => page.access === "all" || (page.access === "admin" ? isAdmin : can(page.access))).map(({ access: _access, ...page }) => ({
            ...page,
            selected: page.href === currentPage.href
          })),
          { href: "/", label: "Site público", icon: Home }
        ]}
        footer={
          <div className="space-y-3">
            <div className="flex items-start gap-2 text-xs text-white/70">
              <UserRound size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>
                Conectado como <span className="font-semibold text-white">{user?.name ?? user?.username ?? "admin"}</span>
                <span className="block">
                  {user?.username} · {isAdmin ? "administrador" : "equipe"}
                </span>
              </span>
            </div>
            <button
              type="button"
              onClick={() => void handleLogout()}
              disabled={leaving}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded border border-white/30 bg-white/10 px-3 text-sm font-medium text-white hover:bg-pet-red disabled:cursor-not-allowed disabled:opacity-50"
            >
              <LogOut size={16} aria-hidden="true" />
              Sair
            </button>
          </div>
        }
      />

      <header className="sticky top-0 z-20 border-b border-pet-dark bg-pet-dark text-white shadow-md">
        <div className="mx-auto flex min-h-20 max-w-7xl items-center gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <MenuButton open={menuOpen} onClick={() => setMenuOpen((current) => !current)} />
          <PetLogoMark size={48} className="hidden sm:inline-flex" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wider text-pet-sky sm:text-sm">Administração PET-Saúde</p>
            <h1 className="text-xl font-semibold leading-tight text-white sm:text-2xl">{currentPage.label}</h1>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl min-w-0 px-4 py-5 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
