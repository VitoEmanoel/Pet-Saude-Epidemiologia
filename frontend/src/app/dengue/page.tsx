import { DiseaseDashboard } from "@/components/dashboard/TuberculosisDashboard";
import { AppShell } from "@/components/layout/AppShell";

export default function DenguePage() {
  return (
    <AppShell active="dengue">
      <DiseaseDashboard source="dengue_sinan" title="Dengue" />
    </AppShell>
  );
}
