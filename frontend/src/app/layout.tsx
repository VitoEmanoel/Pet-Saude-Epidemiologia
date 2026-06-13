import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Painel Epidemiologico de Parnaiba - PI",
  description: "Dados publicos do DATASUS/TABNET para Parnaiba - PI."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}

