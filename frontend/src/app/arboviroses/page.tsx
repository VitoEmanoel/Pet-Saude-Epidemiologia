import { DiseaseDashboard } from "@/components/dashboard/TuberculosisDashboard";
import { AppShell } from "@/components/layout/AppShell";

export default function ArbovirosesPage() {
  return (
    <AppShell active="arboviroses">
      <DiseaseDashboard source="arboviroses_sinan" title="Arboviroses em geral" />
    </AppShell>
  );
}
