import type { Metadata } from "next";
import { AdminPopulation } from "@/components/admin/AdminPopulation";

export const metadata: Metadata = { title: "População — Administração PET-Saúde" };

export default function AdminPopulationPage() {
  return <AdminPopulation />;
}
