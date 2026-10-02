import type { LucideIcon } from "lucide-react";

type MetricCardProps = {
  label: string;
  value: string | number;
  detail?: string;
  icon: LucideIcon;
  tone?: "green" | "blue" | "slate" | "amber";
};

const toneClasses = {
  green: "bg-pet-light/15 text-pet-mid",
  blue: "bg-pet-light/15 text-pet-dark",
  slate: "bg-slate-100 text-slate-700",
  amber: "bg-pet-orange/10 text-pet-orange"
};

export function MetricCard({ label, value, detail, icon: Icon, tone = "slate" }: MetricCardProps) {
  return (
    <div className={`rounded border border-pet-ice border-t-4 bg-white p-4 shadow-sm ${tone === "amber" ? "border-t-pet-orange" : "border-t-pet-mid"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase text-slate-500">{label}</p>
          <strong className={`mt-2 block whitespace-nowrap text-xl font-semibold sm:text-2xl ${tone === "amber" ? "text-pet-orange" : "text-pet-dark"}`}>{value}</strong>
        </div>
        {/* No celular os cartões ficam em 2 colunas: o ícone (decorativo) sai para caber o valor. */}
        <div className={`hidden h-9 w-9 shrink-0 items-center justify-center rounded sm:flex ${toneClasses[tone]}`}>
          <Icon size={18} aria-hidden="true" />
        </div>
      </div>
      {detail ? <p className="mt-2 truncate text-xs text-slate-500">{detail}</p> : null}
    </div>
  );
}
