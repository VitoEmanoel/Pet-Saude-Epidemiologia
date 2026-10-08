"use client";

import { Copy, KeyRound, Power, ShieldCheck, Trash2, UserCog, UserPlus } from "lucide-react";
import { useState } from "react";
import { createAdminUser, deleteAdminUser, getAdminUsers, resetAdminUserPassword, updateAdminUser } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import type { AdminPermission, AdminRole, AdminUser } from "@/types/api";
import { useAdminSession } from "./AdminSession";
import { PERMISSION_OPTIONS } from "./PermissionGate";
import {
  ActionButton,
  ErrorBox,
  IDLE_ACTION,
  LoadingBlocks,
  Panel,
  SelectField,
  StatusMessages,
  confirmAdminAction,
  errorMessage,
  type ActionState
} from "./admin-ui";
import { useAdminLoader } from "./useAdminLoader";

const ROLE_LABELS: Record<AdminRole, string> = { admin: "Administrador", member: "Equipe" };

function permissionSummary(user: AdminUser) {
  if (user.role === "admin") {
    return "Tudo, inclusive usuários";
  }
  const labels = PERMISSION_OPTIONS.filter((option) => user.permissions.includes(option.value)).map((option) => option.label);
  return labels.length > 0 ? labels.join(", ") : "Só ver o painel";
}

/** Caixas de marcar das permissões (equipe). */
function PermissionChecklist({
  value,
  onChange,
  idPrefix
}: {
  value: AdminPermission[];
  onChange: (value: AdminPermission[]) => void;
  idPrefix: string;
}) {
  return (
    <fieldset aria-label="Permissões" className="grid gap-2 sm:grid-cols-2">
      {PERMISSION_OPTIONS.map((option) => {
        const id = `${idPrefix}-${option.value}`;
        return (
          <label key={option.value} htmlFor={id} className="flex min-h-11 cursor-pointer items-start gap-3 rounded border border-slate-200 p-3 hover:bg-slate-50">
            <input
              id={id}
              type="checkbox"
              checked={value.includes(option.value)}
              onChange={(event) =>
                onChange(
                  event.target.checked
                    ? PERMISSION_OPTIONS.map((item) => item.value).filter((item) => item === option.value || value.includes(item))
                    : value.filter((item) => item !== option.value)
                )
              }
              className="mt-0.5 h-5 w-5 shrink-0 accent-institutional-600"
            />
            <span>
              <span className="block text-sm font-medium text-slate-950">{option.label}</span>
              <span className="block text-xs text-slate-600">{option.description}</span>
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}

type IssuedPassword = { name: string; username: string; password: string; reason: "criada" | "redefinida" };

/** Gerência das contas da área administrativa (7.4). Só administradores. */
export function AdminUsers() {
  const { isAdmin, user: me, handleAuthError } = useAdminSession();

  if (!isAdmin) {
    return (
      <Panel title="Usuários" icon={UserCog}>
        <p className="p-4 text-sm text-slate-700">
          Só administradores gerenciam usuários. Para criar uma conta ou mudar um papel, fale com um administrador.
        </p>
      </Panel>
    );
  }

  return <AdminUsersManager myUsername={me?.username ?? ""} handleAuthError={handleAuthError} />;
}

function AdminUsersManager({ myUsername, handleAuthError }: { myUsername: string; handleAuthError: (error: unknown) => boolean }) {
  const { state, reload } = useAdminLoader(getAdminUsers);
  const [form, setForm] = useState({ name: "", username: "", role: "member" as AdminRole, permissions: [] as AdminPermission[] });
  const [editing, setEditing] = useState<{ id: number; permissions: AdminPermission[] } | null>(null);
  const [issued, setIssued] = useState<IssuedPassword | null>(null);
  const [actionState, setActionState] = useState<ActionState>(IDLE_ACTION);
  const busy = actionState.busyAction !== null;

  async function run(key: string, action: () => Promise<string | void>) {
    setActionState({ ...IDLE_ACTION, busyAction: key });

    try {
      const message = await action();
      await reload();
      setActionState({ ...IDLE_ACTION, message: message ?? null });
    } catch (error) {
      if (!handleAuthError(error)) {
        setActionState({ ...IDLE_ACTION, error: errorMessage(error, "Falha ao atualizar a conta.") });
      }
    }
  }

  function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run("create", async () => {
      const { user, temporaryPassword } = await createAdminUser(form);
      setIssued({ name: user.name, username: user.username, password: temporaryPassword, reason: "criada" });
      setForm({ name: "", username: "", role: "member", permissions: [] });
      return `Conta de ${user.name} criada.`;
    });
  }

  function resetPassword(user: AdminUser) {
    if (!confirmAdminAction(`Gerar uma nova senha temporária para ${user.name}? A senha atual deixa de valer e as sessões abertas dessa pessoa são encerradas.`)) {
      return;
    }
    void run(`reset-${user.id}`, async () => {
      const { temporaryPassword } = await resetAdminUserPassword(user.id);
      setIssued({ name: user.name, username: user.username, password: temporaryPassword, reason: "redefinida" });
      return `Nova senha temporária gerada para ${user.name}.`;
    });
  }

  function toggleActive(user: AdminUser) {
    if (user.active && !confirmAdminAction(`Desativar a conta de ${user.name}? A pessoa sai do painel na hora e não consegue mais entrar.`)) {
      return;
    }
    void run(`active-${user.id}`, async () => {
      await updateAdminUser(user.id, { active: !user.active });
      return user.active ? `Conta de ${user.name} desativada.` : `Conta de ${user.name} reativada.`;
    });
  }

  function changeRole(user: AdminUser, role: AdminRole) {
    void run(`role-${user.id}`, async () => {
      await updateAdminUser(user.id, { role });
      return `${user.name} agora é ${ROLE_LABELS[role].toLowerCase()}.`;
    });
  }

  function savePermissions(user: AdminUser, permissions: AdminPermission[]) {
    void run(`permissions-${user.id}`, async () => {
      await updateAdminUser(user.id, { permissions });
      setEditing(null);
      return `Permissões de ${user.name} atualizadas. Valem a partir da próxima ação da pessoa.`;
    });
  }

  function remove(user: AdminUser) {
    if (!confirmAdminAction(`Excluir a conta de ${user.name}? O histórico na Auditoria continua. Se a pessoa só saiu da equipe, prefira desativar.`)) {
      return;
    }
    void run(`delete-${user.id}`, async () => {
      await deleteAdminUser(user.id);
      return `Conta de ${user.name} excluída.`;
    });
  }

  const inputClass =
    "h-10 w-full rounded border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-institutional-600 focus:ring-2 focus:ring-institutional-50";

  return (
    <div className="space-y-5">
      <Panel title="Nova conta" icon={UserPlus}>
        <form className="space-y-4 p-4" onSubmit={create}>
          <div className="grid gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)] md:items-end">
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase text-slate-500">Nome</span>
            <input name="name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Ex.: Maria da Silva" className={inputClass} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase text-slate-500">Usuário</span>
            <input
              name="new-username"
              value={form.username}
              autoCapitalize="none"
              spellCheck={false}
              onChange={(event) => setForm({ ...form, username: event.target.value.toLowerCase() })}
              placeholder="Ex.: maria.silva"
              className={inputClass}
            />
          </label>
          <SelectField label="Acesso" value={form.role} onChange={(role) => setForm({ ...form, role: role as AdminRole })}>
            <option value="member">Equipe: escolher as permissões</option>
            <option value="admin">Administrador: tudo, inclusive usuários</option>
          </SelectField>
          </div>
          {form.role === "member" ? (
            <PermissionChecklist value={form.permissions} onChange={(permissions) => setForm({ ...form, permissions })} idPrefix="nova" />
          ) : (
            <p className="text-sm text-slate-700">Administrador pode tudo: baixar dados, sincronizar, enviar população, ver a auditoria e gerenciar os usuários.</p>
          )}
          <ActionButton variant="primary" icon={UserPlus} type="submit" disabled={busy}>
            Criar conta
          </ActionButton>
        </form>
        <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
          Todos podem ver o painel, as fontes e o histórico de sincronizações. O sistema gera uma senha temporária; a
          pessoa cria a própria senha no primeiro acesso.
        </p>
        {issued ? <IssuedPasswordBox issued={issued} onClose={() => setIssued(null)} /> : null}
        <StatusMessages actionState={actionState} />
      </Panel>

      <Panel title="Contas" icon={UserCog}>
        {state.status === "loading" ? (
          <LoadingBlocks />
        ) : state.status === "error" ? (
          <ErrorBox message={state.message} />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-pet-dark text-xs uppercase text-white">
                <tr>
                  <th className="px-4 py-3 font-semibold">Nome</th>
                  <th className="px-4 py-3 font-semibold">Usuário</th>
                  <th className="px-4 py-3 font-semibold">Acesso</th>
                  <th className="px-4 py-3 font-semibold">Permissões</th>
                  <th className="px-4 py-3 font-semibold">Situação</th>
                  <th className="px-4 py-3 font-semibold">Último acesso</th>
                  <th className="px-4 py-3 font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {state.data.users.map((user) => {
                  const isMe = user.username === myUsername;
                  return (
                    <tr key={user.id} className={user.active ? "" : "text-slate-500"}>
                      <td className="px-4 py-3 font-medium text-slate-950">
                        {user.name}
                        {isMe ? <span className="ml-2 text-xs font-normal text-slate-500">(você)</span> : null}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-700">{user.username}</td>
                      <td className="px-4 py-3">
                        <select
                          aria-label={`Papel de ${user.name}`}
                          value={user.role}
                          disabled={busy || isMe}
                          onChange={(event) => changeRole(user, event.target.value as AdminRole)}
                          className="h-9 rounded border border-slate-300 bg-white px-2 text-sm text-slate-900 disabled:cursor-not-allowed disabled:bg-slate-50"
                        >
                          <option value="member">Equipe</option>
                          <option value="admin">Administrador</option>
                        </select>
                      </td>
                      <td className="max-w-xs px-4 py-3 text-slate-700">
                        {editing?.id === user.id ? (
                          <div className="space-y-2">
                            <PermissionChecklist value={editing.permissions} onChange={(permissions) => setEditing({ id: user.id, permissions })} idPrefix={`usuario-${user.id}`} />
                            <div className="flex gap-2">
                              <ActionButton variant="blue" disabled={busy} onClick={() => savePermissions(user, editing.permissions)}>
                                Salvar
                              </ActionButton>
                              <ActionButton disabled={busy} onClick={() => setEditing(null)}>
                                Cancelar
                              </ActionButton>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col items-start gap-2">
                            <span>{permissionSummary(user)}</span>
                            {user.role === "member" ? (
                              <ActionButton disabled={busy} onClick={() => setEditing({ id: user.id, permissions: user.permissions })} aria-label={`Editar permissões de ${user.name}`}>
                                Editar
                              </ActionButton>
                            ) : null}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {!user.active ? (
                          <span className="font-medium text-pet-red-text">Desativada</span>
                        ) : user.mustChangePassword ? (
                          <span className="text-slate-700">Aguardando 1º acesso</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-slate-700">
                            <ShieldCheck size={14} aria-hidden="true" /> Ativa
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-700">{user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "Nunca"}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <ActionButton icon={KeyRound} disabled={busy} onClick={() => resetPassword(user)}>
                            Nova senha
                          </ActionButton>
                          {isMe ? null : (
                            <>
                              <ActionButton icon={Power} disabled={busy} onClick={() => toggleActive(user)}>
                                {user.active ? "Desativar" : "Reativar"}
                              </ActionButton>
                              <ActionButton icon={Trash2} disabled={busy} onClick={() => remove(user)} aria-label={`Excluir ${user.name}`}>
                                Excluir
                              </ActionButton>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

/** A senha temporária aparece uma única vez: o administrador repassa à pessoa por um canal seguro. */
function IssuedPasswordBox({ issued, onClose }: { issued: IssuedPassword; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(issued.password);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div role="status" className="space-y-3 border-t border-slate-200 p-4 text-sm">
      <p className="font-semibold text-slate-950">
        Senha temporária de {issued.name} ({issued.username}), {issued.reason}:
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <code data-testid="senha-temporaria" className="rounded border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-base text-slate-950">
          {issued.password}
        </code>
        <ActionButton icon={Copy} onClick={() => void copy()}>
          {copied ? "Copiada" : "Copiar"}
        </ActionButton>
        <ActionButton onClick={onClose}>Já anotei</ActionButton>
      </div>
      <p className="font-medium text-pet-red-text">
        Anote agora: ela não aparece de novo. Repasse à pessoa pessoalmente ou por mensagem privada; no primeiro acesso ela
        cria a própria senha.
      </p>
    </div>
  );
}
