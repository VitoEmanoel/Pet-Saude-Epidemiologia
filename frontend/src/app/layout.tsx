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
    <html lang="pt-BR" suppressHydrationWarning>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var storedTheme = window.localStorage.getItem("painel-theme");
                  var theme = storedTheme === "dark" || storedTheme === "light"
                    ? storedTheme
                    : (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
                  document.documentElement.classList.toggle("dark", theme === "dark");
                  document.documentElement.style.colorScheme = theme;
                } catch (error) {
                  document.documentElement.classList.remove("dark");
                  document.documentElement.style.colorScheme = "light";
                }
              })();
            `
          }}
        />
        {children}
      </body>
    </html>
  );
}
