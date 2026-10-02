import type { Metadata } from "next";
import { AdminOverview } from "@/components/admin/AdminOverview";

export const metadata: Metadata = { title: "Painel — Administração PET-Saúde" };

export default function AdminPage() {
  return <AdminOverview />;
}
