import { DiseaseDashboard } from "@/components/dashboard/TuberculosisDashboard";
import { AppShell } from "@/components/layout/AppShell";

export default function ZikaPage() {
  return (
    <AppShell active="zika">
      <DiseaseDashboard source="zika_sinan" title="Zika" />
    </AppShell>
  );
}
