import type { Metadata } from "next";
import { AdminSyncHistory } from "@/components/admin/AdminSyncHistory";

export const metadata: Metadata = { title: "Sincronizações — Administração PET-Saúde" };

export default function AdminSyncHistoryPage() {
  return <AdminSyncHistory />;
}
