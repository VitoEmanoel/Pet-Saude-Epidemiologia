import type { Metadata } from "next";
import { PermissionGate } from "@/components/admin/PermissionGate";
import { AdminAudit } from "@/components/admin/AdminAudit";

export const metadata: Metadata = { title: "Auditoria — Administração PET-Saúde" };

export default function AdminAuditPage() {
  return (
    <PermissionGate permission="auditoria">
      <AdminAudit />
    </PermissionGate>
  );
}
