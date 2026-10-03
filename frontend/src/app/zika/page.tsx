import type { Metadata } from "next";
import { DiseaseDashboard } from "@/components/dashboard/TuberculosisDashboard";
import { AppShell } from "@/components/layout/AppShell";

export const metadata: Metadata = { title: "Zika — Painel Epidemiológico PET-Saúde" };

export default function ZikaPage() {
  return (
    <AppShell active="zika">
      <DiseaseDashboard source="zika_sinan" title="Zika" />
    </AppShell>
  );
}
