import type { Metadata } from "next";
import { AdminAudit } from "@/components/admin/AdminAudit";

export const metadata: Metadata = { title: "Auditoria — Administração PET-Saúde" };

export default function AdminAuditPage() {
  return <AdminAudit />;
}
