"use client";

import Link from "next/link";
import { Home, LogIn, Shield } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getAdminSession, loginAdmin, logoutAdmin } from "@/lib/api";
import { PetLogoMark, PetLogoWithText } from "../ui/PetLogo";
import { ThemeToggle } from "../ui/ThemeToggle";
import {
  IDLE_ACTION,
  LoadingBlocks,
  StatusMessages,
  errorMessage,
  isAdminAuthError,
  isAdminRateLimitError,
  type ActionState
} from "./admin-ui";

type SessionStatus = "checking" | "authenticated" | "unauthenticated";

type AdminSessionValue = {
  status: SessionStatus;
  username: string | null;
  logout: () => Promise<void>;
  /** Se o erro for de sessão (401/403), volta para o login e devolve true. */
  handleAuthError: (error: unknown) => boolean;
};

const AdminSessionContext = createContext<AdminSessionValue | null>(null);

export function useAdminSession() {
  const value = useContext(AdminSessionContext);

  if (!value) {
    throw new Error("useAdminSession precisa estar dentro de AdminSessionProvider.");
  }

  return value;
}

/** Guarda a sessão do admin para todas as telas; sem sessão, mostra o login no lugar delas. */
export function AdminSessionProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>("checking");
  const [username, setUsername] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    getAdminSession()
      .then((session) => {
        if (active) {
          setUsername(session.username ?? null);
          setStatus("authenticated");
        }
      })
      .catch(() => {
        if (active) {
          setStatus("unauthenticated");
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const handleAuthError = useCallback((error: unknown) => {
    if (!isAdminAuthError(error)) {
      return false;
    }

    setNotice("Sua sessão expirou ou foi encerrada. Entre novamente.");
    setStatus("unauthenticated");
    return true;
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutAdmin();
    } catch (error) {
      if (!isAdminAuthError(error)) {
        throw error;
      }
    }

    setUsername(null);
    setNotice("Sessão encerrada.");
    setStatus("unauthenticated");
  }, []);

  const value = useMemo(
    () => ({ status, username, logout, handleAuthError }),
    [status, username, logout, handleAuthError]
  );

  return (
    <AdminSessionContext.Provider value={value}>
      {status === "authenticated" ? (
        children
      ) : (
        <PublicAdminFrame>
          {status === "checking" ? (
            <LoadingBlocks />
          ) : (
            <AdminLoginForm
              notice={notice}
              onLogin={(name) => {
                setUsername(name);
                setNotice(null);
                setStatus("authenticated");
              }}
            />
          )}
        </PublicAdminFrame>
      )}
    </AdminSessionContext.Provider>
  );
}

/** Cabeçalho simples para o login (sem o menu, que só aparece com sessão). */
function PublicAdminFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-pet-ice">
      <header className="sticky top-0 z-20 border-b border-pet-dark bg-pet-dark text-white shadow-sm">
        <div className="mx-auto flex min-h-20 max-w-7xl items-center gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <PetLogoMark size={48} />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wider text-pet-sky sm:text-sm">PET-Saúde</p>
            <h1 className="text-xl font-semibold leading-tight text-white sm:text-2xl">Área administrativa</h1>
          </div>
          <ThemeToggle />
          <Link
            href="/"
            aria-label="Site público"
            className="inline-flex h-10 items-center justify-center gap-2 rounded border border-white/30 bg-white/10 px-3 text-sm font-medium text-white hover:bg-pet-mid"
          >
            <Home size={16} aria-hidden="true" />
            <span className="hidden sm:inline">Site público</span>
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-7xl min-w-0 px-4 py-5 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}

function AdminLoginForm({ notice, onLogin }: { notice: string | null; onLogin: (username: string) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [actionState, setActionState] = useState<ActionState>({ ...IDLE_ACTION, message: notice });

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedUsername = username.trim();

    if (!trimmedUsername || !password) {
      setActionState({ ...IDLE_ACTION, error: "Informe usuário e senha." });
      return;
    }

    setActionState({ ...IDLE_ACTION, busyAction: "login" });

    try {
      await loginAdmin({ username: trimmedUsername, password });
      const session = await getAdminSession();
      onLogin(session.username ?? trimmedUsername);
    } catch (error) {
      setPassword("");
      setActionState({
        ...IDLE_ACTION,
        error: isAdminRateLimitError(error)
          ? "Muitas tentativas. Aguarde alguns minutos e tente novamente."
          : errorMessage(error, "Falha ao entrar.")
      });
    }
  }

  const inputClass =
    "h-11 w-full rounded border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-institutional-600 focus:ring-2 focus:ring-institutional-50";

  return (
    <section className="mx-auto mt-6 max-w-md rounded border border-slate-200 bg-white shadow-sm">
      <div className="flex justify-center border-b border-slate-200 px-6 pt-6 pb-4">
        <PetLogoWithText width={180} />
      </div>
      <div className="border-b border-slate-200 px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded bg-health-700 text-white">
            <Shield size={20} aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-950">Login administrativo</h2>
            <p className="text-sm text-slate-500">O painel interno só é liberado com credenciais válidas.</p>
          </div>
        </div>
      </div>
      <form className="space-y-4 p-6" onSubmit={(event) => void submit(event)}>
        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase text-slate-500">Usuário</span>
          <input
            type="text"
            name="username"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase text-slate-500">Senha</span>
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={inputClass}
          />
        </label>
        <button
          type="submit"
          disabled={actionState.busyAction !== null}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded bg-pet-mid px-4 text-sm font-medium text-white hover:bg-pet-light disabled:cursor-not-allowed disabled:opacity-50"
        >
          <LogIn size={16} aria-hidden="true" />
          Entrar no painel
        </button>
      </form>
      <StatusMessages actionState={actionState} />
    </section>
  );
}
