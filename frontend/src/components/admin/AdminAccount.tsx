"use client";

import { KeyRound, UserRound } from "lucide-react";
import { useAdminSession } from "./AdminSession";
import { PasswordChangeForm } from "./PasswordChangeForm";
import { PERMISSION_OPTIONS } from "./PermissionGate";
import { Panel } from "./admin-ui";

/** Dados da própria conta e troca de senha (7.4). */
export function AdminAccount() {
  const { user, isAdmin, can } = useAdminSession();

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <Panel title="Minha conta" icon={UserRound}>
        <dl className="grid gap-4 p-4 text-sm">
          <div>
            <dt className="text-xs font-medium uppercase text-slate-500">Nome</dt>
            <dd className="mt-1 text-slate-950">{user?.name ?? "-"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-slate-500">Usuário</dt>
            <dd className="mt-1 font-mono text-slate-950">{user?.username ?? "-"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-slate-500">Papel</dt>
            <dd className="mt-1 text-slate-950">
              {isAdmin ? "Administrador: pode tudo, inclusive gerenciar os usuários" : "Equipe"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-slate-500">O que você pode fazer</dt>
            <dd className="mt-1">
              <ul className="list-disc space-y-0.5 pl-5 text-slate-950">
                <li>Ver o painel, as fontes e o histórico de sincronizações</li>
                {PERMISSION_OPTIONS.filter((option) => can(option.value)).map((option) => (
                  <li key={option.value}>{option.label}</li>
                ))}
                {isAdmin ? <li>Gerenciar usuários</li> : null}
              </ul>
            </dd>
          </div>
        </dl>
        <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
          Para mudar o nome ou as permissões, peça a um administrador. Tudo o que você faz no painel fica na Auditoria com o seu
          usuário.
        </p>
      </Panel>

      <Panel title="Trocar senha" icon={KeyRound}>
        <div className="p-4">
          <PasswordChangeForm onChanged={() => undefined} />
        </div>
      </Panel>
    </div>
  );
}
