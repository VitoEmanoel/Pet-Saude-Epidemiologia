"use client";

import { Lock } from "lucide-react";
import type { AdminPermission } from "@/types/api";
import { useAdminSession } from "./AdminSession";
import { Panel } from "./admin-ui";

export const PERMISSION_OPTIONS: Array<{ value: AdminPermission; label: string; description: string }> = [
  { value: "exportar", label: "Baixar dados", description: "CSV dos registros, dashboard em HTML e indicadores" },
  { value: "sincronizar", label: "Sincronizar fontes", description: "Buscar dados novos no TABNET" },
  { value: "populacao", label: "Enviar população", description: "Tela População: enviar e baixar a planilha" },
  { value: "auditoria", label: "Ver auditoria", description: "Quem fez o quê, de onde e quando" }
];

/** Mostra a tela só para quem tem a permissão (7.4); o servidor também barra. */
export function PermissionGate({ permission, children }: { permission: AdminPermission; children: React.ReactNode }) {
  const { can } = useAdminSession();

  if (can(permission)) {
    return <>{children}</>;
  }

  const option = PERMISSION_OPTIONS.find((item) => item.value === permission);

  return (
    <Panel title="Sem permissão" icon={Lock}>
      <p className="p-4 text-sm text-slate-700">
        Sua conta não tem a permissão <strong>{option?.label ?? permission}</strong>. Se precisar dela, peça a um
        administrador (menu Usuários).
      </p>
    </Panel>
  );
}
