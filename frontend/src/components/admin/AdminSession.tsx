"use client";

import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  Eye,
  EyeOff,
  Info,
  Loader2,
  Lock,
  LogIn,
  RefreshCw,
  ScrollText,
  ShieldCheck,
  UserRound,
  Users
} from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getAdminSession, loginAdmin, logoutAdmin } from "@/lib/api";
import { PetLogoHorizontal, PetLogoMark } from "../ui/PetLogo";
import { ThemeToggle } from "../ui/ThemeToggle";
import {
  IDLE_ACTION,
  LoadingBlocks,
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

const LOGIN_HIGHLIGHTS = [
  { icon: RefreshCw, text: "Sincronizar as fontes do DATASUS/TABNET" },
  { icon: Users, text: "Enviar a população de cada ano para os indicadores" },
  { icon: ScrollText, text: "Acompanhar o histórico e a auditoria de acessos" }
] as const;

/** Tela de login (sem o menu, que só aparece com sessão): painel da marca à esquerda, formulário à direita. */
function PublicAdminFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="login-surface min-h-screen lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-[#0B2742] via-pet-dark to-pet-mid p-12 text-white lg:flex lg:flex-col lg:justify-between">
        {/* Luzes de fundo, só decoração. */}
        <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-pet-light/25 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-32 -right-20 h-96 w-96 rounded-full bg-pet-orange/20 blur-3xl" aria-hidden="true" />

        <div className="relative flex items-center gap-3">
          <PetLogoMark size={44} className="!bg-white/10 !shadow-none" />
          <div>
            <div className="text-sm font-semibold">PET-Saúde</div>
            <div className="text-xs text-white/75">Informação e Saúde Digital</div>
          </div>
        </div>

        <div className="relative max-w-md">
          <p className="text-sm font-medium uppercase tracking-wider text-pet-sky">Área administrativa</p>
          <p className="mt-3 text-4xl font-semibold leading-tight">Painel Epidemiológico de Parnaíba</p>
          <ul className="mt-8 space-y-4">
            {LOGIN_HIGHLIGHTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm text-white/85">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/15">
                  <Icon size={16} aria-hidden="true" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/75">Dados públicos do DATASUS/TABNET · Parnaíba - PI</p>
      </aside>

      <main className="flex min-h-screen flex-col px-4 py-4 sm:px-8">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/"
            className="inline-flex h-10 items-center gap-2 rounded-lg px-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            Site público
          </Link>
          <ThemeToggle />
        </div>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">{children}</div>
        </div>
        <p className="text-center text-xs text-slate-500">PET-Saúde · Informação e Saúde Digital</p>
      </main>
    </div>
  );
}

function AdminLoginForm({ notice, onLogin }: { notice: string | null; onLogin: (username: string) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [actionState, setActionState] = useState<ActionState>({ ...IDLE_ACTION, message: notice });
  const busy = actionState.busyAction !== null;

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
    "h-12 w-full rounded-lg border border-slate-300 bg-slate-50 pl-10 text-sm text-slate-900 outline-none transition placeholder:text-slate-500 focus:border-institutional-600 focus:ring-4 focus:ring-institutional-50";

  return (
    <section aria-labelledby="login-titulo">
      <div className="mb-8 flex justify-center lg:hidden">
        <PetLogoHorizontal width={190} />
      </div>
      <h1 id="login-titulo" className="text-2xl font-semibold tracking-tight text-slate-950">
        Acesso administrativo
      </h1>
      <p className="mt-2 text-sm text-slate-600">Entre com seu usuário e senha para gerenciar o painel.</p>

      <form className="mt-8 space-y-5" onSubmit={(event) => void submit(event)} noValidate>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">Usuário</span>
          <span className="relative block">
            <UserRound size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden="true" />
            <input
              type="text"
              name="username"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="Seu usuário"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className={`${inputClass} pr-3`}
            />
          </span>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">Senha</span>
          <span className="relative block">
            <Lock size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden="true" />
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              autoComplete="current-password"
              placeholder="Sua senha"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={`${inputClass} pr-12`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              aria-pressed={showPassword}
              title={showPassword ? "Ocultar senha" : "Mostrar senha"}
              className="absolute right-1 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-950"
            >
              {showPassword ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
            </button>
          </span>
        </label>

        {actionState.message ? (
          <p role="status" className="flex gap-2 rounded-lg border border-pet-mid/30 bg-pet-light/15 px-3 py-2.5 text-sm text-pet-dark">
            <Info size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            {actionState.message}
          </p>
        ) : null}
        {actionState.error ? (
          <p role="alert" className="flex gap-2 rounded-lg border border-pet-red-text px-3 py-2.5 text-sm font-medium text-pet-red-text">
            <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            {actionState.error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-pet-mid px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-pet-dark focus:outline-none focus-visible:ring-4 focus-visible:ring-pet-light/40 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? <Loader2 size={17} className="animate-spin" aria-hidden="true" /> : <LogIn size={17} aria-hidden="true" />}
          {busy ? "Entrando..." : "Entrar"}
        </button>
      </form>

      <p className="mt-8 flex items-center gap-2 text-xs text-slate-500">
        <ShieldCheck size={15} className="shrink-0" aria-hidden="true" />
        Acesso restrito à equipe. Cada entrada fica registrada na auditoria.
      </p>
    </section>
  );
}
