"use client";

import { AlertCircle, CheckCircle2, KeyRound, Loader2 } from "lucide-react";
import { useState } from "react";
import { changeOwnAdminPassword } from "@/lib/api";
import { errorMessage } from "./admin-ui";

const MIN_PASSWORD_LENGTH = 12;

/** Troca da própria senha (7.4): usada no primeiro acesso (senha temporária) e em "Minha conta". */
export function PasswordChangeForm({
  onChanged,
  submitLabel = "Trocar senha"
}: {
  onChanged: () => void | Promise<void>;
  submitLabel?: string;
}) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDone(false);

    if (next.length < MIN_PASSWORD_LENGTH) {
      setError(`A nova senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      return;
    }

    if (next !== confirm) {
      setError("A confirmação não é igual à nova senha.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      await changeOwnAdminPassword(current, next);
      setCurrent("");
      setNext("");
      setConfirm("");
      setDone(true);
      await onChanged();
    } catch (reason) {
      setError(errorMessage(reason, "Falha ao trocar a senha."));
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    "h-11 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition focus:border-institutional-600 focus:ring-4 focus:ring-institutional-50";

  return (
    <form className="space-y-4" onSubmit={(event) => void submit(event)} noValidate>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-slate-700">Senha atual</span>
        <input type="password" name="current-password" autoComplete="current-password" value={current} onChange={(event) => setCurrent(event.target.value)} className={inputClass} />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-slate-700">Nova senha</span>
        <input type="password" name="new-password" autoComplete="new-password" value={next} onChange={(event) => setNext(event.target.value)} className={inputClass} />
        <span className="mt-1 block text-xs text-slate-500">Pelo menos {MIN_PASSWORD_LENGTH} caracteres. Uma frase com espaços é fácil de lembrar e difícil de adivinhar.</span>
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-slate-700">Repita a nova senha</span>
        <input type="password" name="confirm-password" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} className={inputClass} />
      </label>

      {error ? (
        <p role="alert" className="flex gap-2 rounded-lg border border-pet-red-text px-3 py-2.5 text-sm font-medium text-pet-red-text">
          <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : null}
      {done ? (
        <p role="status" className="flex gap-2 text-sm font-medium text-pet-mid">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          Senha trocada. As suas outras sessões abertas foram encerradas.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={busy}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-pet-mid px-4 text-sm font-semibold text-white transition hover:bg-pet-dark disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
      >
        {busy ? <Loader2 size={17} className="animate-spin" aria-hidden="true" /> : <KeyRound size={17} aria-hidden="true" />}
        {busy ? "Salvando..." : submitLabel}
      </button>
    </form>
  );
}
