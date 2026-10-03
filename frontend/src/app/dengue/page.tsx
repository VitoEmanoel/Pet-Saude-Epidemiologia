import type { Metadata } from "next";
import { DiseaseDashboard } from "@/components/dashboard/TuberculosisDashboard";
import { AppShell } from "@/components/layout/AppShell";

export const metadata: Metadata = { title: "Dengue — Painel Epidemiológico PET-Saúde" };

export default function DenguePage() {
  return (
    <AppShell active="dengue">
      <DiseaseDashboard source="dengue_sinan" title="Dengue" />
    </AppShell>
  );
}
