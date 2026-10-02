import { AdminShell } from "@/components/layout/AdminShell";

// O layout fica montado ao trocar de tela: a sessão e o menu não recarregam a cada navegação.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
