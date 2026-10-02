import type { Metadata } from "next";
import { AdminSources } from "@/components/admin/AdminSources";

export const metadata: Metadata = { title: "Fontes — Administração PET-Saúde" };

export default function AdminSourcesPage() {
  return <AdminSources />;
}
