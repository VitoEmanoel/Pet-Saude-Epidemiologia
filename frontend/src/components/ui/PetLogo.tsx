/* eslint-disable @next/next/no-img-element */
// Logo do PET-Saúde (img/ na raiz; versões reduzidas em public/img).
// No tema claro o símbolo fica sobre fundo branco (a parte azul-escura se perderia no cabeçalho
// escuro); no tema escuro o fundo vira translúcido (.pet-logo-tile, em globals.css).
import { withBasePath } from "@/lib/base-path";

export function PetLogoMark({ size = 44, className = "" }: { size?: number; className?: string }) {
  return (
    <span
      className={`pet-logo-tile inline-flex shrink-0 items-center justify-center rounded-lg p-1 shadow-sm ring-1 ring-white/30 ${className}`}
      style={{ width: size, height: size }}
    >
      <img src={withBasePath("/img/logo-simbolo.png")} alt="" width={size - 8} height={size - 8} className="h-full w-full object-contain" />
    </span>
  );
}

export function PetLogoWithText({ width = 200, className = "" }: { width?: number; className?: string }) {
  return (
    <img
      src={withBasePath("/img/logo-texto-embaixo.png")}
      alt="PET-Saúde"
      width={width}
      height={width}
      className={`h-auto object-contain ${className}`}
      style={{ width }}
    />
  );
}

/** Símbolo com o nome ao lado (fundo transparente). */
export function PetLogoHorizontal({ width = 200, className = "" }: { width?: number; className?: string }) {
  return (
    <img
      src={withBasePath("/img/logo-texto-lateral.png")}
      alt="PET-Saúde"
      width={width}
      height={Math.round((width * 230) / 480)}
      className={`h-auto object-contain ${className}`}
      style={{ width }}
    />
  );
}
