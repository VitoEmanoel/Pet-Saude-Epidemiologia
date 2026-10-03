import type { Metadata } from "next";
import { DiseaseDashboard } from "@/components/dashboard/TuberculosisDashboard";
import { AppShell } from "@/components/layout/AppShell";

export const metadata: Metadata = { title: "Arboviroses — Painel Epidemiológico PET-Saúde" };

export default function ArbovirosesPage() {
  return (
    <AppShell active="arboviroses">
      <DiseaseDashboard source="arboviroses_sinan" title="Arboviroses em geral" />
    </AppShell>
  );
}
