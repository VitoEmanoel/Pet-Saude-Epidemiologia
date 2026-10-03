import type { Metadata } from "next";
import { DiseaseDashboard } from "@/components/dashboard/TuberculosisDashboard";
import { AppShell } from "@/components/layout/AppShell";

export const metadata: Metadata = { title: "Hanseníase — Painel Epidemiológico PET-Saúde" };

export default function HanseniasePage() {
  return (
    <AppShell active="hanseniase">
      <DiseaseDashboard source="hanseniase_sinan" title="Hanseníase" />
    </AppShell>
  );
}
