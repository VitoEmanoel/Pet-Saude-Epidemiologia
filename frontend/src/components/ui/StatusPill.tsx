import { CheckCircle2, Clock3, XCircle } from "lucide-react";

type StatusPillProps = {
  status: string;
};

export function StatusPill({ status }: StatusPillProps) {
  if (status === "available") {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-health-50 px-2 py-1 text-xs font-medium text-health-700">
        <CheckCircle2 size={13} aria-hidden="true" />
        Validado
      </span>
    );
  }

  if (status === "unavailable") {
    return (
      <span className="inline-flex items-center gap-1 rounded border border-pet-red-text px-2 py-1 text-xs font-medium text-pet-red-text">
        <XCircle size={13} aria-hidden="true" />
        Indisponível
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded border border-pet-red-text px-2 py-1 text-xs font-medium text-pet-red-text">
      <Clock3 size={13} aria-hidden="true" />
      Em validação
    </span>
  );
}
