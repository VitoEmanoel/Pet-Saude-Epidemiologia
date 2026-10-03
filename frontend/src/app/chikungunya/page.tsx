import type { Metadata } from "next";
import { DiseaseDashboard } from "@/components/dashboard/TuberculosisDashboard";
import { AppShell } from "@/components/layout/AppShell";

export const metadata: Metadata = { title: "Chikungunya — Painel Epidemiológico PET-Saúde" };

export default function ChikungunyaPage() {
  return (
    <AppShell active="chikungunya">
      <DiseaseDashboard source="chikungunya_sinan" title="Chikungunya" />
    </AppShell>
  );
}
