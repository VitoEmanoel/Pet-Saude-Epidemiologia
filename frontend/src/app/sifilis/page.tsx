import type { Metadata } from "next";
import { DiseaseDashboard } from "@/components/dashboard/TuberculosisDashboard";
import { AppShell } from "@/components/layout/AppShell";

export const metadata: Metadata = { title: "Sífilis congênita — Painel Epidemiológico PET-Saúde" };

export default function SifilisPage() {
  return (
    <AppShell active="sifilis">
      <DiseaseDashboard source="sifilis_congenita_sinan" title="Sífilis congênita" />
    </AppShell>
  );
}
