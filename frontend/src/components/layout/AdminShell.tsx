import Link from "next/link";
import { Activity, Database, Home, Shield } from "lucide-react";
import { ThemeToggle } from "../ui/ThemeToggle";

type AdminShellProps = {
  children: React.ReactNode;
};

export function AdminShell({ children }: AdminShellProps) {
  return (
    <div className="min-h-screen bg-pet-ice">
      <aside className="fixed inset-y-0 left-0 hidden w-72 border-r border-pet-light/40 bg-pet-dark text-white lg:block">
        <div className="flex h-16 items-center gap-3 border-b border-white/10 px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded bg-pet-orange text-white">
            <Shield size={18} aria-hidden="true" />
          </div>
          <div>
            <div className="text-sm font-semibold">PET-Saúde</div>
            <div className="text-xs text-white/70">Área administrativa</div>
          </div>
        </div>

        <nav className="space-y-1 px-3 py-4">
          <div className="flex items-center gap-3 rounded border-l-4 border-pet-orange bg-pet-mid px-3 py-2 text-sm font-medium text-white">
            <Activity size={17} aria-hidden="true" />
            Operacoes
          </div>
          <Link
            href="/"
            className="flex items-center gap-3 rounded border-l-4 border-transparent px-3 py-2 text-sm font-medium text-white/75 hover:bg-white/10 hover:text-white"
          >
            <Home size={17} aria-hidden="true" />
            Site publico
          </Link>
        </nav>

        <div className="absolute bottom-0 left-0 right-0 border-t border-white/10 p-4">
          <div className="flex items-center gap-2 text-xs text-white/70">
            <Database size={14} aria-hidden="true" />
            Rotas administrativas protegidas
          </div>
        </div>
      </aside>

      <div className="min-w-0 lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-pet-dark bg-pet-dark text-white shadow-sm">
          <div className="mx-auto flex min-h-16 max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:py-0 lg:px-8">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-pet-light">Informação e Saúde Digital</p>
              <h1 className="text-lg font-semibold text-white sm:text-xl">
                Administração PET-Saúde
              </h1>
            </div>
            <div className="flex w-full items-center justify-between gap-3 lg:w-auto lg:justify-end">
              <ThemeToggle />
              <Link
                href="/"
                className="inline-flex h-10 items-center justify-center gap-2 rounded border border-white/30 bg-white/10 px-3 text-sm font-medium text-white hover:bg-pet-mid sm:min-w-32"
              >
                <Home size={16} aria-hidden="true" />
                Publico
              </Link>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-7xl min-w-0 px-4 py-5 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
