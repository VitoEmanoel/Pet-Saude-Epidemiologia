import { DiseaseDashboard } from "@/components/dashboard/TuberculosisDashboard";
import { AppShell } from "@/components/layout/AppShell";

export default function ChikungunyaPage() {
  return (
    <AppShell active="chikungunya">
      <DiseaseDashboard source="chikungunya_sinan" title="Chikungunya" />
    </AppShell>
  );
}
