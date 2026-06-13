import { TuberculosisDashboard } from "@/components/dashboard/TuberculosisDashboard";
import { AppShell } from "@/components/layout/AppShell";

export default function TuberculosePage() {
  return (
    <AppShell active="tuberculose">
      <TuberculosisDashboard />
    </AppShell>
  );
}

