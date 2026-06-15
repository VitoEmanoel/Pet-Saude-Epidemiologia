import { AdminDashboard } from "@/components/dashboard/AdminDashboard";
import { AppShell } from "@/components/layout/AppShell";

export default function AdminPage() {
  return (
    <AppShell active="admin">
      <AdminDashboard />
    </AppShell>
  );
}
