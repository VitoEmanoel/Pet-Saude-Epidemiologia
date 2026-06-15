import { DiseaseDashboard } from "@/components/dashboard/TuberculosisDashboard";
import { AppShell } from "@/components/layout/AppShell";

export default function HanseniasePage() {
  return (
    <AppShell active="hanseniase">
      <DiseaseDashboard source="hanseniase_sinan" title="Hanseniase" />
    </AppShell>
  );
}
