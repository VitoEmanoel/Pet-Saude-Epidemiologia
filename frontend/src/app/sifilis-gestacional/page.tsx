import { DiseaseDashboard } from "@/components/dashboard/TuberculosisDashboard";
import { AppShell } from "@/components/layout/AppShell";

export default function SifilisGestacionalPage() {
  return (
    <AppShell active="sifilis-gestacional">
      <DiseaseDashboard source="sifilis_gestacional_sinan" title="Sifilis gestacional" />
    </AppShell>
  );
}
