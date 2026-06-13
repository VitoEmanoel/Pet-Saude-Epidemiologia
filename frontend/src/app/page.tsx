import { OverviewDashboard } from "@/components/dashboard/OverviewDashboard";
import { AppShell } from "@/components/layout/AppShell";

export default function Home() {
  return (
    <AppShell active="overview">
      <OverviewDashboard />
    </AppShell>
  );
}

