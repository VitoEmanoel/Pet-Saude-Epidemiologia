import { DiseaseDashboard } from "@/components/dashboard/TuberculosisDashboard";
import { AppShell } from "@/components/layout/AppShell";

export default function SifilisPage() {
  return (
    <AppShell active="sifilis">
      <DiseaseDashboard source="sifilis_congenita_sinan" title="Sifilis congenita" />
    </AppShell>
  );
}
