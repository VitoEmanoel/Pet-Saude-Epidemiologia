import type { Metadata } from "next";
import { DiseaseDashboard } from "@/components/dashboard/TuberculosisDashboard";
import { AppShell } from "@/components/layout/AppShell";

export const metadata: Metadata = { title: "Sífilis gestacional — Painel Epidemiológico PET-Saúde" };

export default function SifilisGestacionalPage() {
  return (
    <AppShell active="sifilis-gestacional">
      <DiseaseDashboard source="sifilis_gestacional_sinan" title="Sífilis gestacional" />
    </AppShell>
  );
}
