import type { Metadata } from "next";
import { TuberculosisDashboard } from "@/components/dashboard/TuberculosisDashboard";
import { AppShell } from "@/components/layout/AppShell";

export const metadata: Metadata = { title: "Tuberculose — Painel Epidemiológico PET-Saúde" };

export default function TuberculosePage() {
  return (
    <AppShell active="tuberculose">
      <TuberculosisDashboard />
    </AppShell>
  );
}

