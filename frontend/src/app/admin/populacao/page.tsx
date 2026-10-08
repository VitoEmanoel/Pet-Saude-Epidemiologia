import type { Metadata } from "next";
import { PermissionGate } from "@/components/admin/PermissionGate";
import { AdminPopulation } from "@/components/admin/AdminPopulation";

export const metadata: Metadata = { title: "População — Administração PET-Saúde" };

export default function AdminPopulationPage() {
  return (
    <PermissionGate permission="populacao">
      <AdminPopulation />
    </PermissionGate>
  );
}
