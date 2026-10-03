import type { Metadata } from "next";
import { OverviewDashboard } from "@/components/dashboard/OverviewDashboard";
import { AppShell } from "@/components/layout/AppShell";

export const metadata: Metadata = { title: "Visão geral — Painel Epidemiológico PET-Saúde" };

export default function Home() {
  return (
    <AppShell active="overview">
      <OverviewDashboard />
    </AppShell>
  );
}

