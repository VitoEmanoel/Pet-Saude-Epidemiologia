import type { Metadata } from "next";
import { AdminAccount } from "@/components/admin/AdminAccount";

export const metadata: Metadata = { title: "Minha conta — Administração PET-Saúde" };

export default function AdminAccountPage() {
  return <AdminAccount />;
}
