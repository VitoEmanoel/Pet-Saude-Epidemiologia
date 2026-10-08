import type { Metadata } from "next";
import { AdminUsers } from "@/components/admin/AdminUsers";

export const metadata: Metadata = { title: "Usuários — Administração PET-Saúde" };

export default function AdminUsersPage() {
  return <AdminUsers />;
}
