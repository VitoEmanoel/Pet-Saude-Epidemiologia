import Link from "next/link";
import { Activity, Database, Home, Shield } from "lucide-react";
import { ThemeToggle } from "../ui/ThemeToggle";

type AdminShellProps = {
  children: React.ReactNode;
};

export function AdminShell({ children }: AdminShellProps) {
  return (
    <div className="min-h-screen bg-slate-100">
      <aside className="fixed inset-y-0 left-0 hidden w-72 border-r border-slate-200 bg-slate-950 text-white lg:block">
        <div className="flex h-16 items-center gap-3 border-b border-white/10 px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded bg-health-600 text-white">
            <Shield size={18} aria-hidden="true" />
          </div>
          <div>
            <div className="text-sm font-semibold">Area Administrativa</div>
            <div className="text-xs text-slate-400">Parnaiba - PI</div>
          </div>
        </div>

        <nav className="space-y-1 px-3 py-4">
          <div className="flex items-center gap-3 rounded bg-white/10 px-3 py-2 text-sm font-medium text-white">
            <Activity size={17} aria-hidden="true" />
            Operacoes
          </div>
          <Link
            href="/"
            className="flex items-center gap-3 rounded px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white"
          >
            <Home size={17} aria-hidden="true" />
            Site publico
          </Link>
        </nav>

        <div className="absolute bottom-0 left-0 right-0 border-t border-white/10 p-4">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Database size={14} aria-hidden="true" />
            Rotas administrativas protegidas
          </div>
        </div>
      </aside>

      <div className="min-w-0 lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="mx-auto flex min-h-16 max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:py-0 lg:px-8">
            <div>
              <p className="text-xs font-medium uppercase text-health-700">Administracao</p>
              <h1 className="text-lg font-semibold text-slate-950 sm:text-xl">
                Painel interno
              </h1>
            </div>
            <div className="flex w-full items-center justify-between gap-3 lg:w-auto lg:justify-end">
              <ThemeToggle />
              <Link
                href="/"
                className="inline-flex h-10 items-center justify-center gap-2 rounded border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:min-w-32"
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
