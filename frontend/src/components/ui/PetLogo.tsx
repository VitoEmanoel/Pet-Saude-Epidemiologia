/* eslint-disable @next/next/no-img-element */
// Logo do PET-Saúde (img/ na raiz; versões reduzidas em public/img).
// O símbolo fica sobre fundo branco: a parte azul-escura se perderia no cabeçalho escuro.

export function PetLogoMark({ size = 44, className = "" }: { size?: number; className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-lg bg-[#ffffff] p-1 shadow-sm ring-1 ring-white/30 ${className}`}
      style={{ width: size, height: size }}
    >
      <img src="/img/logo-simbolo.png" alt="" width={size - 8} height={size - 8} className="h-full w-full object-contain" />
    </span>
  );
}

export function PetLogoWithText({ width = 200, className = "" }: { width?: number; className?: string }) {
  return (
    <img
      src="/img/logo-texto-embaixo.png"
      alt="PET-Saúde"
      width={width}
      height={width}
      className={`h-auto object-contain ${className}`}
      style={{ width }}
    />
  );
}
